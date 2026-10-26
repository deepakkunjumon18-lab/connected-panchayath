const db = require('../config/db');

/**
 * Logs an action in the audit_logs table
 * Accepts either an Express req object or an options object
 */
async function logAction(actor, action, tableName = null, recordId = null, description = null, conn = null) {
  try {
    let userId = null;
    let ipAddress = null;

    if (actor && typeof actor === 'object' && actor.headers) {
      // Express request
      userId = actor.user?.user_id || null;
      ipAddress = actor.headers['x-forwarded-for'] || actor.socket?.remoteAddress || null;
      if (Array.isArray(ipAddress)) ipAddress = ipAddress[0];
      if (typeof ipAddress === 'string' && ipAddress.includes(',')) {
        ipAddress = ipAddress.split(',')[0].trim();
      }
    } else if (typeof actor === 'number' || actor === null) {
      userId = actor;
    } else if (actor && actor.user_id) {
      userId = actor.user_id;
      ipAddress = actor.ip_address || null;
    }

    let runner = db;
    if (conn && typeof conn.query === 'function' && !conn.headers) {
      runner = conn;
    } else if (conn && conn.headers && !ipAddress) {
      ipAddress = conn.headers['x-forwarded-for'] || conn.socket?.remoteAddress || null;
    }
    const sql = `
      INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await runner.query(sql, [
      userId,
      action,
      tableName,
      recordId ? Number(recordId) : null,
      ipAddress ? String(ipAddress).slice(0, 45) : null,
      description
    ]);
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
    // Never throw from audit logging to prevent failing main operation
  }
}

module.exports = {
  logAction
};
