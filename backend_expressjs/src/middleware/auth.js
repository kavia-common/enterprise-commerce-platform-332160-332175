/**
 * Authentication Middleware.
 * Verifies JWT tokens and attaches user information to the request.
 *
 * Contract:
 * - Input: Authorization header with Bearer token
 * - Output: req.user populated with { id, email, role }
 * - Error: UnauthorizedError if token missing/invalid/expired
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError } = require('../errors/AppError');
const logger = require('../config/logger');

// PUBLIC_INTERFACE
/**
 * Middleware that verifies JWT Bearer token.
 * Populates req.user with decoded token payload on success.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Access token is required'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error) {
    logger.warn('JWT verification failed', { error: error.message });
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token has expired'));
    }
    return next(new UnauthorizedError('Invalid access token'));
  }
}

module.exports = authenticate;
