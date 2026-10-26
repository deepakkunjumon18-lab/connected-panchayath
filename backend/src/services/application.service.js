const db = require('../config/db');

async function runQuery(runner, sql, params = []) {
  if (runner && runner !== db) {
    const [rows] = await runner.query(sql, params);
    return rows;
  }
  return await db.query(sql, params);
}

/**
 * Re-evaluates application status based on pending/completed verification requests.
 * Only modifies applications that are currently in SUBMITTED, PENDING_EXTERNAL, or READY_FOR_DECISION.
 */
async function refreshApplicationStatus(applicationId, conn = null) {
  const runner = conn || db;

  const apps = await runQuery(
    runner,
    'SELECT status FROM applications WHERE application_id = ?',
    [applicationId]
  );
  if (!apps || !apps.length) return null;

  const currentStatus = apps[0].status;
  if (!['SUBMITTED', 'PENDING_EXTERNAL', 'READY_FOR_DECISION'].includes(currentStatus)) {
    return currentStatus;
  }

  // Count requests by status
  const requests = await runQuery(
    runner,
    'SELECT status FROM verification_requests WHERE application_id = ? AND status != "CANCELLED"',
    [applicationId]
  );

  let newStatus = 'SUBMITTED';
  const pendingCount = (requests || []).filter((r) => r.status === 'PENDING').length;

  if (pendingCount > 0) {
    newStatus = 'PENDING_EXTERNAL';
  } else if (requests && requests.length > 0) {
    newStatus = 'READY_FOR_DECISION';
  } else {
    newStatus = 'SUBMITTED';
  }

  if (newStatus !== currentStatus) {
    await runQuery(
      runner,
      'UPDATE applications SET status = ? WHERE application_id = ?',
      [newStatus, applicationId]
    );
  }

  return newStatus;
}

/**
 * Adds an event to the application_timeline
 */
async function addTimelineEvent(applicationId, { eventType, title, description = null, actorUserId = null }, conn = null) {
  const runner = conn || db;
  const sql = `
    INSERT INTO application_timeline (application_id, event_type, title, description, actor_user_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  const result = await runQuery(runner, sql, [
    applicationId,
    eventType,
    title,
    description,
    actorUserId ? Number(actorUserId) : null
  ]);
  return result.insertId;
}

module.exports = {
  refreshApplicationStatus,
  addTimelineEvent
};
