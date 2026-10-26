const db = require('../config/db');
const { success } = require('../utils/apiResponse');

async function getCertificateTypes(req, res) {
  const rows = await db.query(`
    SELECT certificate_type_id, certificate_code, certificate_name, description,
           required_documents, verification_parties, validity_months
    FROM certificate_types
    WHERE status = 'ACTIVE'
    ORDER BY certificate_type_id ASC
  `);

  const formatted = rows.map((r) => ({
    ...r,
    required_documents: typeof r.required_documents === 'string'
      ? JSON.parse(r.required_documents)
      : r.required_documents,
    verification_parties: typeof r.verification_parties === 'string'
      ? JSON.parse(r.verification_parties)
      : r.verification_parties
  }));

  return success(res, formatted);
}

module.exports = {
  getCertificateTypes
};
