const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { error } = require('../utils/apiResponse');
function authenticate(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return error(res, 'Authentication token missing or invalid', {}, 401);
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // { user_id, role, panchayat_id, officer_id, citizen_id }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Session expired. Please log in again.', {}, 401);
    }
    return error(res, 'Invalid authentication token', {}, 401);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return error(res, 'Unauthorized', {}, 401);
    }

    if (!roles.includes(req.user.role)) {
      return error(res, 'Access denied. You do not have permission for this resource.', {}, 403);
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize
};
