/**
 * Authorization Middleware (RBAC).
 * Restricts access to routes based on user roles.
 *
 * Contract:
 * - Input: Array of allowed roles
 * - Prerequisite: authenticate middleware must run first (req.user must exist)
 * - Output: Passes through if user role is in allowed list
 * - Error: ForbiddenError if user role is not authorized
 */
const { ForbiddenError } = require('../errors/AppError');

// PUBLIC_INTERFACE
/**
 * Create role-based authorization middleware.
 * @param  {...string} allowedRoles - Roles that are permitted access
 * @returns {Function} Express middleware function
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required before authorization'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(`Role '${req.user.role}' is not authorized for this action`));
    }

    next();
  };
}

module.exports = authorize;
