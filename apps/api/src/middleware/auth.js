const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { findSafeUserById } = require('../db/users');

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
    return authHeader.slice(7);
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.access_token;
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

function authenticate(db) {
  return async (req, res, next) => {
    try {
      const token = getToken(req);
      if (!token) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      const payload = jwt.verify(token, config.jwtSecret);
      const user = await findSafeUserById(db, payload.sub);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      req.user = user;
      return next();
    } catch {
      return res.status(401).json({ message: 'Authentication required.' });
    }
  };
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not authorized to access this resource.' });
    }
    return next();
  };
}

module.exports = {
  authenticate,
  authorize,
  setAuthCookie,
  clearAuthCookie,
};
