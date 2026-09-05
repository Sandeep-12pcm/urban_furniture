const { errorResponse } = require('../utils/response');

const ROLES = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  CONTACT: 'CONTACT',
};

/**
 * RBAC middleware to enforce role permissions.
 * Usage:
 *   requireRole('ADMIN')
 *   requireRole('ADMIN', 'ACCOUNTANT')
 *   requireRole(['ADMIN', 'ACCOUNTANT'])
 */
function requireRole(...roles) {
  const allowedRoles = roles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required.', ['User is not authenticated.'], 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        'Access denied. Insufficient permissions.',
        [`Role '${req.user.role}' is not authorized to access this resource. Allowed roles: ${allowedRoles.join(', ')}`],
        403,
      );
    }

    return next();
  };
}

module.exports = {
  requireRole,
  ROLES,
};
