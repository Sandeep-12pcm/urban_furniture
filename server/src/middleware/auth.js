const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { prisma } = require('../config/db');
const { errorResponse } = require('../utils/response');

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, item) => {
    const [key, ...value] = item.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(value.join('='));
    return cookies;
  }, {});
}

function getToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.access_token || null;
}

function setAuthCookie(res, token) {
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `access_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${secure}`,
  );
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'access_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

async function authenticate(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) {
      return errorResponse(res, 'Authentication required.', ['No authentication token provided.'], 401);
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      return errorResponse(res, 'Invalid or expired token.', [err.message], 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub || payload.id },
      select: {
        id: true,
        loginId: true,
        email: true,
        role: true,
        isActive: true,
        approvalStatus: true,
        approvedAt: true,
        approvedBy: true,
        lastLoginAt: true,
        contactId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return errorResponse(res, 'User no longer exists.', ['User not found.'], 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Your account is inactive.', ['Account disabled.'], 403);
    }

    req.user = user;
    return next();
  } catch (err) {
    return errorResponse(res, 'Authentication failed.', [err.message], 500);
  }
}

module.exports = {
  authenticate,
  getToken,
  setAuthCookie,
  clearAuthCookie,
};
