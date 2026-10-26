const { query } = require('../config/db');
const { success, error } = require('../utils/apiResponse');

/**
 * Officer Dashboard
 * GET /api/dashboard/officer
 * Scoped to req.user.panchayat_id
 */
async function getOfficerDashboard(req, res) {
  try {
    const panchayatId = req.user.panchayat_id;
    if (!panchayatId) {
      return error(res, 'Officer is not associated with any Panchayat', {}, 400);
    }

    // 1. Total requests (incoming + outgoing created in the last 30 days)
    const totalRequestsRows = await query(
      `SELECT COUNT(*) as cnt
       FROM verification_requests
       WHERE (requesting_panchayat_id = ? OR verifying_panchayat_id = ?)
         AND request_date >= NOW() - INTERVAL 30 DAY`,
      [panchayatId, panchayatId]
    );
    const totalRequests = Number(totalRequestsRows[0]?.cnt || 0);

    // 2. Pending incoming requests (needs response from this panchayat)
    const pendingIncomingRows = await query(
      `SELECT COUNT(*) as cnt
       FROM verification_requests
       WHERE verifying_panchayat_id = ? AND status = 'PENDING'`,
      [panchayatId]
    );
    const pendingIncoming = Number(pendingIncomingRows[0]?.cnt || 0);

    // 3. Completed certificates issued by my panchayat (last 30 days)
    const completedCertsRows = await query(
      `SELECT COUNT(*) as cnt
       FROM certificates
       WHERE issuing_panchayat_id = ?
         AND issue_date >= CURDATE() - INTERVAL 30 DAY`,
      [panchayatId]
    );
    const completedCertificates = Number(completedCertsRows[0]?.cnt || 0);

    // 4. Overdue requests (PENDING and NOW() > due_at)
    // Separate counts for incoming and outgoing
    const overdueIncomingRows = await query(
      `SELECT COUNT(*) as cnt
       FROM verification_requests
       WHERE verifying_panchayat_id = ? AND status = 'PENDING' AND NOW() > due_at`,
      [panchayatId]
    );
    const overdueIncoming = Number(overdueIncomingRows[0]?.cnt || 0);

    const overdueOutgoingRows = await query(
      `SELECT COUNT(*) as cnt
       FROM verification_requests
       WHERE requesting_panchayat_id = ? AND status = 'PENDING' AND NOW() > due_at`,
      [panchayatId]
    );
    const overdueOutgoing = Number(overdueOutgoingRows[0]?.cnt || 0);

    const overdueTotal = overdueIncoming + overdueOutgoing;

    // 5. Applications awaiting decision (home panchayat in READY_FOR_DECISION or SUBMITTED)
    const awaitingDecisionRows = await query(
      `SELECT COUNT(*) as cnt
       FROM applications
       WHERE home_panchayat_id = ? AND status IN ('READY_FOR_DECISION', 'SUBMITTED')`,
      [panchayatId]
    );
    const awaitingDecision = Number(awaitingDecisionRows[0]?.cnt || 0);

    // 6. Current Request: single most urgent PENDING incoming request (overdue first, else oldest)
    const currentRequestRows = await query(
      `SELECT vr.verification_id, vr.request_no, vr.application_id, vr.party_id,
              vr.subject_party, vr.subject_name, vr.purpose, vr.status,
              vr.request_date, vr.due_at, vr.reminder_count,
              a.application_no,
              cit.full_name as applicant_name,
              ct.certificate_name, ct.certificate_code,
              rp.panchayat_name as requesting_panchayat_name,
              rp.panchayat_code as requesting_panchayat_code,
              vp.panchayat_name as verifying_panchayat_name,
              vp.panchayat_code as verifying_panchayat_code,
              (NOW() > vr.due_at) as is_overdue,
              TIMESTAMPDIFF(DAY, vr.due_at, NOW()) as days_overdue
       FROM verification_requests vr
       JOIN applications a ON vr.application_id = a.application_id
       JOIN citizens cit ON a.citizen_id = cit.citizen_id
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN panchayats rp ON vr.requesting_panchayat_id = rp.panchayat_id
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       WHERE vr.verifying_panchayat_id = ? AND vr.status = 'PENDING'
       ORDER BY (NOW() > vr.due_at) DESC, vr.due_at ASC, vr.request_date ASC
       LIMIT 1`,
      [panchayatId]
    );
    const currentRequest = currentRequestRows && currentRequestRows[0] ? currentRequestRows[0] : null;

    // 7. Recent Requests: latest 5 requests (incoming or outgoing)
    const recentRequestsRows = await query(
      `SELECT vr.verification_id, vr.request_no, vr.application_id,
              a.application_no,
              cit.full_name as applicant_name,
              ct.certificate_name, ct.certificate_code,
              rp.panchayat_name as requesting_panchayat_name,
              rp.panchayat_code as requesting_panchayat_code,
              vp.panchayat_name as verifying_panchayat_name,
              vp.panchayat_code as verifying_panchayat_code,
              vr.verifying_panchayat_id, vr.requesting_panchayat_id,
              CASE WHEN vr.verifying_panchayat_id = ? THEN 'INCOMING' ELSE 'OUTGOING' END as direction,
              vr.subject_party, vr.subject_name,
              vr.status, vr.request_date, vr.due_at, vr.response_date,
              (vr.status = 'PENDING' AND NOW() > vr.due_at) as is_overdue,
              COALESCE(vr.response_date, vr.request_date) as updated_time
       FROM verification_requests vr
       JOIN applications a ON vr.application_id = a.application_id
       JOIN citizens cit ON a.citizen_id = cit.citizen_id
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN panchayats rp ON vr.requesting_panchayat_id = rp.panchayat_id
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       WHERE vr.requesting_panchayat_id = ? OR vr.verifying_panchayat_id = ?
       ORDER BY vr.verification_id DESC
       LIMIT 5`,
      [panchayatId, panchayatId, panchayatId]
    );

    return success(res, {
      panchayat_id: panchayatId,
      total_requests: totalRequests,
      pending_incoming: pendingIncoming,
      completed_certificates: completedCertificates,
      overdue: {
        total: overdueTotal,
        incoming: overdueIncoming,
        outgoing: overdueOutgoing
      },
      awaiting_decision: awaitingDecision,
      current_request: currentRequest,
      recent_requests: recentRequestsRows || []
    });
  } catch (err) {
    return error(res, `Failed to load officer dashboard: ${err.message}`, {}, 500);
  }
}

/**
 * Citizen Dashboard
 * GET /api/dashboard/citizen
 * Scoped to req.user.user_id
 */
async function getCitizenDashboard(req, res) {
  try {
    const citRows = await query('SELECT citizen_id, full_name, aadhaar_no, mobile, email FROM citizens WHERE user_id = ?', [req.user.user_id]);
    const citizen = citRows && citRows[0] ? citRows[0] : null;
    if (!citizen) {
      return error(res, 'Citizen record not found for user', {}, 404);
    }

    const citizenId = citizen.citizen_id;

    // Totals
    const totalAppsRows = await query('SELECT COUNT(*) as cnt FROM applications WHERE citizen_id = ?', [citizenId]);
    const totalApplications = Number(totalAppsRows[0]?.cnt || 0);

    const inProgressRows = await query(
      `SELECT COUNT(*) as cnt FROM applications
       WHERE citizen_id = ? AND status IN ('SUBMITTED', 'PENDING_EXTERNAL', 'UNDER_REVIEW', 'READY_FOR_DECISION')`,
      [citizenId]
    );
    const inProgress = Number(inProgressRows[0]?.cnt || 0);

    const issuedRows = await query(
      `SELECT COUNT(*) as cnt FROM applications WHERE citizen_id = ? AND status = 'CERTIFICATE_ISSUED'`,
      [citizenId]
    );
    const certificatesIssued = Number(issuedRows[0]?.cnt || 0);

    const rejectedRows = await query(
      `SELECT COUNT(*) as cnt FROM applications WHERE citizen_id = ? AND status = 'REJECTED'`,
      [citizenId]
    );
    const rejected = Number(rejectedRows[0]?.cnt || 0);

    // Recent 5 applications with certificate info if issued
    const recentAppsRows = await query(
      `SELECT a.application_id, a.application_no, a.status, a.submitted_at, a.purpose,
              ct.certificate_name, ct.certificate_code,
              p.panchayat_name as home_panchayat_name,
              c.certificate_id, c.certificate_no, c.verification_code, c.issue_date, c.valid_until
       FROM applications a
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN panchayats p ON a.home_panchayat_id = p.panchayat_id
       LEFT JOIN certificates c ON a.application_id = c.application_id AND c.status = 'ACTIVE'
       WHERE a.citizen_id = ?
       ORDER BY a.application_id DESC
       LIMIT 5`,
      [citizenId]
    );

    return success(res, {
      citizen: {
        citizen_id: citizen.citizen_id,
        full_name: citizen.full_name
      },
      totals: {
        total_applications: totalApplications,
        in_progress: inProgress,
        certificates_issued: certificatesIssued,
        rejected: rejected
      },
      recent_applications: (recentAppsRows || []).map((row) => ({
        application_id: row.application_id,
        application_no: row.application_no,
        certificate_name: row.certificate_name,
        certificate_code: row.certificate_code,
        status: row.status,
        submitted_at: row.submitted_at,
        purpose: row.purpose,
        home_panchayat_name: row.home_panchayat_name,
        certificate: row.certificate_id ? {
          certificate_id: row.certificate_id,
          certificate_no: row.certificate_no,
          verification_code: row.verification_code,
          issue_date: row.issue_date,
          valid_until: row.valid_until
        } : null
      }))
    });
  } catch (err) {
    return error(res, `Failed to load citizen dashboard: ${err.message}`, {}, 500);
  }
}

module.exports = {
  getOfficerDashboard,
  getCitizenDashboard
};
