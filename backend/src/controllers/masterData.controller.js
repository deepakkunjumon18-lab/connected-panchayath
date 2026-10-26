const db = require('../config/db');
const { success } = require('../utils/apiResponse');

async function getMasterDataByCategory(req, res) {
  const { category } = req.params;

  const rows = await db.query(`
    SELECT master_id, category, code, \`value\`, description
    FROM master_data
    WHERE category = ? AND status = 'ACTIVE'
    ORDER BY master_id ASC
  `, [category.toUpperCase()]);

  return success(res, rows);
}

module.exports = {
  getMasterDataByCategory
};
