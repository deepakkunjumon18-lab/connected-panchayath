function toISO(date) {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days));
  return result;
}

function addHours(date, hours) {
  const result = new Date(date);
  result.setTime(result.getTime() + Number(hours) * 60 * 60 * 1000);
  return result;
}

function isOverdue(dueAt) {
  if (!dueAt) return false;
  return new Date() > new Date(dueAt);
}

module.exports = {
  toISO,
  addDays,
  addHours,
  isOverdue
};
