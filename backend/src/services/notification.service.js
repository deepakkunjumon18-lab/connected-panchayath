const db = require('../config/db');
const emailService = require('./email.service');

/**
 * Inserts in-app notification and optionally sends email
 */
async function notifyUser({
  userId,
  type,
  title,
  message,
  applicationId = null,
  verificationId = null,
  email = false,
  actionText = null,
  actionUrl = null,
  conn = null
}) {
  const runner = conn || db;
  let emailStatus = 'NOT_REQUIRED';
  let emailTo = null;

  if (email) {
    try {
      const users = await runner.query('SELECT email FROM users WHERE user_id = ?', [userId]);
      if (users.length > 0 && users[0].email) {
        emailTo = users[0].email;
        const res = await emailService.sendEmail({
          to: emailTo,
          subject: title,
          title,
          message,
          actionText,
          actionUrl
        });
        emailStatus = res.status; // 'SENT', 'LOGGED', or 'FAILED'
      }
    } catch (err) {
      console.error('Email sending failed in notifyUser:', err.message);
      emailStatus = 'FAILED';
    }
  }

  const sql = `
    INSERT INTO notifications
      (user_id, application_id, verification_id, notification_type, title, message, is_read, email_to, email_status)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `;
  const result = await runner.query(sql, [
    userId,
    applicationId ? Number(applicationId) : null,
    verificationId ? Number(verificationId) : null,
    type,
    title,
    message,
    emailTo,
    emailStatus
  ]);

  return result.insertId;
}

/**
 * Notifies all active officers of a panchayat
 */
async function notifyPanchayatOfficers(panchayatId, {
  type,
  title,
  message,
  applicationId = null,
  verificationId = null,
  email = false,
  actionText = null,
  actionUrl = null,
  conn = null
}) {
  const runner = conn || db;
  const officers = await runner.query(
    'SELECT user_id, email FROM panchayat_officers WHERE panchayat_id = ? AND status = "ACTIVE"',
    [panchayatId]
  );

  const promises = officers.map((off) =>
    notifyUser({
      userId: off.user_id,
      type,
      title,
      message,
      applicationId,
      verificationId,
      email,
      actionText,
      actionUrl,
      conn: runner
    })
  );

  return Promise.all(promises);
}

module.exports = {
  notifyUser,
  notifyPanchayatOfficers
};
