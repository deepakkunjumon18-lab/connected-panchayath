function success(res, data = null, message = undefined, statusCode = 200) {
  const payload = { success: true };
  if (data !== null && data !== undefined) {
    payload.data = data;
  }
  if (message) {
    payload.message = message;
  }
  return res.status(statusCode).json(payload);
}

function error(res, message = 'An error occurred', errors = {}, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: Object.keys(errors).length > 0 ? errors : undefined
  });
}

function paginated(res, items = [], total = 0, page = 1, limit = 10, message = undefined) {
  const payload = {
    success: true,
    data: {
      items,
      total: Number(total),
      page: Number(page),
      limit: Number(limit)
    }
  };
  if (message) {
    payload.message = message;
  }
  return res.status(200).json(payload);
}

module.exports = {
  success,
  error,
  paginated
};
