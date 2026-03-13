/**
 * Request Validation Middleware.
 * Factory function that creates Express middleware from Joi schemas.
 *
 * Contract:
 * - Input: Joi schema and request property to validate ('body', 'query', 'params')
 * - Output: Middleware that validates and strips unknown fields
 * - Error: Throws ValidationError with details on failure
 */
const { ValidationError } = require('../errors/AppError');

// PUBLIC_INTERFACE
/**
 * Create validation middleware from a Joi schema.
 * @param {import('joi').ObjectSchema} schema - Joi validation schema
 * @param {'body'|'query'|'params'} property - Request property to validate
 * @returns {Function} Express middleware function
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }

    // Replace with validated/sanitized data
    req[property] = value;
    next();
  };
}

module.exports = validate;
