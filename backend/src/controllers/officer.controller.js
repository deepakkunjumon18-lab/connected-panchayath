const { query } = require('../config/db');
const { success, error } = require('../utils/apiResponse');

/**
 * Get Officer's own RSA Public Key & Fingerprint
 * GET /api/officer/me/public-key
 */
async function getOfficerPublicKey(req, res) {
  try {
    const rows = await query(
      `SELECT po.officer_id, po.full_name, po.designation, po.public_key,
              po.key_fingerprint, po.key_created_at,
              p.panchayat_name, p.panchayat_code
       FROM panchayat_officers po
       JOIN panchayats p ON po.panchayat_id = p.panchayat_id
       WHERE po.user_id = ?`,
      [req.user.user_id]
    );

    const officer = rows && rows[0] ? rows[0] : null;
    if (!officer) {
      return error(res, 'Officer record not found', {}, 404);
    }

    // Support direct file download if requested via query ?download=pem
    if (req.query.download === 'pem' || req.query.download === '1') {
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${officer.panchayat_code}_officer_public_key.pem"`);
      return res.send(officer.public_key);
    }

    return success(res, {
      pem: officer.public_key,
      fingerprint: officer.key_fingerprint,
      key_created_at: officer.key_created_at,
      officer_name: officer.full_name,
      designation: officer.designation,
      panchayat_name: officer.panchayat_name,
      panchayat_code: officer.panchayat_code
    });
  } catch (err) {
    return error(res, `Failed to retrieve public key: ${err.message}`, {}, 500);
  }
}

module.exports = {
  getOfficerPublicKey
};
