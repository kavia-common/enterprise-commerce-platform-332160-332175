'use strict';

const jwt = require('jsonwebtoken');
const { AppError } = require('../shared/errors');

/**
 * Expected JWT claims (minimal for this template):
 * - sub: user id (uuid)
 * - email: user email
 * - role: 'admin' | 'user'
 */
function requireAuth(req, _res, next) {
  const auth = req.headers.authorization || '';
  const [type, token] = auth.split(' ');

  if (type !== 'Bearer' || !token) {
    return next(new AppError('Missing Authorization header', { statusCode: 401, code: 'UNAUTHORIZED' }));
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required');
    const payload = jwt.verify(token, secret);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'user'
    };
    return next();
  } catch (_e) {
    return next(new AppError('Invalid token', { statusCode: 401, code: 'UNAUTHORIZED' }));
  }
}

function requireAdmin(req, _res, next) {
  if (!req.user) {
    return next(new AppError('Unauthorized', { statusCode: 401, code: 'UNAUTHORIZED' }));
  }
  if (req.user.role !== 'admin') {
    return next(new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' }));
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };
