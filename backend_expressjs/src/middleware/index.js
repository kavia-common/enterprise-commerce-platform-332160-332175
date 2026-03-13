/**
 * Middleware barrel export.
 * Aggregates all custom middleware for convenient importing.
 */
const authenticate = require('./auth');
const authorize = require('./authorize');
const validate = require('./validate');
const errorHandler = require('./errorHandler');

module.exports = {
  authenticate,
  authorize,
  validate,
  errorHandler,
};
