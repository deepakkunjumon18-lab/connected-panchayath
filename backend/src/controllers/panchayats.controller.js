const db = require('../config/db');
const { success } = require('../utils/apiResponse');

/**
 * Public active panchayats list
 */
async function getPublicPanchayats(req, res) {
  const rows = await db.query(`
    SELECT panchayat_id, panchayat_name, panchayat_code, district, state
    FROM panchayats
    WHERE status = 'ACTIVE'
    ORDER BY panchayat_name ASC
  `);

  return success(res, rows);
}

/**
 * Directory for officers and admin with search param support
 */
async function getPanchayatDirectory(req, res) {
  const { search } = req.query;

  const panchayats = await db.query(`
    SELECT panchayat_id, panchayat_name, panchayat_code, district, address, contact_no
    FROM panchayats
    WHERE status = 'ACTIVE'
    ORDER BY panchayat_name ASC
  `);

  const officers = await db.query(`
    SELECT officer_id, panchayat_id, full_name, designation, email, mobile
    FROM panchayat_officers
    WHERE status = 'ACTIVE'
    ORDER BY full_name ASC
  `);

  let directory = panchayats.map((p) => ({
    ...p,
    officers: officers.filter((o) => o.panchayat_id === p.panchayat_id)
  }));

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    directory = directory.filter((p) => {
      const matchPanchayat =
        (p.panchayat_name && p.panchayat_name.toLowerCase().includes(q)) ||
        (p.panchayat_code && p.panchayat_code.toLowerCase().includes(q)) ||
        (p.district && p.district.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.contact_no && p.contact_no.toLowerCase().includes(q));

      const matchOfficer = (p.officers || []).some(
        (o) =>
          (o.full_name && o.full_name.toLowerCase().includes(q)) ||
          (o.designation && o.designation.toLowerCase().includes(q)) ||
          (o.email && o.email.toLowerCase().includes(q)) ||
          (o.mobile && o.mobile.toLowerCase().includes(q))
      );

      return matchPanchayat || matchOfficer;
    });
  }

  return success(res, directory);
}

module.exports = {
  getPublicPanchayats,
  getPanchayatDirectory
};
