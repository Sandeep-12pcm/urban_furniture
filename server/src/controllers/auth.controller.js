const authService = require('../services/auth.service');
const { validateLogin } = require('../validators/auth.validator');
const { setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/response');

async function login(req, res, next) {
  try {
    const errors = validateLogin(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const identifier = req.body.loginId || req.body.email;
    const { password } = req.body;

    const { user, token } = await authService.loginUser({ identifier, password });

    setAuthCookie(res, token);

    return successResponse(
      res,
      { user, token },
      'Login successful.',
      200,
      {
        user,
        token,
        authenticated: true,
      },
    );
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function getMe(req, res) {
  return successResponse(
    res,
    { user: req.user },
    'Current user profile retrieved.',
    200,
    {
      user: req.user,
      authenticated: true,
    },
  );
}

async function logout(req, res) {
  clearAuthCookie(res);
  return successResponse(
    res,
    null,
    'Logged out successfully.',
    200,
    {
      authenticated: false,
    },
  );
}

module.exports = {
  login,
  getMe,
  logout,
};
