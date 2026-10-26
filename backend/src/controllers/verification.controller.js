const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const { success, error, paginated } = require('../utils/apiResponse');
const { generateRequestNo } = require('../services/sequence.service');
const { addTimelineEvent, refreshApplicationStatus } = require('../services/application.service');
const { notifyPanchayatOfficers } = require('../services/notification.service');
const { logAction } = require('../services/audit.service');
const cryptoService = require('../services/crypto.service');

/**
 * List verification requests with direction, status, search, and pagination
 * GET /api/verification-requests?direction=incoming|outgoing&status&search&page&limit
 */
async function getVerificationRequests(req, res) {
  try {
    const { direction = 'incoming', status, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const userRole = req.user.role;
    const userPanchayatId = req.user.panchayat_id;

    const whereClauses = [];
    const params = [];

    // Direction scoping
    if (userRole === 'OFFICER') {
      if (direction === 'incoming') {
        whereClauses.push('vr.verifying_panchayat_id = ?');
        params.push(userPanchayatId);
      } else {
        whereClauses.push('vr.requesting_panchayat_id = ?');
        params.push(userPanchayatId);
      }
    } else if (userRole === 'ADMIN') {
      if (direction === 'incoming') {
        // admin can view incoming filter if requested
      } else if (direction === 'outgoing') {
        // admin can view outgoing
      }
    } else {
      return error(res, 'Access denied', {}, 403);
    }

    if (status && status !== 'undefined' && status !== 'null') {
      whereClauses.push('vr.status = ?');
      params.push(status);
    }

    if (search && search !== 'undefined' && search !== 'null') {
      whereClauses.push('(vr.request_no LIKE ? OR a.application_no LIKE ? OR cit.full_name LIKE ? OR vr.subject_name LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM verification_requests vr
      JOIN applications a ON vr.application_id = a.application_id
      JOIN citizens cit ON a.citizen_id = cit.citizen_id
      ${whereSql}
    `;
    const countRows = await query(countSql, params);
    const total = countRows && countRows[0] ? Number(countRows[0].total) : 0;

    // Sorting rule:
    // If incoming and status is PENDING (or pending tab), sort overdue first, then oldest request date first
    let orderSql = 'ORDER BY vr.request_date DESC, vr.verification_id DESC';
    if (direction === 'incoming' && (!status || status === 'PENDING')) {
      orderSql = 'ORDER BY (vr.status = "PENDING" AND NOW() > vr.due_at) DESC, vr.request_date ASC, vr.verification_id ASC';
    }

    // Data query
    const dataSql = `
      SELECT vr.verification_id, vr.request_no, vr.application_id, vr.party_id,
             vr.requesting_panchayat_id, vr.verifying_panchayat_id,
             vr.subject_party, vr.subject_name, vr.purpose, vr.status,
             vr.request_date, vr.due_at, vr.response_date, vr.response_remarks,
             vr.reminder_count, vr.last_reminder_at,
             a.application_no,
             cit.full_name as applicant_name,
             ct.certificate_name, ct.certificate_code,
             rp.panchayat_name as requesting_panchayat_name, rp.panchayat_code as requesting_panchayat_code,
             vp.panchayat_name as verifying_panchayat_name, vp.panchayat_code as verifying_panchayat_code,
             (vr.status = 'PENDING' AND NOW() > vr.due_at) as is_overdue
      FROM verification_requests vr
      JOIN applications a ON vr.application_id = a.application_id
      JOIN citizens cit ON a.citizen_id = cit.citizen_id
      JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
      JOIN panchayats rp ON vr.requesting_panchayat_id = rp.panchayat_id
      JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
      ${whereSql}
      ${orderSql}
      LIMIT ? OFFSET ?
    `;

    const items = await query(dataSql, [...params, limitNum, offset]);
    const formatted = (items || []).map((row) => ({
      ...row,
      is_overdue: Boolean(row.is_overdue)
    }));

    return paginated(res, formatted, total, pageNum, limitNum);
  } catch (err) {
    console.error('Error fetching verification requests:', err);
    return error(res, 'Failed to fetch verification requests', {}, 500);
  }
}

/**
 * Get summary counts for incoming and outgoing requests
 * GET /api/verification-requests/counts
 */
async function getVerificationCounts(req, res) {
  try {
    const userRole = req.user.role;
    const panchayatId = req.user.panchayat_id;

    let incomingSql = `
      SELECT
        SUM(status = 'PENDING') as pending,
        SUM(status = 'APPROVED') as approved,
        SUM(status = 'REJECTED') as rejected,
        SUM(status = 'PENDING' AND NOW() > due_at) as overdue
      FROM verification_requests
    `;
    let outgoingSql = incomingSql;
    const incomingParams = [];
    const outgoingParams = [];

    if (userRole === 'OFFICER') {
      incomingSql += ' WHERE verifying_panchayat_id = ?';
      incomingParams.push(panchayatId);

      outgoingSql += ' WHERE requesting_panchayat_id = ?';
      outgoingParams.push(panchayatId);
    }

    const [inRows, outRows] = await Promise.all([
      query(incomingSql, incomingParams),
      query(outgoingSql, outgoingParams)
    ]);

    const inRes = inRows && inRows[0] ? inRows[0] : {};
    const outRes = outRows && outRows[0] ? outRows[0] : {};

    return success(res, {
      incoming: {
        pending: Number(inRes.pending) || 0,
        approved: Number(inRes.approved) || 0,
        rejected: Number(inRes.rejected) || 0,
        overdue: Number(inRes.overdue) || 0
      },
      outgoing: {
        pending: Number(outRes.pending) || 0,
        approved: Number(outRes.approved) || 0,
        rejected: Number(outRes.rejected) || 0,
        overdue: Number(outRes.overdue) || 0
      }
    });
  } catch (err) {
    console.error('Error fetching verification counts:', err);
    return error(res, 'Failed to fetch verification counts', {}, 500);
  }
}

/**
 * Get single verification request by ID
 * GET /api/verification-requests/:id?technical=1
 */
async function getVerificationRequestById(req, res) {
  try {
    const verificationId = Number(req.params.id);
    const technical = req.query.technical === '1' || req.query.technical === 'true';

    if (!verificationId) {
      return error(res, 'Verification request not found', {}, 404);
    }

    const rows = await query(
      `SELECT vr.*,
              a.application_no, a.purpose as application_purpose,
              cit.full_name as applicant_name, cit.aadhaar_no as applicant_aadhaar,
              ct.certificate_name, ct.certificate_code,
              rp.panchayat_name as requesting_panchayat_name, rp.panchayat_code as requesting_panchayat_code,
              rp.panchayat_name as home_panchayat_name, rp.panchayat_code as home_panchayat_code,
              vp.panchayat_name as verifying_panchayat_name, vp.panchayat_code as verifying_panchayat_code,
              po.full_name as signer_name, po.designation as signer_designation,
              (vr.status = 'PENDING' AND NOW() > vr.due_at) as is_overdue
       FROM verification_requests vr
       JOIN applications a ON vr.application_id = a.application_id
       JOIN citizens cit ON a.citizen_id = cit.citizen_id
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN panchayats rp ON vr.requesting_panchayat_id = rp.panchayat_id
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       LEFT JOIN panchayat_officers po ON vr.responded_by_officer_id = po.officer_id
       WHERE vr.verification_id = ?`,
      [verificationId]
    );

    const vr = Array.isArray(rows) ? rows[0] : rows;
    if (!vr) {
      return error(res, 'Verification request not found', {}, 404);
    }

    const userRole = req.user.role;
    const userPanchayatId = req.user.panchayat_id;

    // Check isolation: must be verifying panchayat officer, requesting panchayat officer, or admin
    const isVerifyingOfficer = (userRole === 'OFFICER' && Number(userPanchayatId) === Number(vr.verifying_panchayat_id));
    const isRequestingOfficer = (userRole === 'OFFICER' && Number(userPanchayatId) === Number(vr.requesting_panchayat_id));
    const isAdmin = (userRole === 'ADMIN');

    if (!isVerifyingOfficer && !isRequestingOfficer && !isAdmin) {
      return error(res, 'Verification request not found', {}, 404);
    }

    // Live cryptographic signature check if signed
    let signatureCheck = null;
    if (vr.signed_at && vr.signature) {
      signatureCheck = cryptoService.verifyRequestSignature(vr);
    }

    // Documents query (ONLY documents matching subject_party for that application)
    const docRows = await query(
      `SELECT document_id, document_name, document_type, mime_type, file_size, verification_status
       FROM application_documents
       WHERE application_id = ? AND related_to = ?`,
      [vr.application_id, vr.subject_party]
    );

    // Build "required records" bullets (Prompt 4 rule)
    const requiredRecords = [];
    if (vr.subject_party === 'FATHER' || vr.subject_party === 'MOTHER') {
      requiredRecords.push(`Residence and registration of ${vr.subject_name} in panchayat records`);
      requiredRecords.push(`Annual income and occupation declared: ${vr.subject_details || 'As per declared statement'}`);
      requiredRecords.push(`Confirmation that ${vr.subject_name} is the ${vr.subject_party.toLowerCase()} of applicant ${vr.applicant_name}`);
    } else if (vr.subject_party === 'PROPERTY') {
      requiredRecords.push(`Ownership and possession of the property under ${vr.subject_name}`);
      requiredRecords.push(`Verification of declared land/building details: ${vr.subject_details || 'As declared'}`);
    } else {
      requiredRecords.push(`Verification of declared facts for ${vr.subject_name}`);
    }

    const responsePayload = {
      verification_id: vr.verification_id,
      request_no: vr.request_no,
      application_id: vr.application_id,
      application_no: vr.application_no,
      certificate_name: vr.certificate_name,
      certificate_code: vr.certificate_code,
      purpose: vr.purpose || vr.application_purpose,
      status: vr.status,
      request_date: vr.request_date,
      due_at: vr.due_at,
      is_overdue: Boolean(vr.is_overdue),
      response_date: vr.response_date,
      response_remarks: vr.response_remarks,
      reminder_count: vr.reminder_count,
      last_reminder_at: vr.last_reminder_at,
      request_details: vr.request_details,
      subject_party: vr.subject_party,
      subject_name: vr.subject_name,
      applicant_name: vr.applicant_name,
      application_purpose: vr.application_purpose,
      home_panchayat_name: vr.requesting_panchayat_name,
      home_panchayat_code: vr.requesting_panchayat_code,
      requesting_panchayat_name: vr.requesting_panchayat_name,
      requesting_panchayat_code: vr.requesting_panchayat_code,
      verifying_panchayat_name: vr.verifying_panchayat_name,
      verifying_panchayat_code: vr.verifying_panchayat_code,
      // Aadhaar unmasked ONLY for verifying officer on this page per section 13
      subject_aadhaar: isVerifyingOfficer ? vr.subject_aadhaar : (vr.subject_aadhaar ? `XXXX XXXX ${vr.subject_aadhaar.slice(-4)}` : null),
      subject_details: vr.subject_details,
      applicant: {
        full_name: vr.applicant_name,
        panchayat_name: vr.requesting_panchayat_name,
        panchayat_code: vr.requesting_panchayat_code
      },
      requesting_panchayat: {
        panchayat_id: vr.requesting_panchayat_id,
        panchayat_name: vr.requesting_panchayat_name,
        panchayat_code: vr.requesting_panchayat_code
      },
      verifying_panchayat: {
        panchayat_id: vr.verifying_panchayat_id,
        panchayat_name: vr.verifying_panchayat_name,
        panchayat_code: vr.verifying_panchayat_code
      },
      required_records: requiredRecords,
      documents: docRows || [],
      signature_summary: {
        signed: !!vr.signed_at,
        signer_name: vr.signer_name || null,
        signer_designation: vr.signer_designation || null,
        signed_at: vr.signed_at || null,
        fingerprint: vr.signer_key_fingerprint ? vr.signer_key_fingerprint.slice(0, 16) : null
      },
      signature_check: signatureCheck
    };

    if (technical && vr.signed_at) {
      responsePayload.technical_details = {
        payload_json: vr.payload_json,
        payload_hash: vr.payload_hash,
        signature: vr.signature,
        signature_algorithm: vr.signature_algorithm,
        signer_public_key: vr.signer_public_key,
        signer_key_fingerprint: vr.signer_key_fingerprint
      };
    }

    return success(res, responsePayload);
  } catch (err) {
    console.error('Error fetching verification request by id:', err);
    return error(res, 'Failed to fetch verification request', {}, 500);
  }
}

/**
 * Answer / digitally sign a verification request
 * POST /api/verification-requests/:id/respond
 */
async function respondVerificationRequest(req, res) {
  try {
    const verificationId = Number(req.params.id);
    const { decision, remarks, password } = req.body;

    if (!verificationId) {
      return error(res, 'Verification request not found', {}, 404);
    }

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return error(res, 'Decision must be either "APPROVED" or "REJECTED"', {}, 400);
    }

    if (decision === 'REJECTED' && (!remarks || remarks.trim().length < 5)) {
      return error(res, 'Remarks are mandatory when rejecting a verification request (min 5 characters)', {}, 400);
    }

    if (!password) {
      return error(res, 'Password is required to decrypt private key and digitally sign the response', {}, 400);
    }

    // 1. Fetch verification request
    const vrRows = await query(
      `SELECT vr.*, a.application_no, ct.certificate_name
       FROM verification_requests vr
       JOIN applications a ON vr.application_id = a.application_id
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       WHERE vr.verification_id = ?`,
      [verificationId]
    );
    const vr = Array.isArray(vrRows) ? vrRows[0] : vrRows;
    if (!vr) {
      return error(res, 'Verification request not found', {}, 404);
    }

    // 2. Permission check: must be active officer of the verifying panchayat
    const userPanchayatId = req.user.panchayat_id;
    if (Number(userPanchayatId) !== Number(vr.verifying_panchayat_id)) {
      return error(res, 'Verification request not found', {}, 404);
    }

    // 3. Status check: must be PENDING
    if (vr.status !== 'PENDING') {
      return error(res, 'Request is already answered or cancelled', {}, 409);
    }

    // 4. Verify officer password with bcrypt
    const offRows = await query(
      `SELECT u.password_hash, po.officer_id, po.full_name, po.designation,
              po.employee_id, po.public_key, po.private_key_encrypted, po.key_fingerprint
       FROM users u
       JOIN panchayat_officers po ON u.user_id = po.user_id
       WHERE u.user_id = ? AND po.status = 'ACTIVE'`,
      [req.user.user_id]
    );
    const officer = Array.isArray(offRows) ? offRows[0] : offRows;
    if (!officer) {
      return error(res, 'Active officer credentials not found', {}, 403);
    }

    const passwordMatches = await bcrypt.compare(password, officer.password_hash);
    if (!passwordMatches) {
      return error(res, 'Incorrect password. Cannot sign verification response.', {}, 401);
    }

    // 5. Decrypt officer private key
    let privateKeyPem;
    try {
      privateKeyPem = cryptoService.decryptPrivateKey(officer.private_key_encrypted);
    } catch (err) {
      console.error('Failed to decrypt officer private key:', err);
      return error(res, 'Failed to decrypt digital signature key', {}, 500);
    }

    // 6. Fetch panchayat details for canonical payload
    const [reqPanchRows, verPanchRows] = await Promise.all([
      query('SELECT panchayat_id, panchayat_code, panchayat_name FROM panchayats WHERE panchayat_id = ?', [vr.requesting_panchayat_id]),
      query('SELECT panchayat_id, panchayat_code, panchayat_name FROM panchayats WHERE panchayat_id = ?', [vr.verifying_panchayat_id])
    ]);
    const reqPanch = reqPanchRows[0];
    const verPanch = verPanchRows[0];

    // 7. Build canonical payload JSON
    const signedAtIso = new Date().toISOString();
    const payloadJson = cryptoService.buildSignaturePayload({
      request_no: vr.request_no,
      verification_id: vr.verification_id,
      application_id: vr.application_id,
      application_no: vr.application_no,
      requesting_panchayat: {
        id: reqPanch.panchayat_id,
        code: reqPanch.panchayat_code,
        name: reqPanch.panchayat_name
      },
      verifying_panchayat: {
        id: verPanch.panchayat_id,
        code: verPanch.panchayat_code,
        name: verPanch.panchayat_name
      },
      subject_party: vr.subject_party,
      subject_name: vr.subject_name,
      decision,
      remarks: remarks ? remarks.trim() : '',
      signed_by: {
        officer_id: officer.officer_id,
        name: officer.full_name,
        designation: officer.designation,
        employee_id: officer.employee_id
      },
      signed_at: signedAtIso
    });

    // 8. Sign payload with RSA-2048 SHA-256
    const { payload_hash, signature, signature_algorithm } = cryptoService.signPayload(payloadJson, privateKeyPem);
    const signedAtMysql = signedAtIso.slice(0, 19).replace('T', ' ');

    // 9. Execute database update in transaction
    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE verification_requests
         SET status = ?,
             response_date = NOW(),
             responded_by_officer_id = ?,
             response_remarks = ?,
             payload_json = ?,
             payload_hash = ?,
             signature = ?,
             signature_algorithm = ?,
             signer_public_key = ?,
             signer_key_fingerprint = ?,
             signed_at = ?
         WHERE verification_id = ?`,
        [
          decision,
          officer.officer_id,
          remarks ? remarks.trim() : null,
          payloadJson,
          payload_hash,
          signature,
          signature_algorithm,
          officer.public_key,
          officer.key_fingerprint,
          signedAtMysql,
          verificationId
        ]
      );

      // Re-evaluate application status (SUBMITTED / PENDING_EXTERNAL / READY_FOR_DECISION)
      await refreshApplicationStatus(vr.application_id, conn);

      // Add timeline event
      const eventTitle = decision === 'APPROVED'
        ? `Verified by ${verPanch.panchayat_name}`
        : `Verification rejected by ${verPanch.panchayat_name}`;

      await addTimelineEvent(
        vr.application_id,
        {
          eventType: 'VERIFICATION_RESPONSE',
          title: eventTitle,
          description: remarks ? `Remarks: ${remarks.trim()}` : `Digitally signed ${decision.toLowerCase()} by ${officer.full_name}`,
          actorUserId: req.user.user_id
        },
        conn
      );

      // Audit log
      await logAction(
        req.user.user_id,
        'SIGN_RESPONSE',
        'verification_requests',
        verificationId,
        `Digitally signed ${decision} for request ${vr.request_no}`,
        req
      );
    });

    // 10. Dispatch notifications to requesting panchayat officers (in-app + EMAIL)
    try {
      await notifyPanchayatOfficers(vr.requesting_panchayat_id, {
        type: 'VERIFICATION_RESPONSE',
        title: `Verification Response: ${vr.request_no}`,
        message: `${verPanch.panchayat_name} officer ${officer.full_name} has ${decision.toLowerCase()} verification request ${vr.request_no} for ${vr.subject_name} (${vr.subject_party}).`,
        applicationId: vr.application_id,
        verificationId: vr.verification_id,
        email: true
      });
    } catch (err) {
      console.error('Failed to dispatch verification response notification:', err);
    }

    // 11. Fetch updated row and compute signature check
    const updatedRows = await query(
      'SELECT * FROM verification_requests WHERE verification_id = ?',
      [verificationId]
    );
    const updated = updatedRows[0];
    const signatureCheck = cryptoService.verifyRequestSignature(updated);

    return success(res, {
      verification_id: updated.verification_id,
      request_no: updated.request_no,
      status: updated.status,
      response_date: updated.response_date,
      response_remarks: updated.response_remarks,
      signed_at: updated.signed_at,
      signature_check: signatureCheck
    }, 'Verification response signed and submitted successfully');
  } catch (err) {
    console.error('Error responding to verification request:', err);
    return error(res, 'Failed to submit verification response', {}, 500);
  }
}

/**
 * Send reminder for a pending verification request
 * POST /api/verification-requests/:id/remind
 */
async function remindVerificationRequest(req, res) {
  try {
    const verificationId = Number(req.params.id);
    if (!verificationId) {
      return error(res, 'Verification request not found', {}, 404);
    }

    const vrRows = await query(
      `SELECT vr.*, a.application_no,
              rp.panchayat_name as requesting_panchayat_name,
              vp.panchayat_name as verifying_panchayat_name
       FROM verification_requests vr
       JOIN applications a ON vr.application_id = a.application_id
       JOIN panchayats rp ON vr.requesting_panchayat_id = rp.panchayat_id
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       WHERE vr.verification_id = ?`,
      [verificationId]
    );
    const vr = Array.isArray(vrRows) ? vrRows[0] : vrRows;
    if (!vr) {
      return error(res, 'Verification request not found', {}, 404);
    }

    // Check permission: requesting officer only
    if (Number(req.user.panchayat_id) !== Number(vr.requesting_panchayat_id)) {
      return error(res, 'Verification request not found', {}, 404);
    }

    // Status check
    if (vr.status !== 'PENDING') {
      return error(res, 'Only pending requests can be reminded', {}, 400);
    }

    // Cooldown check (Section 13)
    const [cdRows] = await query(
      `SELECT \`value\` FROM master_data WHERE category = 'SETTING' AND code = 'REMINDER_COOLDOWN_HOURS' AND status = 'ACTIVE' LIMIT 1`
    );
    const cooldownHours = (cdRows && cdRows[0]?.value) ? Number(cdRows[0].value) : 24;

    const now = new Date();
    const isPastDue = now > new Date(vr.due_at);

    if (vr.last_reminder_at) {
      const hoursSinceReminder = (now.getTime() - new Date(vr.last_reminder_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceReminder < cooldownHours) {
        const waitHours = Math.ceil(cooldownHours - hoursSinceReminder);
        return error(res, `Reminder cooldown active. You can send another reminder after ${waitHours} hour(s).`, {}, 400);
      }
    } else {
      const hoursSinceRequest = (now.getTime() - new Date(vr.request_date).getTime()) / (1000 * 60 * 60);
      if (!isPastDue && hoursSinceRequest < cooldownHours) {
        const waitHours = Math.ceil(cooldownHours - hoursSinceRequest);
        return error(res, `Reminder cooldown active. You can send another reminder after ${waitHours} hour(s).`, {}, 400);
      }
    }

    // Update reminder count & timestamp
    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE verification_requests
         SET reminder_count = reminder_count + 1,
             last_reminder_at = NOW()
         WHERE verification_id = ?`,
        [verificationId]
      );

      await addTimelineEvent(
        vr.application_id,
        {
          eventType: 'REMINDER_SENT',
          title: `Reminder sent to ${vr.verifying_panchayat_name}`,
          description: `Reminder #${vr.reminder_count + 1} sent regarding ${vr.subject_name} (${vr.subject_party})`,
          actorUserId: req.user.user_id
        },
        conn
      );

      await logAction(
        req.user.user_id,
        'SEND_REMINDER',
        'verification_requests',
        verificationId,
        `Sent reminder #${vr.reminder_count + 1} for request ${vr.request_no}`,
        req
      );
    });

    // Notify verifying officers (in-app + EMAIL)
    try {
      await notifyPanchayatOfficers(vr.verifying_panchayat_id, {
        type: 'VERIFICATION_REMINDER',
        title: `Reminder: Verification Request ${vr.request_no}`,
        message: `A reminder was sent by ${vr.requesting_panchayat_name} for pending verification request ${vr.request_no} regarding ${vr.subject_name} (${vr.subject_party}).`,
        applicationId: vr.application_id,
        verificationId: vr.verification_id,
        email: true
      });
    } catch (err) {
      console.error('Failed to send reminder notification:', err);
    }

    return success(res, { reminder_count: vr.reminder_count + 1 }, 'Reminder sent successfully');
  } catch (err) {
    console.error('Error sending reminder:', err);
    return error(res, 'Failed to send reminder', {}, 500);
  }
}

/**
 * Cancel a pending verification request
 * POST /api/verification-requests/:id/cancel
 */
async function cancelVerificationRequest(req, res) {
  try {
    const verificationId = Number(req.params.id);
    if (!verificationId) {
      return error(res, 'Verification request not found', {}, 404);
    }

    const vrRows = await query(
      `SELECT vr.*, vp.panchayat_name as verifying_panchayat_name
       FROM verification_requests vr
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       WHERE vr.verification_id = ?`,
      [verificationId]
    );
    const vr = Array.isArray(vrRows) ? vrRows[0] : vrRows;
    if (!vr) {
      return error(res, 'Verification request not found', {}, 404);
    }

    // Check permission: requesting officer only
    if (Number(req.user.panchayat_id) !== Number(vr.requesting_panchayat_id)) {
      return error(res, 'Verification request not found', {}, 404);
    }

    if (vr.status !== 'PENDING') {
      return error(res, 'Only pending requests can be cancelled', {}, 400);
    }

    await withTransaction(async (conn) => {
      await conn.query(
        'UPDATE verification_requests SET status = "CANCELLED" WHERE verification_id = ?',
        [verificationId]
      );

      await refreshApplicationStatus(vr.application_id, conn);

      await addTimelineEvent(
        vr.application_id,
        {
          eventType: 'VERIFICATION_CANCELLED',
          title: 'Verification request cancelled',
          description: `Verification request ${vr.request_no} addressed to ${vr.verifying_panchayat_name} was cancelled by home officer.`,
          actorUserId: req.user.user_id
        },
        conn
      );

      await logAction(
        req.user.user_id,
        'CANCEL_REQUEST',
        'verification_requests',
        verificationId,
        `Cancelled verification request ${vr.request_no}`,
        req
      );
    });

    return success(res, { status: 'CANCELLED' }, 'Verification request cancelled');
  } catch (err) {
    console.error('Error cancelling verification request:', err);
    return error(res, 'Failed to cancel verification request', {}, 500);
  }
}

/**
 * Perform live cryptographic signature check on a request
 * GET /api/verification-requests/:id/signature-check
 */
async function checkSignature(req, res) {
  try {
    const verificationId = Number(req.params.id);
    if (!verificationId) {
      return error(res, 'Verification request not found', {}, 404);
    }

    const vrRows = await query(
      'SELECT * FROM verification_requests WHERE verification_id = ?',
      [verificationId]
    );
    const vr = Array.isArray(vrRows) ? vrRows[0] : vrRows;
    if (!vr) {
      return error(res, 'Verification request not found', {}, 404);
    }

    const userRole = req.user.role;
    const userPanchayatId = req.user.panchayat_id;

    if (
      userRole === 'OFFICER' &&
      Number(userPanchayatId) !== Number(vr.requesting_panchayat_id) &&
      Number(userPanchayatId) !== Number(vr.verifying_panchayat_id)
    ) {
      return error(res, 'Verification request not found', {}, 404);
    }

    const check = cryptoService.verifyRequestSignature(vr);
    return success(res, check);
  } catch (err) {
    console.error('Error checking signature:', err);
    return error(res, 'Failed to verify signature', {}, 500);
  }
}

/**
 * Create extra manual verification request (Home officer of application)
 * POST /api/verification-requests
 */
async function createVerificationRequest(req, res) {
  try {
    const {
      application_id,
      verifying_panchayat_id,
      subject_party,
      subject_name,
      subject_aadhaar,
      subject_details,
      purpose,
      request_details
    } = req.body;

    if (!application_id || !verifying_panchayat_id || !subject_name || !subject_party) {
      return error(res, 'Application ID, verifying panchayat, subject party, and subject name are required', {}, 400);
    }

    // 1. Verify application
    const appRows = await query(
      'SELECT * FROM applications WHERE application_id = ?',
      [application_id]
    );
    const app = Array.isArray(appRows) ? appRows[0] : appRows;
    if (!app) {
      return error(res, 'Application not found', {}, 404);
    }

    // Home officer check
    if (Number(app.home_panchayat_id) !== Number(req.user.panchayat_id)) {
      return error(res, 'Only the home panchayat officer can create verification requests', {}, 403);
    }

    if (!['SUBMITTED', 'PENDING_EXTERNAL', 'READY_FOR_DECISION'].includes(app.status)) {
      return error(res, `Cannot send request: Application is already ${app.status}`, {}, 400);
    }

    if (Number(verifying_panchayat_id) === Number(app.home_panchayat_id)) {
      return error(res, 'Verifying panchayat cannot be the same as home panchayat', {}, 400);
    }

    // Verify verifying panchayat is active and has an active officer
    const pCheckRows = await query(
      `SELECT p.panchayat_id, p.panchayat_name, p.status,
              (SELECT COUNT(*) FROM panchayat_officers po WHERE po.panchayat_id = p.panchayat_id AND po.status = 'ACTIVE') as active_officers
       FROM panchayats p
       WHERE p.panchayat_id = ?`,
      [verifying_panchayat_id]
    );
    const pCheck = Array.isArray(pCheckRows) ? pCheckRows[0] : pCheckRows;
    if (!pCheck || pCheck.status !== 'ACTIVE' || Number(pCheck.active_officers) === 0) {
      return error(res, `Panchayat ${pCheck?.panchayat_name || 'selected'} has no active officer`, {}, 400);
    }

    let createdRequest = null;
    await withTransaction(async (conn) => {
      const requestNo = await generateRequestNo(conn);

      // Read OVERDUE_DAYS
      const [odRows] = await conn.query(
        `SELECT \`value\` FROM master_data WHERE category = 'SETTING' AND code = 'OVERDUE_DAYS' AND status = 'ACTIVE' LIMIT 1`
      );
      const overdueDays = (odRows && odRows[0]?.value) ? Number(odRows[0].value) : 3;
      const dueAt = new Date(Date.now() + overdueDays * 24 * 60 * 60 * 1000);

      const [vrResult] = await conn.query(
        `INSERT INTO verification_requests (
          request_no, application_id, party_id, requesting_panchayat_id,
          verifying_panchayat_id, requested_by_user_id, subject_party,
          subject_name, subject_aadhaar, subject_details, purpose,
          request_details, status, due_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
        [
          requestNo,
          application_id,
          app.home_panchayat_id,
          verifying_panchayat_id,
          req.user.user_id,
          subject_party,
          subject_name.trim(),
          subject_aadhaar ? subject_aadhaar.trim() : null,
          subject_details ? subject_details.trim() : null,
          purpose ? purpose.trim() : app.purpose,
          request_details ? request_details.trim() : null,
          dueAt
        ]
      );

      // Application status to PENDING_EXTERNAL
      await conn.query(
        'UPDATE applications SET status = "PENDING_EXTERNAL" WHERE application_id = ?',
        [application_id]
      );

      await addTimelineEvent(
        application_id,
        {
          eventType: 'VERIFICATION_REQUEST_SENT',
          title: `Verification request sent to ${pCheck.panchayat_name}`,
          description: `Manual request ${requestNo} created for ${subject_party} (${subject_name})`,
          actorUserId: req.user.user_id
        },
        conn
      );

      await logAction(
        req.user.user_id,
        'CREATE_MANUAL_REQUEST',
        'verification_requests',
        vrResult.insertId,
        `Created manual request ${requestNo} to ${pCheck.panchayat_name}`,
        req
      );

      createdRequest = {
        verification_id: vrResult.insertId,
        request_no: requestNo,
        verifying_panchayat_id,
        status: 'PENDING',
        due_at: dueAt
      };
    });

    // Notify verifying officers (in-app + EMAIL)
    try {
      const [homePanchRows] = await query('SELECT panchayat_name FROM panchayats WHERE panchayat_id = ?', [app.home_panchayat_id]);
      const homePanchName = homePanchRows[0]?.panchayat_name || 'Home Panchayat';
      await notifyPanchayatOfficers(verifying_panchayat_id, {
        type: 'VERIFICATION_REQUEST',
        title: 'New Verification Request',
        message: `Verification request ${createdRequest.request_no} received from ${homePanchName} for ${subject_name} (${subject_party}).`,
        applicationId: application_id,
        verificationId: createdRequest.verification_id,
        email: true
      });
    } catch (err) {
      console.error('Failed to notify verifying officers:', err);
    }

    return success(res, createdRequest, 'Verification request dispatched successfully', 201);
  } catch (err) {
    console.error('Error creating verification request:', err);
    return error(res, 'Failed to create verification request', {}, 500);
  }
}

module.exports = {
  getVerificationRequests,
  getVerificationCounts,
  getVerificationRequestById,
  respondVerificationRequest,
  remindVerificationRequest,
  cancelVerificationRequest,
  checkSignature,
  createVerificationRequest
};
