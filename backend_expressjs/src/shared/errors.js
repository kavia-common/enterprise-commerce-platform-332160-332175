'use strict';

const { logger } = require('./logger');

class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details = undefined } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Express error middleware.
 * Adds context and avoids leaking stack traces in production.
 */
function errorMiddleware(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  logger.error(
    {
      op: 'http.error',
      requestId: req?.kavia?.requestId,
      path: req?.path,
      method: req?.method,
      statusCode,
      code,
      errName: err?.name,
      errMessage: err?.message
    },
    'Request failed'
  );

  res.status(statusCode).json({
    error: {
      code,
      message: statusCode >= 500 ? 'Internal server error' : err.message,
      details: statusCode >= 500 ? undefined : err.details
    }
  });
}

module.exports = { AppError, errorMiddleware };
