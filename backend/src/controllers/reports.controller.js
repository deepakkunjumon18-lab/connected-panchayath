const { query } = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const cryptoService = require('../services/crypto.service');

/**
 * Generate last N months keys array (e.g. ['2026-05', '2026-06', ...])
 */
function getLastNMonths(n = 6) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    months.push({ key, label, count: 0 });
  }
  return months;
}

/**
 * Officer Reports
 * GET /api/reports/officer
 */
async function getOfficerReports(req, res) {
  try {
    const panchayatId = req.user.panchayat_id;
    if (!panchayatId) {
      return error(res, 'Officer is not associated with any Panchayat', {}, 400);
    }

    // 1. Requests by status (incoming and outgoing)
    const incStatusRows = await query(
      `SELECT status, COUNT(*) as cnt
       FROM verification_requests
       WHERE verifying_panchayat_id = ?
       GROUP BY status`,
      [panchayatId]
    );
    const incomingStatus = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0
    };
    (incStatusRows || []).forEach((r) => {
      if (incomingStatus[r.status] !== undefined) {
        incomingStatus[r.status] = Number(r.cnt);
      }
    });

    const outStatusRows = await query(
      `SELECT status, COUNT(*) as cnt
       FROM verification_requests
       WHERE requesting_panchayat_id = ?
       GROUP BY status`,
      [panchayatId]
    );
    const outgoingStatus = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0
    };
    (outStatusRows || []).forEach((r) => {
      if (outgoingStatus[r.status] !== undefined) {
        outgoingStatus[r.status] = Number(r.cnt);
      }
    });

    // Combined requests distribution for chart
    const combinedRequestsByStatus = [
      { status: 'Pending', count: incomingStatus.PENDING + outgoingStatus.PENDING, color: '#F59E0B' },
      { status: 'Approved', count: incomingStatus.APPROVED + outgoingStatus.APPROVED, color: '#10B981' },
      { status: 'Rejected', count: incomingStatus.REJECTED + outgoingStatus.REJECTED, color: '#EF4444' },
      { status: 'Cancelled', count: incomingStatus.CANCELLED + outgoingStatus.CANCELLED, color: '#94A3B8' }
    ];

    // 2. Applications by certificate type (for my panchayat)
    const certTypeRows = await query(
      `SELECT ct.certificate_name, ct.certificate_code, COUNT(a.application_id) as count
       FROM certificate_types ct
       LEFT JOIN applications a ON ct.certificate_type_id = a.certificate_type_id AND a.home_panchayat_id = ?
       GROUP BY ct.certificate_type_id
       ORDER BY count DESC, ct.certificate_name ASC`,
      [panchayatId]
    );

    // 3. Applications per month (last 6 months)
    const appMonthMap = {};
    const last6MonthsApps = getLastNMonths(6);
    last6MonthsApps.forEach((m) => { appMonthMap[m.key] = 0; });

    const appMonthlyRows = await query(
      `SELECT DATE_FORMAT(submitted_at, '%Y-%m') as ym, COUNT(*) as cnt
       FROM applications
       WHERE home_panchayat_id = ? AND submitted_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY ym`,
      [panchayatId]
    );
    (appMonthlyRows || []).forEach((r) => {
      if (appMonthMap[r.ym] !== undefined) {
        appMonthMap[r.ym] = Number(r.cnt);
      }
    });
    const applicationsPerMonth = last6MonthsApps.map((m) => ({
      month: m.key,
      month_label: m.label,
      count: appMonthMap[m.key] || 0
    }));

    // 4. Certificates issued per month (last 6 months)
    const certMonthMap = {};
    const last6MonthsCerts = getLastNMonths(6);
    last6MonthsCerts.forEach((m) => { certMonthMap[m.key] = 0; });

    const certMonthlyRows = await query(
      `SELECT DATE_FORMAT(issue_date, '%Y-%m') as ym, COUNT(*) as cnt
       FROM certificates
       WHERE issuing_panchayat_id = ? AND issue_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY ym`,
      [panchayatId]
    );
    (certMonthlyRows || []).forEach((r) => {
      if (certMonthMap[r.ym] !== undefined) {
        certMonthMap[r.ym] = Number(r.cnt);
      }
    });
    const certificatesPerMonth = last6MonthsCerts.map((m) => ({
      month: m.key,
      month_label: m.label,
      count: certMonthMap[m.key] || 0
    }));

    // Combined monthly trends for charting
    const monthlyTrends = last6MonthsApps.map((m) => ({
      month: m.key,
      month_label: m.label,
      applications: appMonthMap[m.key] || 0,
      certificates: certMonthMap[m.key] || 0
    }));

    // 5. Average response time in hours for incoming requests answered
    const avgResponseRows = await query(
      `SELECT AVG(TIMESTAMPDIFF(SECOND, request_date, response_date)) / 3600 as avg_hours,
              COUNT(*) as answered_count
       FROM verification_requests
       WHERE verifying_panchayat_id = ?
         AND status IN ('APPROVED', 'REJECTED')
         AND response_date IS NOT NULL`,
      [panchayatId]
    );
    const rawAvgHours = avgResponseRows[0]?.avg_hours;
    const avgResponseHours = rawAvgHours != null ? Number(Number(rawAvgHours).toFixed(1)) : 0;
    const totalAnsweredRequests = Number(avgResponseRows[0]?.answered_count || 0);

    // 6. Overdue list (my incoming + outgoing PENDING requests past due_at)
    const overdueListRows = await query(
      `SELECT vr.verification_id, vr.request_no, vr.application_id,
              a.application_no,
              cit.full_name as applicant_name,
              vr.subject_name, vr.subject_party,
              ct.certificate_name,
              rp.panchayat_name as requesting_panchayat_name,
              vp.panchayat_name as verifying_panchayat_name,
              CASE WHEN vr.verifying_panchayat_id = ? THEN 'INCOMING' ELSE 'OUTGOING' END as direction,
              vr.request_date, vr.due_at,
              TIMESTAMPDIFF(DAY, vr.due_at, NOW()) as days_overdue
       FROM verification_requests vr
       JOIN applications a ON vr.application_id = a.application_id
       JOIN citizens cit ON a.citizen_id = cit.citizen_id
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN panchayats rp ON vr.requesting_panchayat_id = rp.panchayat_id
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       WHERE (vr.verifying_panchayat_id = ? OR vr.requesting_panchayat_id = ?)
         AND vr.status = 'PENDING'
         AND NOW() > vr.due_at
       ORDER BY vr.due_at ASC`,
      [panchayatId, panchayatId, panchayatId]
    );

    return success(res, {
      requests_by_status: {
        incoming: incomingStatus,
        outgoing: outgoingStatus,
        combined: combinedRequestsByStatus
      },
      applications_by_certificate_type: certTypeRows || [],
      applications_per_month: applicationsPerMonth,
      certificates_per_month: certificatesPerMonth,
      monthly_trends: monthlyTrends,
      average_response_time_hours: avgResponseHours,
      total_answered_requests: totalAnsweredRequests,
      overdue_list: overdueListRows || []
    });
  } catch (err) {
    return error(res, `Failed to generate officer reports: ${err.message}`, {}, 500);
  }
}

/**
 * Admin Reports Summary
 * GET /api/admin/reports/summary
 */
async function getAdminReportsSummary(req, res) {
  try {
    // 1. Users by role
    const usersByRoleRows = await query(
      `SELECT r.role_name, COUNT(u.user_id) as count
       FROM roles r
       LEFT JOIN users u ON r.role_id = u.role_id
       GROUP BY r.role_id, r.role_name
       ORDER BY r.role_id ASC`
    );

    // 2. Panchayats count
    const panchayatCountRows = await query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
              SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) as inactive
       FROM panchayats`
    );
    const panchayatsCount = {
      total: Number(panchayatCountRows[0]?.total || 0),
      active: Number(panchayatCountRows[0]?.active || 0),
      inactive: Number(panchayatCountRows[0]?.inactive || 0)
    };

    // 3. Applications by status
    const appStatusRows = await query(
      `SELECT status, COUNT(*) as count
       FROM applications
       GROUP BY status
       ORDER BY count DESC`
    );

    // 4. Applications by certificate type
    const appCertTypeRows = await query(
      `SELECT ct.certificate_name, ct.certificate_code, COUNT(a.application_id) as count
       FROM certificate_types ct
       LEFT JOIN applications a ON ct.certificate_type_id = a.certificate_type_id
       GROUP BY ct.certificate_type_id
       ORDER BY count DESC`
    );

    // 5. Applications per panchayat
    const appPanchayatRows = await query(
      `SELECT p.panchayat_id, p.panchayat_name, p.panchayat_code, p.district,
              COUNT(a.application_id) as count
       FROM panchayats p
       LEFT JOIN applications a ON p.panchayat_id = a.home_panchayat_id
       GROUP BY p.panchayat_id
       ORDER BY count DESC`
    );

    // 6. Requests between panchayats (top 10 pairs with counts)
    const pairsRows = await query(
      `SELECT rp.panchayat_name as from_panchayat,
              rp.panchayat_code as from_code,
              vp.panchayat_name as to_panchayat,
              vp.panchayat_code as to_code,
              COUNT(*) as request_count
       FROM verification_requests vr
       JOIN panchayats rp ON vr.requesting_panchayat_id = rp.panchayat_id
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       GROUP BY vr.requesting_panchayat_id, vr.verifying_panchayat_id
       ORDER BY request_count DESC
       LIMIT 10`
    );

    // 7. Average response hours per verifying panchayat
    const avgPanchayatRows = await query(
      `SELECT vp.panchayat_id, vp.panchayat_name, vp.panchayat_code, vp.district,
              ROUND(AVG(TIMESTAMPDIFF(SECOND, vr.request_date, vr.response_date) / 3600), 1) as avg_hours,
              COUNT(*) as total_answered
       FROM panchayats vp
       JOIN verification_requests vr ON vp.panchayat_id = vr.verifying_panchayat_id
       WHERE vr.status IN ('APPROVED', 'REJECTED') AND vr.response_date IS NOT NULL
       GROUP BY vp.panchayat_id
       ORDER BY avg_hours ASC`
    );

    // 8. Certificates issued per month (last 6 months across system)
    const certMonthMap = {};
    const last6Months = getLastNMonths(6);
    last6Months.forEach((m) => { certMonthMap[m.key] = 0; });

    const certMonthlyRows = await query(
      `SELECT DATE_FORMAT(issue_date, '%Y-%m') as ym, COUNT(*) as cnt
       FROM certificates
       WHERE issue_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY ym`
    );
    (certMonthlyRows || []).forEach((r) => {
      if (certMonthMap[r.ym] !== undefined) {
        certMonthMap[r.ym] = Number(r.cnt);
      }
    });
    const certificatesPerMonth = last6Months.map((m) => ({
      month: m.key,
      month_label: m.label,
      count: certMonthMap[m.key] || 0
    }));

    // 9. Overdue requests list (all overdue across system)
    const overdueRequestsRows = await query(
      `SELECT vr.verification_id, vr.request_no, vr.application_id,
              a.application_no,
              cit.full_name as applicant_name,
              vr.subject_name, vr.subject_party,
              ct.certificate_name,
              rp.panchayat_name as requesting_panchayat_name,
              vp.panchayat_name as verifying_panchayat_name,
              vr.request_date, vr.due_at,
              TIMESTAMPDIFF(DAY, vr.due_at, NOW()) as days_overdue
       FROM verification_requests vr
       JOIN applications a ON vr.application_id = a.application_id
       JOIN citizens cit ON a.citizen_id = cit.citizen_id
       JOIN certificate_types ct ON a.certificate_type_id = ct.certificate_type_id
       JOIN panchayats rp ON vr.requesting_panchayat_id = rp.panchayat_id
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       WHERE vr.status = 'PENDING' AND NOW() > vr.due_at
       ORDER BY vr.due_at ASC`
    );

    // 10. Notifications email status counts
    const notifStatusRows = await query(
      `SELECT email_status, COUNT(*) as count
       FROM notifications
       GROUP BY email_status`
    );

    return success(res, {
      users_by_role: (usersByRoleRows || []).map((r) => ({
        role_name: r.role_name,
        count: Number(r.count)
      })),
      panchayats_count: panchayatsCount,
      applications_by_status: (appStatusRows || []).map((r) => ({
        status: r.status,
        count: Number(r.count)
      })),
      applications_by_certificate_type: (appCertTypeRows || []).map((r) => ({
        certificate_name: r.certificate_name,
        certificate_code: r.certificate_code,
        count: Number(r.count)
      })),
      applications_per_panchayat: (appPanchayatRows || []).map((r) => ({
        panchayat_id: r.panchayat_id,
        panchayat_name: r.panchayat_name,
        panchayat_code: r.panchayat_code,
        district: r.district,
        count: Number(r.count)
      })),
      requests_between_panchayats: (pairsRows || []).map((r) => ({
        from_panchayat: r.from_panchayat,
        from_code: r.from_code,
        to_panchayat: r.to_panchayat,
        to_code: r.to_code,
        request_count: Number(r.request_count)
      })),
      average_response_hours_per_panchayat: (avgPanchayatRows || []).map((r) => ({
        panchayat_id: r.panchayat_id,
        panchayat_name: r.panchayat_name,
        panchayat_code: r.panchayat_code,
        district: r.district,
        avg_response_hours: Number(r.avg_hours),
        total_answered: Number(r.total_answered)
      })),
      certificates_per_month: certificatesPerMonth,
      overdue_requests: overdueRequestsRows || [],
      notifications_email_status: (notifStatusRows || []).map((r) => ({
        email_status: r.email_status,
        count: Number(r.count)
      }))
    });
  } catch (err) {
    return error(res, `Failed to generate admin reports summary: ${err.message}`, {}, 500);
  }
}

/**
 * Admin Signatures Audit
 * GET /api/admin/signatures/audit
 */
async function getAdminSignaturesAudit(req, res) {
  try {
    const signedRows = await query(
      `SELECT vr.*,
              rp.panchayat_name as requesting_panchayat_name,
              rp.panchayat_code as requesting_panchayat_code,
              vp.panchayat_name as verifying_panchayat_name,
              vp.panchayat_code as verifying_panchayat_code,
              po.full_name as signer_name,
              po.designation as signer_designation
       FROM verification_requests vr
       JOIN panchayats rp ON vr.requesting_panchayat_id = rp.panchayat_id
       JOIN panchayats vp ON vr.verifying_panchayat_id = vp.panchayat_id
       LEFT JOIN panchayat_officers po ON vr.responded_by_officer_id = po.officer_id
       WHERE vr.signed_at IS NOT NULL AND vr.signature IS NOT NULL
       ORDER BY vr.signed_at DESC`
    );

    let validCount = 0;
    let invalidCount = 0;

    const auditedRows = (signedRows || []).map((row) => {
      const check = cryptoService.verifyRequestSignature(row);
      if (check.valid) {
        validCount++;
      } else {
        invalidCount++;
      }

      return {
        verification_id: row.verification_id,
        request_no: row.request_no,
        application_id: row.application_id,
        from_panchayat: row.requesting_panchayat_name,
        from_code: row.requesting_panchayat_code,
        to_panchayat: row.verifying_panchayat_name,
        to_code: row.verifying_panchayat_code,
        signer_name: row.signer_name || 'Officer',
        signer_designation: row.signer_designation || null,
        signed_at: row.signed_at,
        fingerprint: row.signer_key_fingerprint,
        valid: check.valid,
        reason: check.valid ? null : (check.reason || 'Cryptographic verification failed'),
        hashMatches: check.hashMatches,
        signatureMatches: check.signatureMatches
      };
    });

    return success(res, {
      rows: auditedRows,
      totals: {
        total_checked: auditedRows.length,
        valid_count: validCount,
        invalid_count: invalidCount
      }
    });
  } catch (err) {
    return error(res, `Failed to execute signature audit: ${err.message}`, {}, 500);
  }
}

module.exports = {
  getOfficerReports,
  getAdminReportsSummary,
  getAdminSignaturesAudit
};
