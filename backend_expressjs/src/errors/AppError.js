/**
 * Application Error Classes.
 * Provides a hierarchy of typed errors for consistent error handling.
 *
 * Contract:
 * - All business/validation errors extend AppError
 * - AppError carries statusCode, message, and isOperational flag
 * - Non-operational errors indicate unexpected bugs
 */

// PUBLIC_INTERFACE
/**
 * Base application error.
 * @param {string} message - Human-readable error message
 * @param {number} statusCode - HTTP status code
 * @param {boolean} isOperational - Whether this is an expected operational error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// PUBLIC_INTERFACE
/** 400 Bad Request - input validation failures */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400);
    this.details = details;
  }
}

// PUBLIC_INTERFACE
/** 401 Unauthorized - missing or invalid authentication */
class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

// PUBLIC_INTERFACE
/** 403 Forbidden - insufficient permissions */
class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
  }
}

// PUBLIC_INTERFACE
/** 404 Not Found - resource does not exist */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

// PUBLIC_INTERFACE
/** 409 Conflict - duplicate or conflicting resource */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
