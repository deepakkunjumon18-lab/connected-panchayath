const fs = require('fs');
const env = require('../config/env');
const { query, withTransaction } = require('../config/db');
const { success, error, paginated } = require('../utils/apiResponse');
const {
  generateApplicationNo,
  generateRequestNo,
  generateCertificateNo,
  generateVerificationCode
} = require('../services/sequence.service');
const { addTimelineEvent, refreshApplicationStatus } = require('../services/application.service');
const { notifyUser, notifyPanchayatOfficers } = require('../services/notification.service');
const { logAction } = require('../services/audit.service');
const cryptoService = require('../services/crypto.service');
const { generateCertificatePdf } = require('../services/certificate.service');

function cleanupFiles(files) {
  if (Array.isArray(files)) {
    for (const f of files) {
      if (f.path && fs.existsSync(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch (e) {
          // ignore cleanup errors
        }
      }
    }
  }
}

/**
 * Submit a new certificate application with uploaded documents
 * POST /api/applications (CITIZEN only, multipart/form-data)
 */
async function createApplication(req, res) {
  try {
    // 1. Parse JSON payloads
    let data = req.body.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (err) {
        cleanupFiles(req.files);
        return error(res, 'Invalid JSON format in "data" field', {}, 400);
      }
    }

    let fileMeta = req.body.fileMeta;
    if (typeof fileMeta === 'string') {
      try {
        fileMeta = JSON.parse(fileMeta);
      } catch (err) {
        cleanupFiles(req.files);
        return error(res, 'Invalid JSON format in "fileMeta" field', {}, 400);
      }
    }

    if (!data || typeof data !== 'object') {
      cleanupFiles(req.files);
      return error(res, 'Application data is required', {}, 400);
    }

    // 2. Validate basic fields
    if (!data.purpose || typeof data.purpose !== 'string' || !data.purpose.trim()) {
      cleanupFiles(req.files);
      return error(res, 'Purpose of application is required', { purpose: 'Purpose is required' }, 400);
    }

    const declaredIncome = Number(data.declared_family_income);
    const landHolding = Number(data.land_holding_cents);
    const houseArea = Number(data.house_area_sqft);

    if (isNaN(declaredIncome) || declaredIncome < 0) {
      cleanupFiles(req.files);
      return error(res, 'Declared family income must be greater than or equal to 0', {}, 400);
    }
    if (isNaN(landHolding) || landHolding < 0) {
      cleanupFiles(req.files);
      return error(res, 'Land holding must be greater than or equal to 0', {}, 400);
    }
    if (isNaN(houseArea) || houseArea < 0) {
      cleanupFiles(req.files);
      return error(res, 'House area must be greater than or equal to 0', {}, 400);
    }

    // 3. Validate files array vs fileMeta
    const uploadedFiles = req.files || [];
    if (!Array.isArray(fileMeta) || fileMeta.length !== uploadedFiles.length) {
      cleanupFiles(uploadedFiles);
      return error(res, 'Document metadata count must match the uploaded files count', {}, 400);
    }

    // 4. Fetch certificate type
    const certTypeRows = await query(
      'SELECT * FROM certificate_types WHERE certificate_type_id = ? AND status = "ACTIVE"',
      [data.certificate_type_id]
    );
    const certType = Array.isArray(certTypeRows) ? certTypeRows[0] : certTypeRows;
    if (!certType) {
      cleanupFiles(uploadedFiles);
      return error(res, 'Invalid or inactive certificate type selected', {}, 400);
    }

    // 5. Validate verification parties
    let requiredParties = [];
    if (typeof certType.verification_parties === 'string') {
      try {
        requiredParties = JSON.parse(certType.verification_parties);
      } catch (e) {
        requiredParties = [];
      }
    } else if (Array.isArray(certType.verification_parties)) {
      requiredParties = certType.verification_parties;
    }

    const submittedParties = Array.isArray(data.parties) ? data.parties : [];
    const partyTypesFound = new Set();

    for (const reqParty of requiredParties) {
      const match = submittedParties.filter((p) => p.party_type === reqParty);
      if (match.length === 0) {
        cleanupFiles(uploadedFiles);
        return error(res, `Required verification party "${reqParty}" is missing`, {}, 400);
      }
      if (match.length > 1) {
        cleanupFiles(uploadedFiles);
        return error(res, `Required verification party "${reqParty}" cannot be specified more than once`, {}, 400);
      }

      const partyObj = match[0];
      if (!partyObj.full_name || !partyObj.full_name.trim()) {
        cleanupFiles(uploadedFiles);
        return error(res, `Full name is required for party "${reqParty}"`, {}, 400);
      }
      if (!partyObj.panchayat_id) {
        cleanupFiles(uploadedFiles);
        return error(res, `Panchayat selection is required for party "${reqParty}"`, {}, 400);
      }

      // Check if panchayat is active AND has at least one active officer
      const pCheckRows = await query(
        `SELECT p.panchayat_id, p.panchayat_name, p.status,
                (SELECT COUNT(*) FROM panchayat_officers po WHERE po.panchayat_id = p.panchayat_id AND po.status = 'ACTIVE') as active_officers
         FROM panchayats p
         WHERE p.panchayat_id = ?`,
        [partyObj.panchayat_id]
      );
      const pCheck = Array.isArray(pCheckRows) ? pCheckRows[0] : pCheckRows;
      if (!pCheck || pCheck.status !== 'ACTIVE' || Number(pCheck.active_officers) === 0) {
        cleanupFiles(uploadedFiles);
        return error(
          res,
          `Panchayat ${pCheck?.panchayat_name || 'selected'} has no active officer`,
          {},
          400
        );
      }
      partyTypesFound.add(reqParty);
    }

    // 6. Validate mandatory documents
    let requiredDocDefs = [];
    if (typeof certType.required_documents === 'string') {
      try {
        requiredDocDefs = JSON.parse(certType.required_documents);
      } catch (e) {
        requiredDocDefs = [];
      }
    } else if (Array.isArray(certType.required_documents)) {
      requiredDocDefs = certType.required_documents;
    }

    const uploadedDocTypes = fileMeta.map((m) => m.document_type);
    const missingDocs = requiredDocDefs
      .filter((d) => d.mandatory)
      .filter((d) => !uploadedDocTypes.includes(d.type));

    if (missingDocs.length > 0) {
      cleanupFiles(uploadedFiles);
      const missingLabels = missingDocs.map((d) => d.label || d.type).join(', ');
      return error(res, `Missing mandatory documents: ${missingLabels}`, {}, 400);
    }

    // 7. Get citizen details
    const citRows = await query(
      'SELECT citizen_id, panchayat_id, full_name, aadhaar_no FROM citizens WHERE user_id = ?',
      [req.user.user_id]
    );
    const citizen = Array.isArray(citRows) ? citRows[0] : citRows;
    if (!citizen) {
      cleanupFiles(uploadedFiles);
      return error(res, 'Citizen record not found for user', {}, 404);
    }

    const homePanchayatId = citizen.panchayat_id;
    const homePanchRows = await query(
      'SELECT panchayat_name FROM panchayats WHERE panchayat_id = ?',
      [homePanchayatId]
    );
    const homePanchayatName = (Array.isArray(homePanchRows) ? homePanchRows[0] : homePanchRows)?.panchayat_name || 'Home Panchayat';

    // 8. Execute in Transaction
    let resultPayload = null;
    const notificationsToDispatch = [];

    await withTransaction(async (conn) => {
      // (a) Generate application number
      const applicationNo = await generateApplicationNo(certType.certificate_code, conn);

      // (b) Insert application
      const [appResult] = await conn.query(
        `INSERT INTO applications (
          application_no, citizen_id, certificate_type_id, home_panchayat_id,
          purpose, declared_family_income, land_holding_cents, house_area_sqft,
          other_property_details, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`,
        [
          applicationNo,
          citizen.citizen_id,
          certType.certificate_type_id,
          homePanchayatId,
          data.purpose.trim(),
          declaredIncome,
          landHolding,
          houseArea,
          data.other_property_details ? data.other_property_details.trim() : null
        ]
      );
      const applicationId = appResult.insertId;

      // (c) Read OVERDUE_DAYS from master_data
      const [overdueRows] = await conn.query(
        `SELECT \`value\` FROM master_data WHERE category = 'SETTING' AND code = 'OVERDUE_DAYS' AND status = 'ACTIVE' LIMIT 1`
      );
      const overdueDays = (overdueRows && overdueRows[0]?.value) ? Number(overdueRows[0].value) : 3;
      const dueAt = new Date(Date.now() + overdueDays * 24 * 60 * 60 * 1000);

      // (d) Insert parties & verification requests
      const createdRequests = [];
      for (const party of submittedParties) {
        const isExternal = Number(party.panchayat_id) !== Number(homePanchayatId);
        const verificationRequired = isExternal ? 1 : 0;

        const [partyResult] = await conn.query(
          `INSERT INTO application_parties (
            application_id, party_type, full_name, aadhaar_no, occupation,
            annual_income, property_details, panchayat_id, verification_required
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            applicationId,
            party.party_type,
            party.full_name.trim(),
            party.aadhaar_no ? party.aadhaar_no.trim() : null,
            party.occupation ? party.occupation.trim() : null,
            Number(party.annual_income) || 0,
            party.property_details ? party.property_details.trim() : null,
            party.panchayat_id,
            verificationRequired
          ]
        );
        const partyId = partyResult.insertId;

        if (verificationRequired === 1) {
          const requestNo = await generateRequestNo(conn);
          const requestDetails = `Please verify that ${party.full_name.trim()} (${party.party_type} of applicant ${citizen.full_name}) is registered in your panchayat and confirm the declared occupation ${party.occupation || 'N/A'}, annual income Rs ${party.annual_income || 0} and property details ${party.property_details || 'N/A'} for the purpose of ${certType.certificate_name}.`;

          const [vrResult] = await conn.query(
            `INSERT INTO verification_requests (
              request_no, application_id, party_id, requesting_panchayat_id,
              verifying_panchayat_id, requested_by_user_id, subject_party,
              subject_name, subject_aadhaar, subject_details, purpose,
              request_details, status, due_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
            [
              requestNo,
              applicationId,
              partyId,
              homePanchayatId,
              party.panchayat_id,
              req.user.user_id,
              party.party_type,
              party.full_name.trim(),
              party.aadhaar_no ? party.aadhaar_no.trim() : null,
              party.property_details ? party.property_details.trim() : null,
              data.purpose.trim(),
              requestDetails,
              dueAt
            ]
          );

          createdRequests.push({
            verification_id: vrResult.insertId,
            request_no: requestNo,
            verifying_panchayat_id: party.panchayat_id,
            subject_name: party.full_name.trim(),
            subject_party: party.party_type
          });
        }
      }

      // (e) Insert documents
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const meta = fileMeta[i] || {};
        await conn.query(
          `INSERT INTO application_documents (
            application_id, document_type, document_name, related_to,
            original_file_name, file_path, mime_type, file_size, verification_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
          [
            applicationId,
            meta.document_type || 'OTHER',
            meta.document_name || file.originalname,
            meta.related_to || 'APPLICANT',
            file.originalname,
            file.path,
            file.mimetype,
            file.size
          ]
        );
      }

      // (f) Set application status
      let finalStatus = 'SUBMITTED';
      if (createdRequests.length > 0) {
        finalStatus = 'PENDING_EXTERNAL';
        await conn.query(
          'UPDATE applications SET status = "PENDING_EXTERNAL" WHERE application_id = ?',
          [applicationId]
        );
      }

      // (g) Add timeline events
      await addTimelineEvent(
        applicationId,
        {
          eventType: 'APPLICATION_SUBMITTED',
          title: 'Application submitted',
          description: `Application submitted by ${citizen.full_name}`,
          actorUserId: req.user.user_id
        },
        conn
      );

      for (const cr of createdRequests) {
        const [vpRows] = await conn.query(
          'SELECT panchayat_name FROM panchayats WHERE panchayat_id = ?',
          [cr.verifying_panchayat_id]
        );
        const vpName = vpRows && vpRows[0] ? vpRows[0].panchayat_name : 'Verifying Panchayat';
        await addTimelineEvent(
          applicationId,
          {
            eventType: 'VERIFICATION_REQUEST_SENT',
            title: `Verification request sent to ${vpName}`,
            description: `Request ${cr.request_no} sent for ${cr.subject_party} (${cr.subject_name})`,
            actorUserId: req.user.user_id
          },
          conn
        );
      }

      // (h) Audit log
      await logAction(
        req.user.user_id,
        'CREATE_APPLICATION',
        'applications',
        applicationId,
        `Application ${applicationNo} (${certType.certificate_name}) submitted`,
        req
      );

      resultPayload = {
        application_id: applicationId,
        application_no: applicationNo,
        status: finalStatus,
        created_requests_count: createdRequests.length
      };

      // Queue notifications for after commit
      notificationsToDispatch.push({
        type: 'HOME_OFFICERS',
        panchayatId: homePanchayatId,
        applicationId,
        applicationNo,
        certName: certType.certificate_name,
        citizenName: citizen.full_name
      });

      for (const cr of createdRequests) {
        notificationsToDispatch.push({
          type: 'VERIFYING_OFFICERS',
          panchayatId: cr.verifying_panchayat_id,
          applicationId,
          verificationId: cr.verification_id,
          requestNo: cr.request_no,
          subjectName: cr.subject_name,
          subjectParty: cr.subject_party,
          homePanchayatName
        });
      }

      notificationsToDispatch.push({
        type: 'CITIZEN',
        userId: req.user.user_id,
        applicationId,
        applicationNo,
        certName: certType.certificate_name
      });
    });

    // 9. Dispatch notifications (outside transaction so failure doesn't roll back DB)
    for (const notif of notificationsToDispatch) {
      try {
        if (notif.type === 'HOME_OFFICERS') {
          await notifyPanchayatOfficers(notif.panchayatId, {
            type: 'NEW_APPLICATION',
            title: 'New Application Received',
            message: `New application ${notif.applicationNo} (${notif.certName}) submitted by ${notif.citizenName}.`,
            applicationId: notif.applicationId,
            email: false
          });
        } else if (notif.type === 'VERIFYING_OFFICERS') {
          await notifyPanchayatOfficers(notif.panchayatId, {
            type: 'VERIFICATION_REQUEST',
            title: 'New Verification Request',
            message: `Verification request ${notif.requestNo} received from ${notif.homePanchayatName} for ${notif.subjectName} (${notif.subjectParty}).`,
            applicationId: notif.applicationId,
            verificationId: notif.verificationId,
            email: true
          });
        } else if (notif.type === 'CITIZEN') {
          await notifyUser({
            userId: notif.userId,
            type: 'APPLICATION_SUBMITTED',
            title: 'Application Submitted',
            message: `Your application ${notif.applicationNo} for ${notif.certName} has been submitted successfully.`,
            applicationId: notif.applicationId,
            email: false
          });
        }
      } catch (err) {
        console.error('Failed to dispatch notification:', err);
      }
    }

    return success(res, resultPayload, 'Application submitted successfully', 201);
  } catch (err) {
    cleanupFiles(req.files);
    console.error('Error creating application:', err);
    return error(res, 'Failed to submit application: ' + err.message, {}, 500);
  }
}

/**
 * List applications with role-based scoping and filters
 * GET /api/applications?status&search&page&limit
 */
async function getApplications(req, res) {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const userRole = req.user.role;
    let whereClauses = [];
    const params = [];

    // Role-based scoping (Section 4)
    if (userRole === 'CITIZEN') {
      const citRows = await query('SELECT citizen_id FROM citizens WHERE user_id = ?', [req.user.user_id]);
      const citizen = Array.isArray(citRows) ? citRows[0] : citRows;
      if (!citizen) {
        return paginated(res, [], 0, pageNum, limitNum);
      }
      whereClauses.push('a.citizen_id = ?');
      params.push(citizen.citizen_id);
    } else if (userRole === 'OFFICER') {
      whereClauses.push('a.home_panchayat_id = ?');
      params.push(req.user.panchayat_id);
    }
    // ADMIN sees all, so no role restriction added

    if (status && status !== 'undefined' && status !== 'null') {
      whereClauses.push('a.status = ?');
      params.push(status);
    }

    if (search && search !== 'undefined' && search !== 'null') {
      whereClauses.push('(a.application_no LIKE ? OR ct.certificate_name LIKE ? OR cit.full_name LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM applications a
      JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
      JOIN citizens cit ON a.citizen_id = cit.citizen_id
      ${whereSql}
    `;
    const countRows = await query(countSql, params);
    const total = countRows && countRows[0] ? Number(countRows[0].total) : 0;

    // Data query
    const dataSql = `
      SELECT a.application_id, a.application_no, a.status, a.submitted_at, a.purpose,
             a.home_panchayat_id, p.panchayat_name, p.panchayat_code,
             ct.certificate_type_id, ct.certificate_name, ct.certificate_code,
             cit.full_name as applicant_name,
             (SELECT COUNT(*) FROM verification_requests vr WHERE vr.application_id = a.application_id AND vr.status = 'PENDING') as pending_requests_count,
             (SELECT COUNT(*) FROM verification_requests vr WHERE vr.application_id = a.application_id) as total_requests_count,
             c.certificate_id, c.certificate_no, c.issue_date, c.valid_until, c.verification_code
      FROM applications a
      JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
      JOIN panchayats p ON a.home_panchayat_id = p.panchayat_id
      JOIN citizens cit ON a.citizen_id = cit.citizen_id
      LEFT JOIN certificates c ON a.application_id = c.application_id AND c.status = 'ACTIVE'
      ${whereSql}
      ORDER BY a.submitted_at DESC, a.application_id DESC
      LIMIT ? OFFSET ?
    `;

    const rawItems = await query(dataSql, [...params, limitNum, offset]);
    const items = (rawItems || []).map((app) => ({
      ...app,
      certificate: app.certificate_id ? {
        certificate_id: app.certificate_id,
        certificate_no: app.certificate_no,
        issue_date: app.issue_date,
        valid_until: app.valid_until,
        verification_code: app.verification_code
      } : null
    }));
    return paginated(res, items, total, pageNum, limitNum);
  } catch (err) {
    console.error('Error fetching applications:', err);
    return error(res, 'Failed to fetch applications', {}, 500);
  }
}

/**
 * Get detailed application by ID
 * GET /api/applications/:id
 */
async function getApplicationById(req, res) {
  try {
    const applicationId = Number(req.params.id);
    if (!applicationId) {
      return error(res, 'Application not found', {}, 404);
    }

    // 1. Fetch application with joined names
    const appRows = await query(
      `SELECT a.*,
              ct.certificate_name, ct.certificate_code, ct.description as certificate_description, ct.validity_months,
              p.panchayat_name as home_panchayat_name, p.panchayat_code as home_panchayat_code, p.district as home_district
       FROM applications a
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN panchayats p ON a.home_panchayat_id = p.panchayat_id
       WHERE a.application_id = ?`,
      [applicationId]
    );
    const app = Array.isArray(appRows) ? appRows[0] : appRows;
    if (!app) {
      return error(res, 'Application not found', {}, 404);
    }

    // 2. Permission check (Section 4)
    const userRole = req.user.role;
    if (userRole === 'CITIZEN') {
      const citRows = await query('SELECT citizen_id FROM citizens WHERE user_id = ?', [req.user.user_id]);
      const citizen = Array.isArray(citRows) ? citRows[0] : citRows;
      if (!citizen || citizen.citizen_id !== app.citizen_id) {
        return error(res, 'Application not found', {}, 404);
      }
    } else if (userRole === 'OFFICER') {
      if (Number(req.user.panchayat_id) !== Number(app.home_panchayat_id)) {
        return error(res, 'Application not found', {}, 404);
      }
    }

    // 3. Citizen details (masked Aadhaar)
    const citRows = await query(
      `SELECT cit.citizen_id, cit.full_name, cit.date_of_birth, cit.gender,
              cit.aadhaar_no, cit.mobile, cit.email, cit.address,
              p.panchayat_name, p.panchayat_code
       FROM citizens cit
       JOIN panchayats p ON cit.panchayat_id = p.panchayat_id
       WHERE cit.citizen_id = ?`,
      [app.citizen_id]
    );
    const citizen = Array.isArray(citRows) ? citRows[0] : citRows;
    const maskedAadhaar = citizen?.aadhaar_no
      ? `XXXX XXXX ${citizen.aadhaar_no.slice(-4)}`
      : 'XXXX XXXX 1234';

    // 4. Parties with verification request status
    const partyRows = await query(
      `SELECT ap.party_id, ap.party_type, ap.full_name, ap.aadhaar_no, ap.occupation,
              ap.annual_income, ap.property_details, ap.panchayat_id, ap.verification_required,
              p.panchayat_name, p.panchayat_code,
              vr.verification_id, vr.request_no, vr.status as request_status,
              vr.response_remarks, vr.due_at, vr.response_date
       FROM application_parties ap
       JOIN panchayats p ON ap.panchayat_id = p.panchayat_id
       LEFT JOIN verification_requests vr ON ap.party_id = vr.party_id
       WHERE ap.application_id = ?
       ORDER BY ap.party_id ASC`,
      [applicationId]
    );

    const parties = (partyRows || []).map((p) => ({
      ...p,
      aadhaar_no: p.aadhaar_no ? `XXXX XXXX ${p.aadhaar_no.slice(-4)}` : null
    }));

    // 5. Documents (EXCLUDING file_path per section 9, with needs_home_verification)
    const docRows = await query(
      `SELECT document_id, document_type, document_name, related_to, original_file_name,
              mime_type, file_size, verification_status, verification_remarks, uploaded_at, verified_at
       FROM application_documents
       WHERE application_id = ?
       ORDER BY document_id ASC`,
      [applicationId]
    );

    const documents = (docRows || []).map((doc) => {
      let needsHome = true;
      if (doc.related_to && doc.related_to !== 'APPLICANT' && doc.related_to !== 'OTHER') {
        const matchingParty = parties.find((p) => p.party_type === doc.related_to);
        if (matchingParty && Number(matchingParty.panchayat_id) !== Number(app.home_panchayat_id)) {
          needsHome = false;
        }
      }
      return {
        ...doc,
        needs_home_verification: needsHome
      };
    });

    // 6. Requests (including signature_check and signature_summary)
    const vrRows = await query(
      `SELECT vr.*,
              vp.panchayat_name as verifying_panchayat_name, vp.panchayat_code as verifying_panchayat_code,
              po.full_name as signer_name
       FROM verification_requests vr
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       LEFT JOIN panchayat_officers po ON vr.responded_by_officer_id = po.officer_id
       WHERE vr.application_id = ?
       ORDER BY vr.verification_id ASC`,
      [applicationId]
    );

    const requests = (vrRows || []).map((r) => {
      let signatureCheck = null;
      if (r.signed_at && r.signature) {
        signatureCheck = cryptoService.verifyRequestSignature(r);
      }
      return {
        verification_id: r.verification_id,
        request_no: r.request_no,
        party_id: r.party_id,
        verifying_panchayat_id: r.verifying_panchayat_id,
        verifying_panchayat_name: r.verifying_panchayat_name,
        verifying_panchayat_code: r.verifying_panchayat_code,
        subject_party: r.subject_party,
        subject_name: r.subject_name,
        purpose: r.purpose,
        request_details: r.request_details,
        status: r.status,
        request_date: r.request_date,
        due_at: r.due_at,
        response_date: r.response_date,
        response_remarks: r.response_remarks,
        reminder_count: r.reminder_count,
        last_reminder_at: r.last_reminder_at,
        signed_at: r.signed_at,
        signer_name: r.signer_name || null,
        signer_key_fingerprint: r.signer_key_fingerprint || null,
        signer_public_key: r.signer_public_key || null,
        payload_json: r.payload_json || null,
        payload_hash: r.payload_hash || null,
        signature: r.signature || null,
        signature_summary: {
          signed: !!r.signed_at,
          signer_name: r.signer_name || null,
          signed_at: r.signed_at || null,
          valid: signatureCheck ? signatureCheck.valid : false
        },
        signature_check: signatureCheck
      };
    });

    // Compute blockers (Section 13)
    const blockers = [];
    const pendingRequests = requests.filter((r) => r.status === 'PENDING');
    if (app.status === 'PENDING_EXTERNAL' || pendingRequests.length > 0) {
      if (pendingRequests.length > 0) {
        blockers.push(`Waiting for ${pendingRequests.length} verification request(s) from other panchayats`);
      }
    }

    const unverifiedHomeDocs = documents.filter(
      (doc) => doc.needs_home_verification && doc.verification_status !== 'VERIFIED'
    );
    if (unverifiedHomeDocs.length > 0) {
      blockers.push(`${unverifiedHomeDocs.length} document(s) still need verification`);
    }

    const rejectedDocs = documents.filter((doc) => doc.verification_status === 'REJECTED');
    if (rejectedDocs.length > 0) {
      blockers.push('A document was rejected');
    }

    const rejectedRequests = requests.filter((r) => r.status === 'REJECTED');
    for (const r of rejectedRequests) {
      blockers.push(`Request ${r.request_no} was rejected by ${r.verifying_panchayat_name || 'verifying panchayat'}`);
    }

    const approvedRequests = requests.filter((r) => r.status === 'APPROVED');
    for (const r of approvedRequests) {
      if (r.signature_check && !r.signature_check.valid) {
        blockers.push(`Signature on ${r.request_no} is INVALID`);
      }
    }

    if (!['SUBMITTED', 'READY_FOR_DECISION'].includes(app.status)) {
      blockers.push(`Application is already ${app.status}`);
    }

    const can_approve = blockers.length === 0;
    const can_reject = !['APPROVED', 'REJECTED', 'CERTIFICATE_ISSUED'].includes(app.status);

    // 7. Timeline events
    const timelineRows = await query(
      `SELECT event_id, event_type, title, description, created_at
       FROM application_timeline
       WHERE application_id = ?
       ORDER BY created_at ASC, event_id ASC`,
      [applicationId]
    );

    // 8. Certificate details if any
    let certificate = null;
    const certRows = await query(
      `SELECT certificate_id, certificate_no, issue_date, valid_until, verification_code, status
       FROM certificates
       WHERE application_id = ? AND status = 'ACTIVE' LIMIT 1`,
      [applicationId]
    );
    if (certRows && certRows.length > 0) {
      certificate = certRows[0];
    }

    return success(res, {
      application: {
        application_id: app.application_id,
        application_no: app.application_no,
        status: app.status,
        purpose: app.purpose,
        declared_family_income: app.declared_family_income,
        land_holding_cents: app.land_holding_cents,
        house_area_sqft: app.house_area_sqft,
        other_property_details: app.other_property_details,
        submitted_at: app.submitted_at,
        remarks: app.remarks
      },
      citizen: {
        citizen_id: citizen.citizen_id,
        full_name: citizen.full_name,
        email: citizen.email,
        mobile: citizen.mobile,
        address: citizen.address,
        aadhaar_no: maskedAadhaar,
        date_of_birth: citizen.date_of_birth,
        gender: citizen.gender,
        panchayat_name: citizen.panchayat_name,
        panchayat_code: citizen.panchayat_code
      },
      certificate_type: {
        certificate_type_id: app.certificate_type_id,
        certificate_name: app.certificate_name,
        certificate_code: app.certificate_code,
        description: app.certificate_description,
        validity_months: app.validity_months
      },
      home_panchayat: {
        panchayat_id: app.home_panchayat_id,
        panchayat_name: app.home_panchayat_name,
        panchayat_code: app.home_panchayat_code,
        district: app.home_district
      },
      parties: parties || [],
      documents,
      requests,
      timeline: timelineRows || [],
      certificate,
      blockers: userRole === 'OFFICER' ? blockers : null,
      can_approve: userRole === 'OFFICER' ? can_approve : false,
      can_reject: userRole === 'OFFICER' ? can_reject : false
    }, 'Application retrieved successfully');
  } catch (err) {
    console.error('Error fetching application by id:', err);
    return error(res, 'Failed to fetch application details', {}, 500);
  }
}

/**
 * Public tracking of an application by application_no
 * GET /api/applications/track/:appNo
 */
async function trackApplication(req, res) {
  try {
    const { appNo } = req.params;
    if (!appNo) {
      return error(res, 'Application number is required', {}, 400);
    }

    const appRows = await query(
      `SELECT a.application_id, a.application_no, a.status, a.submitted_at,
              ct.certificate_name as certificate_type_name, ct.certificate_code as certificate_type_code,
              p.panchayat_name
       FROM applications a
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN panchayats p ON a.home_panchayat_id = p.panchayat_id
       WHERE a.application_no = ?`,
      [appNo.trim()]
    );

    const app = Array.isArray(appRows) ? appRows[0] : appRows;
    if (!app) {
      return error(res, 'Application not found with the provided number', {}, 404);
    }

    const timelineRows = await query(
      `SELECT title, event_type, created_at
       FROM application_timeline
       WHERE application_id = ?
       ORDER BY created_at ASC, event_id ASC`,
      [app.application_id]
    );

    let certificate = null;
    if (app.status === 'CERTIFICATE_ISSUED') {
      const certRows = await query(
        `SELECT certificate_id, certificate_no, verification_code, issue_date
         FROM certificates
         WHERE application_id = ? AND status = 'ACTIVE' LIMIT 1`,
        [app.application_id]
      );
      const cert = Array.isArray(certRows) ? certRows[0] : certRows;
      if (cert) {
        certificate = {
          certificate_id: cert.certificate_id,
          certificate_no: cert.certificate_no,
          verification_code: cert.verification_code,
          issue_date: cert.issue_date
        };
      }
    }

    return success(res, {
      application_no: app.application_no,
      certificate_type_name: app.certificate_type_name,
      certificate_type_code: app.certificate_type_code,
      panchayat_name: app.panchayat_name,
      status: app.status,
      submitted_at: app.submitted_at,
      timeline: timelineRows || [],
      certificate
    }, 'Application status retrieved successfully');
  } catch (err) {
    console.error('Error tracking application:', err);
    return error(res, 'Failed to track application', {}, 500);
  }
}

/**
 * Verify or reject an uploaded document
 * PATCH /api/applications/:id/documents/:docId/verify
 */
async function verifyDocument(req, res) {
  try {
    const applicationId = Number(req.params.id);
    const documentId = Number(req.params.docId);
    const { status: newStatus, remarks } = req.body;

    if (!['VERIFIED', 'REJECTED'].includes(newStatus)) {
      return error(res, 'Status must be either VERIFIED or REJECTED', {}, 400);
    }

    if (newStatus === 'REJECTED' && (!remarks || !remarks.trim())) {
      return error(res, 'Remarks are required when rejecting a document', {}, 400);
    }

    // Check application
    const appRows = await query(
      'SELECT application_id, application_no, home_panchayat_id, status FROM applications WHERE application_id = ?',
      [applicationId]
    );
    const app = appRows && appRows[0];
    if (!app) {
      return error(res, 'Application not found', {}, 404);
    }

    if (req.user.role !== 'OFFICER' || Number(req.user.panchayat_id) !== Number(app.home_panchayat_id)) {
      return error(res, 'Only officers of the home panchayat can verify documents', {}, 403);
    }

    if (['APPROVED', 'REJECTED', 'CERTIFICATE_ISSUED'].includes(app.status)) {
      return error(res, `Cannot modify documents for application with status ${app.status}`, {}, 400);
    }

    // Check document
    const docRows = await query(
      'SELECT * FROM application_documents WHERE document_id = ? AND application_id = ?',
      [documentId, applicationId]
    );
    const doc = docRows && docRows[0];
    if (!doc) {
      return error(res, 'Document not found for this application', {}, 404);
    }

    // Get officer record
    const offRows = await query(
      'SELECT officer_id, full_name FROM panchayat_officers WHERE user_id = ?',
      [req.user.user_id]
    );
    const officer = offRows && offRows[0];
    if (!officer) {
      return error(res, 'Officer record not found', {}, 403);
    }

    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE application_documents
         SET verification_status = ?,
             verification_remarks = ?,
             verified_by_officer_id = ?,
             verified_at = NOW()
         WHERE document_id = ?`,
        [newStatus, remarks ? remarks.trim() : null, officer.officer_id, documentId]
      );

      await addTimelineEvent(
        applicationId,
        {
          eventType: newStatus === 'VERIFIED' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
          title: `Document ${doc.document_name} ${newStatus.toLowerCase()}`,
          description: `By ${officer.full_name}${remarks ? ': ' + remarks.trim() : ''}`,
          actorUserId: req.user.user_id
        },
        conn
      );

      await refreshApplicationStatus(applicationId, conn);

      await logAction(
        req.user.user_id,
        newStatus === 'VERIFIED' ? 'VERIFY_DOCUMENT' : 'REJECT_DOCUMENT',
        'application_documents',
        documentId,
        `Document ${doc.document_name} ${newStatus.toLowerCase()} for application ${app.application_no}`,
        req
      );
    });

    const updatedDocRows = await query(
      `SELECT document_id, document_type, document_name, related_to, original_file_name,
              mime_type, file_size, verification_status, verification_remarks, uploaded_at, verified_at
       FROM application_documents
       WHERE document_id = ?`,
      [documentId]
    );

    return success(res, updatedDocRows[0], `Document ${newStatus.toLowerCase()} successfully`);
  } catch (err) {
    console.error('Error verifying document:', err);
    return error(res, 'Failed to update document verification status', {}, 500);
  }
}

/**
 * Officer decision (Approve or Reject) on an application
 * POST /api/applications/:id/decision
 */
async function decideApplication(req, res) {
  try {
    const applicationId = Number(req.params.id);
    let { decision, remarks } = req.body;
    if (decision === 'APPROVE') decision = 'APPROVED';
    if (decision === 'REJECT') decision = 'REJECTED';

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return error(res, 'Decision must be either APPROVED or REJECTED', {}, 400);
    }

    if (decision === 'REJECTED' && (!remarks || !remarks.trim())) {
      return error(res, 'A reason is required when rejecting an application', {}, 400);
    }

    // Check application
    const appRows = await query(
      `SELECT a.*, ct.certificate_name, cit.user_id as citizen_user_id, cit.full_name as citizen_name
       FROM applications a
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN citizens cit ON a.citizen_id = cit.citizen_id
       WHERE a.application_id = ?`,
      [applicationId]
    );
    const app = appRows && appRows[0];
    if (!app) {
      return error(res, 'Application not found', {}, 404);
    }

    if (req.user.role !== 'OFFICER' || Number(req.user.panchayat_id) !== Number(app.home_panchayat_id)) {
      return error(res, 'Only officers of the home panchayat can decide on applications', {}, 403);
    }

    if (['APPROVED', 'REJECTED', 'CERTIFICATE_ISSUED'].includes(app.status)) {
      return error(res, `Application is already ${app.status}`, {}, 400);
    }

    // If decision === 'APPROVED', check all blockers
    if (decision === 'APPROVED') {
      const parties = await query(
        'SELECT party_type, panchayat_id FROM application_parties WHERE application_id = ?',
        [applicationId]
      );
      const docs = await query(
        'SELECT document_id, related_to, verification_status FROM application_documents WHERE application_id = ?',
        [applicationId]
      );
      const reqs = await query(
        `SELECT vr.*, vp.panchayat_name as verifying_panchayat_name
         FROM verification_requests vr
         JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
         WHERE vr.application_id = ?`,
        [applicationId]
      );

      const computedRequests = (reqs || []).map((r) => {
        let signatureCheck = null;
        if (r.signed_at && r.signature) {
          signatureCheck = cryptoService.verifyRequestSignature(r);
        }
        return {
          ...r,
          signature_check: signatureCheck
        };
      });

      const partyHomeMap = {};
      (parties || []).forEach((p) => {
        partyHomeMap[p.party_type] = Number(p.panchayat_id) === Number(app.home_panchayat_id);
      });

      const computedDocs = (docs || []).map((d) => {
        let needsHome = true;
        if (d.related_to && d.related_to !== 'APPLICANT' && d.related_to !== 'OTHER') {
          if (partyHomeMap[d.related_to] === false) {
            needsHome = false;
          }
        }
        return {
          ...d,
          needs_home_verification: needsHome
        };
      });

      const blockers = [];
      const pendingReqs = computedRequests.filter((r) => r.status === 'PENDING');
      if (app.status === 'PENDING_EXTERNAL' || pendingReqs.length > 0) {
        if (pendingReqs.length > 0) {
          blockers.push(`Waiting for ${pendingReqs.length} verification request(s) from other panchayats`);
        }
      }

      const unverifiedHomeDocs = computedDocs.filter(
        (d) => d.needs_home_verification && d.verification_status !== 'VERIFIED'
      );
      if (unverifiedHomeDocs.length > 0) {
        blockers.push(`${unverifiedHomeDocs.length} document(s) still need verification`);
      }

      const rejectedDocs = computedDocs.filter((d) => d.verification_status === 'REJECTED');
      if (rejectedDocs.length > 0) {
        blockers.push('A document was rejected');
      }

      const rejectedReqs = computedRequests.filter((r) => r.status === 'REJECTED');
      for (const r of rejectedReqs) {
        blockers.push(`Request ${r.request_no} was rejected by ${r.verifying_panchayat_name || 'verifying panchayat'}`);
      }

      const approvedReqs = computedRequests.filter((r) => r.status === 'APPROVED');
      for (const r of approvedReqs) {
        if (r.signature_check && !r.signature_check.valid) {
          blockers.push(`Signature on ${r.request_no} is INVALID`);
        }
      }

      if (!['SUBMITTED', 'READY_FOR_DECISION'].includes(app.status)) {
        blockers.push(`Application is already ${app.status}`);
      }

      if (blockers.length > 0) {
        return error(res, `Cannot approve: ${blockers[0]}`, { blockers }, 400);
      }
    }

    // Get officer record
    const offRows = await query(
      'SELECT officer_id, full_name FROM panchayat_officers WHERE user_id = ?',
      [req.user.user_id]
    );
    const officer = offRows && offRows[0];
    if (!officer) {
      return error(res, 'Officer record not found', {}, 403);
    }

    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE applications
         SET status = ?,
             remarks = ?,
             decided_by_officer_id = ?,
             decided_at = NOW()
         WHERE application_id = ?`,
        [decision, remarks ? remarks.trim() : null, officer.officer_id, applicationId]
      );

      await addTimelineEvent(
        applicationId,
        {
          eventType: decision === 'APPROVED' ? 'APPLICATION_APPROVED' : 'APPLICATION_REJECTED',
          title: `Application ${decision.toLowerCase()}`,
          description: `By ${officer.full_name}${remarks ? ': ' + remarks.trim() : ''}`,
          actorUserId: req.user.user_id
        },
        conn
      );

      await logAction(
        req.user.user_id,
        'APPLICATION_' + decision,
        'applications',
        applicationId,
        `Application ${app.application_no} ${decision.toLowerCase()} by officer ${officer.full_name}`,
        req
      );
    });

    // Notify citizen outside transaction
    try {
      await notifyUser({
        userId: app.citizen_user_id,
        type: 'APPLICATION_' + decision,
        title: `Application ${decision === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message: `Your application ${app.application_no} for ${app.certificate_name} has been ${decision.toLowerCase()}.${remarks ? ' Reason: ' + remarks.trim() : ''}`,
        applicationId,
        email: true
      });
    } catch (err) {
      console.error('Failed to dispatch notification to citizen:', err);
    }

    return success(
      res,
      {
        application_id: applicationId,
        application_no: app.application_no,
        status: decision,
        remarks: remarks ? remarks.trim() : null
      },
      `Application ${decision.toLowerCase()} successfully`
    );
  } catch (err) {
    console.error('Error deciding on application:', err);
    return error(res, 'Failed to process application decision', {}, 500);
  }
}

/**
 * Issue official certificate PDF for an APPROVED application
 * POST /api/applications/:id/issue-certificate (Home Officer only)
 */
async function issueCertificate(req, res) {
  try {
    const applicationId = Number(req.params.id);
    if (!applicationId) {
      return error(res, 'Application not found', {}, 404);
    }

    // 1. Fetch application details
    const appRows = await query(
      `SELECT a.*,
              ct.certificate_name, ct.certificate_code, ct.validity_months,
              p.panchayat_name, p.panchayat_code, p.district,
              cit.user_id as citizen_user_id, cit.full_name as citizen_name, cit.aadhaar_no as citizen_aadhaar,
              cit.date_of_birth, cit.gender, cit.address as citizen_address
       FROM applications a
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN panchayats p ON a.home_panchayat_id = p.panchayat_id
       JOIN citizens cit ON a.citizen_id = cit.citizen_id
       WHERE a.application_id = ?`,
      [applicationId]
    );

    const app = appRows && appRows[0];
    if (!app) {
      return error(res, 'Application not found', {}, 404);
    }

    // Permission: Only active officers of the application's home panchayat
    if (req.user.role !== 'OFFICER' || Number(req.user.panchayat_id) !== Number(app.home_panchayat_id)) {
      return error(res, 'Only officers of the home panchayat can issue certificates', {}, 403);
    }

    // Application status check: must be APPROVED, else 409
    if (app.status !== 'APPROVED') {
      return error(
        res,
        `Application must be in APPROVED status to issue certificate (current status: ${app.status})`,
        {},
        409
      );
    }

    // Check if certificate already issued
    const existingCertRows = await query(
      'SELECT certificate_id, certificate_no FROM certificates WHERE application_id = ?',
      [applicationId]
    );
    if (existingCertRows && existingCertRows.length > 0) {
      return error(
        res,
        `Certificate has already been issued for this application (${existingCertRows[0].certificate_no})`,
        {},
        409
      );
    }

    // Fetch officer record
    const offRows = await query(
      'SELECT officer_id, full_name, designation FROM panchayat_officers WHERE user_id = ?',
      [req.user.user_id]
    );
    const officer = offRows && offRows[0];
    if (!officer) {
      return error(res, 'Officer profile not found', {}, 403);
    }

    // Fetch parties and verified requests for PDF generation
    const parties = await query(
      'SELECT * FROM application_parties WHERE application_id = ?',
      [applicationId]
    );

    const verifiedRequests = await query(
      `SELECT vr.*, vp.panchayat_name as verifying_panchayat_name, po.full_name as signer_name
       FROM verification_requests vr
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       LEFT JOIN panchayat_officers po ON vr.responded_by_officer_id = po.officer_id
       WHERE vr.application_id = ? AND vr.status = 'APPROVED'
       ORDER BY vr.verification_id ASC`,
      [applicationId]
    );

    let createdCert = null;

    // Execute in transaction
    await withTransaction(async (conn) => {
      // Generate certificate_no and verification_code
      const certificateNo = await generateCertificateNo(app.panchayat_code, conn);
      const verificationCode = generateVerificationCode();

      const issueDate = new Date().toISOString().slice(0, 10);
      const validityMonths = app.validity_months || 12;
      const validUntilDate = new Date();
      validUntilDate.setMonth(validUntilDate.getMonth() + validityMonths);
      const validUntil = validUntilDate.toISOString().slice(0, 10);

      // Generate the PDF
      const pdfMeta = await generateCertificatePdf({
        certificateNo,
        verificationCode,
        issueDate,
        validUntil,
        application: {
          ...app,
          parties: parties || []
        },
        citizen: {
          full_name: app.citizen_name,
          aadhaar_no: app.citizen_aadhaar,
          date_of_birth: app.date_of_birth,
          gender: app.gender,
          address: app.citizen_address
        },
        certificateType: {
          certificate_name: app.certificate_name,
          certificate_code: app.certificate_code
        },
        issuingPanchayat: {
          panchayat_name: app.panchayat_name,
          panchayat_code: app.panchayat_code,
          district: app.district
        },
        issuingOfficer: {
          full_name: officer.full_name,
          designation: officer.designation
        },
        verifiedRequests: verifiedRequests || []
      });

      // Insert into certificates table
      const [insertResult] = await conn.query(
        `INSERT INTO certificates (
           certificate_no, application_id, certificate_type_id, citizen_id,
           issued_by_officer_id, issuing_panchayat_id, issue_date, valid_until,
           certificate_file, verification_code, certificate_hash, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [
          certificateNo,
          applicationId,
          app.certificate_type_id,
          app.citizen_id,
          officer.officer_id,
          app.home_panchayat_id,
          issueDate,
          validUntil,
          pdfMeta.file_path,
          verificationCode,
          pdfMeta.certificate_hash
        ]
      );

      const certificateId = insertResult.insertId;

      // Update application status to CERTIFICATE_ISSUED
      await conn.query(
        'UPDATE applications SET status = "CERTIFICATE_ISSUED" WHERE application_id = ?',
        [applicationId]
      );

      // Add timeline event
      await addTimelineEvent(
        applicationId,
        {
          eventType: 'CERTIFICATE_ISSUED',
          title: 'Certificate issued',
          description: `Certificate ${certificateNo} issued by ${officer.full_name}`,
          actorUserId: req.user.user_id
        },
        conn
      );

      // Audit log
      await logAction(
        req.user.user_id,
        'ISSUE_CERTIFICATE',
        'certificates',
        certificateId,
        `Certificate ${certificateNo} issued for application ${app.application_no}`,
        req
      );

      createdCert = {
        certificate_id: certificateId,
        certificate_no: certificateNo,
        verification_code: verificationCode,
        issue_date: issueDate,
        valid_until: validUntil,
        status: 'CERTIFICATE_ISSUED'
      };
    });

    // Notify citizen outside transaction (in-app + EMAIL)
    try {
      await notifyUser({
        userId: app.citizen_user_id,
        type: 'CERTIFICATE_ISSUED',
        title: `Your ${app.certificate_name} is ready`,
        message: `Your certificate has been issued by ${app.panchayat_name}. Log in to Connected Panchayat and open My Certificates to download it.`,
        applicationId,
        email: true,
        actionText: 'Download Certificate',
        actionUrl: `${env.FRONTEND_URL}/login`
      });
    } catch (err) {
      console.error('Failed to notify citizen of certificate issue:', err);
    }

    return success(res, createdCert, 'Certificate issued successfully', 201);
  } catch (err) {
    console.error('Error issuing certificate:', err);
    return error(res, 'Failed to issue certificate: ' + err.message, {}, 500);
  }
}

module.exports = {
  createApplication,
  getApplications,
  getApplicationById,
  trackApplication,
  verifyDocument,
  decideApplication,
  issueCertificate
};
