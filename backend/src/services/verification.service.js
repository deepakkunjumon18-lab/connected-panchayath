const { query, withTransaction } = require('../config/db');
const { generateRequestNo } = require('./sequence.service');
const { addTimelineEvent, refreshApplicationStatus } = require('./application.service');
const { notifyPanchayatOfficers } = require('./notification.service');
const { logAction } = require('./audit.service');
const cryptoService = require('./crypto.service');

/**
 * Helper to compute whether a request is overdue:
 * is_overdue is true if status is PENDING and current time > due_at
 */
function isOverdue(req) {
  if (req.status !== 'PENDING') return false;
  return new Date() > new Date(req.due_at);
}

module.exports = {
  isOverdue
};
