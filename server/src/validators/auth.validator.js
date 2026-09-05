function validateLogin(body = {}) {
  const errors = [];
  const identifier = body.loginId || body.email;

  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    errors.push('Login ID or Email is required.');
  }

  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password is required.');
  } else if (body.password.length < 4) {
    errors.push('Password must be at least 4 characters.');
  }

  return errors;
}

module.exports = {
  validateLogin,
};
