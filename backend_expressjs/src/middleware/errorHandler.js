/**
 * Centralized Error Handling Middleware.
 * Catches all errors and returns consistent JSON responses.
 *
 * Contract:
 * - Catches AppError instances and returns structured error response
 * - Catches unexpected errors and returns generic 500 response
 * - Logs all errors with appropriate severity
 */
const { AppError } = require('../errors/AppError');
const logger = require('../config/logger');
const config = require('../config');

// PUBLIC_INTERFACE
/**
 * Express error handling middleware.
 * Must be registered after all routes.
 * @param {Error} err - The error object
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) {
  // Default values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details || null;

    // Log operational errors at warn level
    logger.warn('Operational error', {
      statusCode,
      message,
      path: req.originalUrl,
      method: req.method,
    });
  } else {
    // Unexpected errors - log full stack at error level
    logger.error('Unexpected error', {
      message: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
    });
  }

  const response = {
    status: 'error',
    statusCode,
    message,
  };

  if (details) {
    response.details = details;
  }

  // Include stack trace in development mode only
  if (!config.isProduction && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
