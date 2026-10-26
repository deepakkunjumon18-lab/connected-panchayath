const db = require('../config/db');
const { success, error, paginated } = require('../utils/apiResponse');

/**
 * Get paginated notifications for current user
 */
async function getNotifications(req, res) {
  const userId = req.user.user_id;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const offset = (page - 1) * limit;
  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';

  let countSql = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
  let querySql = `
    SELECT notification_id, user_id, application_id, verification_id,
           notification_type, title, message, is_read, email_status, created_at
    FROM notifications
    WHERE user_id = ?
  `;
  const params = [userId];

  if (unreadOnly) {
    countSql += ' AND is_read = 0';
    querySql += ' AND is_read = 0';
  }

  querySql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  const countRows = await db.query(countSql, params);
  const total = countRows[0].total;

  const items = await db.query(querySql, [...params, limit, offset]);

  return paginated(res, items, total, page, limit);
}

/**
 * Get unread notification count
 */
async function getUnreadCount(req, res) {
  const userId = req.user.user_id;
  const rows = await db.query(
    'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );

  return success(res, { unread_count: Number(rows[0].unread_count) });
}

/**
 * Mark notification as read
 */
async function markAsRead(req, res) {
  const userId = req.user.user_id;
  const notifId = req.params.id;

  const result = await db.query(
    'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
    [notifId, userId]
  );

  if (result.affectedRows === 0) {
    return error(res, 'Notification not found', {}, 404);
  }

  return success(res, null, 'Notification marked as read');
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(req, res) {
  const userId = req.user.user_id;

  await db.query(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [userId]
  );

  return success(res, null, 'All notifications marked as read');
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};
