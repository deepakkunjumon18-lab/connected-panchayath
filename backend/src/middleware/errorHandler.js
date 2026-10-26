const env = require('../config/env');

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds maximum allowed limit of 5MB';
    } else {
      message = `Upload error: ${err.message}`;
    }
  }

  const response = {
    success: false,
    message
  };

  if (err.errors && Object.keys(err.errors).length > 0) {
    response.errors = err.errors;
  }

  if (env.NODE_ENV === 'development' && statusCode === 500) {
    response.stack = err.stack;
  }

  // Log unexpected server errors
  if (statusCode === 500) {
    console.error('Unhandled server error:', err);
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
