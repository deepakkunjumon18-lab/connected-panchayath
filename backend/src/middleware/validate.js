const { error } = require('../utils/apiResponse');

/**
 * Zod validation middleware for req.body or req.query
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const dataToValidate = req[source];
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const formattedErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || 'root';
        formattedErrors[field] = issue.message;
      }
      return error(res, 'Validation error', formattedErrors, 400);
    }

    req[source] = result.data;
    next();
  };
}

module.exports = validate;
