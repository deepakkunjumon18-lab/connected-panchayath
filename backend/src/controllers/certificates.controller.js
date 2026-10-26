const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../config/db');
const { success, error, paginated } = require('../utils/apiResponse');

/**
 * List certificates with role-based scoping and filters
 * GET /api/certificates?search&page&limit
 */
async function getCertificates(req, res) {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const userRole = req.user.role;
    const whereClauses = [];
    const params = [];

    // Role-based scoping (Section 4 & Section 9)
    if (userRole === 'CITIZEN') {
      const citRows = await query('SELECT citizen_id FROM citizens WHERE user_id = ?', [req.user.user_id]);
      const citizen = Array.isArray(citRows) ? citRows[0] : citRows;
      if (!citizen) {
        return paginated(res, [], 0, pageNum, limitNum);
      }
      whereClauses.push('c.citizen_id = ?');
      params.push(citizen.citizen_id);
    } else if (userRole === 'OFFICER') {
      whereClauses.push('c.issuing_panchayat_id = ?');
      params.push(req.user.panchayat_id);
    }
    // ADMIN sees all certificates

    if (search && search !== 'undefined' && search !== 'null') {
      whereClauses.push(
        '(c.certificate_no LIKE ? OR ct.certificate_name LIKE ? OR cit.full_name LIKE ? OR c.verification_code LIKE ?)'
      );
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM certificates c
      JOIN certificate_types ct ON c.certificate_type_id = ct.certificate_type_id
      JOIN citizens cit ON c.citizen_id = cit.citizen_id
      ${whereSql}
    `;
    const countRows = await query(countSql, params);
    const total = countRows && countRows[0] ? Number(countRows[0].total) : 0;

    // Data query
    const dataSql = `
      SELECT c.certificate_id, c.certificate_no, c.application_id, a.application_no,
             ct.certificate_type_id, ct.certificate_name, ct.certificate_code,
             c.citizen_id, cit.full_name as holder_name,
             p.panchayat_id as issuing_panchayat_id, p.panchayat_name as issuing_panchayat_name, p.panchayat_code as issuing_panchayat_code,
             c.issue_date, c.valid_until, c.verification_code, c.status, c.created_at
      FROM certificates c
      JOIN applications a ON c.application_id = a.application_id
      JOIN certificate_types ct ON c.certificate_type_id = ct.certificate_type_id
      JOIN panchayats p ON c.issuing_panchayat_id = p.panchayat_id
      JOIN citizens cit ON c.citizen_id = cit.citizen_id
      ${whereSql}
      ORDER BY c.issue_date DESC, c.certificate_id DESC
      LIMIT ? OFFSET ?
    `;

    const items = await query(dataSql, [...params, limitNum, offset]);
    return paginated(res, items || [], total, pageNum, limitNum);
  } catch (err) {
    console.error('Error fetching certificates:', err);
    return error(res, 'Failed to fetch certificates', {}, 500);
  }
}

/**
 * Public certificate verification
 * GET /api/certificates/verify/:code
 */
async function verifyCertificate(req, res) {
  try {
    const code = req.params.code || req.query.code;
    const isQr = req.query.src === 'qr' || (req.originalUrl && req.originalUrl.includes('src=qr'));
    const method = isQr ? 'QR' : 'CODE';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!code) {
      return error(res, 'Verification code is required', {}, 400);
    }

    const sql = `
      SELECT c.*, ct.certificate_name, ct.certificate_code as certificate_type_code,
             p.panchayat_name as issuing_panchayat_name, p.panchayat_code as issuing_panchayat_code,
             cit.full_name as holder_name
      FROM certificates c
      JOIN certificate_types ct ON c.certificate_type_id = ct.certificate_type_id
      JOIN panchayats p ON c.issuing_panchayat_id = p.panchayat_id
      JOIN citizens cit ON c.citizen_id = cit.citizen_id
      WHERE c.verification_code = ?
    `;

    const rows = await query(sql, [code.trim()]);
    const cert = Array.isArray(rows) ? rows[0] : rows;

    if (!cert) {
      // Log NOT_FOUND attempt
      await query(
        `INSERT INTO certificate_verification_logs (verification_code, method, result, ip_address)
         VALUES (?, ?, 'NOT_FOUND', ?)`,
        [code.trim(), method, clientIp]
      );

      return success(res, {
        valid: false,
        status: 'NOT_FOUND',
        message: 'No matching certificate found in the records.'
      }, 'Certificate not found');
    }

    // Check status & expiry
    let status = 'VALID';
    if (cert.status === 'REVOKED') {
      status = 'REVOKED';
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const validUntilStr = new Date(cert.valid_until).toISOString().slice(0, 10);
      if (today > validUntilStr) {
        status = 'EXPIRED';
      }
    }

    // Check file integrity
    let fileHashMatches = true;
    if (cert.certificate_file) {
      const filePath = path.isAbsolute(cert.certificate_file)
        ? cert.certificate_file
        : path.join(__dirname, '../../', cert.certificate_file);

      if (fs.existsSync(filePath)) {
        const fileBytes = fs.readFileSync(filePath);
        const actualHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
        fileHashMatches = (actualHash.toLowerCase() === cert.certificate_hash.toLowerCase());
      } else {
        fileHashMatches = false;
      }
    } else {
      fileHashMatches = false;
    }

    const isValid = (status === 'VALID' && fileHashMatches);
    const finalResult = isValid ? 'VALID' : (status === 'VALID' ? 'INVALID' : status);

    // Log verification attempt
    await query(
      `INSERT INTO certificate_verification_logs (certificate_id, verification_code, verified_by_user_id, method, result, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cert.certificate_id,
        cert.verification_code,
        req.user?.user_id || null,
        method,
        finalResult,
        clientIp
      ]
    );

    // Return data per section 12: Holder name only (no Aadhaar/address)
    return success(res, {
      valid: isValid,
      status: finalResult,
      certificate_no: cert.certificate_no,
      certificate_name: cert.certificate_name,
      holder_name: cert.holder_name,
      issuing_panchayat: cert.issuing_panchayat_name,
      issue_date: cert.issue_date,
      valid_until: cert.valid_until,
      integrity: {
        fileHashMatches
      }
    }, 'Certificate verification completed');
  } catch (err) {
    console.error('Error verifying certificate:', err);
    return error(res, 'Failed to verify certificate', {}, 500);
  }
}

/**
 * Download certificate PDF
 * GET /api/certificates/:id/download (AUTHENTICATED)
 */
async function downloadCertificate(req, res) {
  try {
    const certId = Number(req.params.id);
    if (!certId) {
      return error(res, 'Certificate not found', {}, 404);
    }

    const rows = await query('SELECT * FROM certificates WHERE certificate_id = ?', [certId]);
    const cert = rows && rows[0];
    if (!cert) {
      return error(res, 'Certificate not found', {}, 404);
    }

    // Enforce data isolation / permissions (Section 4 & Section 9)
    const userRole = req.user.role;
    if (userRole === 'CITIZEN') {
      const citRows = await query('SELECT citizen_id FROM citizens WHERE user_id = ?', [req.user.user_id]);
      const citizen = citRows && citRows[0];
      if (!citizen || Number(citizen.citizen_id) !== Number(cert.citizen_id)) {
        return error(res, 'Certificate not found', {}, 404);
      }
    } else if (userRole === 'OFFICER') {
      if (Number(req.user.panchayat_id) !== Number(cert.issuing_panchayat_id)) {
        return error(res, 'Certificate not found', {}, 404);
      }
    }
    // ADMIN can download

    const filePath = path.isAbsolute(cert.certificate_file)
      ? cert.certificate_file
      : path.join(__dirname, '../../', cert.certificate_file);

    if (!fs.existsSync(filePath)) {
      return error(res, 'Certificate file not found on server', {}, 404);
    }

    // Re-check stored hash and set X-Integrity header
    const fileBytes = fs.readFileSync(filePath);
    const actualHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
    const integrityOk = (actualHash.toLowerCase() === cert.certificate_hash.toLowerCase());

    res.setHeader('X-Integrity', integrityOk ? 'ok' : 'mismatch');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.certificate_no}.pdf"`);

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Error downloading certificate:', err);
    return error(res, 'Failed to download certificate', {}, 500);
  }
}

module.exports = {
  getCertificates,
  verifyCertificate,
  downloadCertificate
};
