const crypto = require('crypto');
const db = require('../config/db');

/**
 * Gets next sequence number for a key atomically.
 * Works with or without an existing transaction connection.
 */
async function getNextSequence(seqKey, conn = null) {
  const sql = `
    INSERT INTO sequences (seq_key, \`last_value\`) VALUES (?, 1)
    ON DUPLICATE KEY UPDATE \`last_value\` = \`last_value\` + 1;
  `;
  if (conn) {
    await conn.query(sql, [seqKey]);
    const [rows] = await conn.query('SELECT `last_value` FROM sequences WHERE seq_key = ?', [seqKey]);
    return rows[0].last_value;
  } else {
    await db.query(sql, [seqKey]);
    const rows = await db.query('SELECT `last_value` FROM sequences WHERE seq_key = ?', [seqKey]);
    return rows[0].last_value;
  }
}

/**
 * application_no = {CERT_CODE}-{YYYY}-{0001} (seq_key APP-{CERT_CODE}-{YYYY})
 */
async function generateApplicationNo(certCode, conn = null) {
  const year = new Date().getFullYear();
  const seqKey = `APP-${certCode.toUpperCase()}-${year}`;
  const seq = await getNextSequence(seqKey, conn);
  const padded = String(seq).padStart(4, '0');
  return `${certCode.toUpperCase()}-${year}-${padded}`;
}

/**
 * request_no = CP-{YYYY}-{0001} (seq_key REQ-{YYYY})
 */
async function generateRequestNo(conn = null) {
  const year = new Date().getFullYear();
  const seqKey = `REQ-${year}`;
  const seq = await getNextSequence(seqKey, conn);
  const padded = String(seq).padStart(4, '0');
  return `CP-${year}-${padded}`;
}

/**
 * certificate_no = CERT-{PANCHAYAT_CODE}-{YYYY}-{00001} (seq_key CERT-{PANCHAYAT_CODE}-{YYYY})
 */
async function generateCertificateNo(panchayatCode, conn = null) {
  const year = new Date().getFullYear();
  const seqKey = `CERT-${panchayatCode.toUpperCase()}-${year}`;
  const seq = await getNextSequence(seqKey, conn);
  const padded = String(seq).padStart(5, '0');
  return `CERT-${panchayatCode.toUpperCase()}-${year}-${padded}`;
}

/**
 * verification_code = 12 random uppercase letters/digits formatted XXXX-XXXX-XXXX
 */
function generateVerificationCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let str = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    str += chars[bytes[i] % chars.length];
  }
  return `${str.slice(0, 4)}-${str.slice(4, 8)}-${str.slice(8, 12)}`;
}

module.exports = {
  getNextSequence,
  generateApplicationNo,
  generateRequestNo,
  generateCertificateNo,
  generateVerificationCode
};
