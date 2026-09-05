const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return `${label} is required.`;
  }
  return null;
}

function validatePassword(password) {
  const required = requiredString(password, 'Password');
  if (required) return required;
  if (!passwordRegex.test(password)) {
    return 'Password does not meet the required security requirements.';
  }
  return null;
}

function validateLogin(body) {
  return [
    requiredString(body.loginId, 'Login ID'),
    requiredString(body.password, 'Password'),
  ].filter(Boolean);
}

function validateUserCreation(body) {
  const errors = [
    requiredString(body.loginId, 'Login ID'),
    requiredString(body.email, 'Email'),
    validatePassword(body.password),
  ].filter(Boolean);

  if (body.email && !emailRegex.test(body.email)) {
    errors.push('Please enter a valid email address.');
  }

  if (!['ACCOUNTANT', 'CONTACT'].includes(body.role)) {
    errors.push('Role must be ACCOUNTANT or CONTACT.');
  }

  return errors;
}

function validateSignup(body) {
  const errors = [
    requiredString(body.loginId, 'Login ID'),
    requiredString(body.email, 'Email'),
    validatePassword(body.password),
  ].filter(Boolean);

  if (body.email && !emailRegex.test(body.email)) {
    errors.push('Please enter a valid email address.');
  }

  if (!['ACCOUNTANT', 'CUSTOMER', 'VENDOR'].includes(body.accountType)) {
    errors.push('Account type must be Accountant, Customer, or Vendor.');
  }

  if (body.password !== body.confirmPassword) {
    errors.push('Passwords do not match.');
  }
  return errors;
}

function validateResetPassword(body) {
  const errors = [
    requiredString(body.token, 'Reset token'),
    validatePassword(body.password),
  ].filter(Boolean);
  if (body.password !== body.confirmPassword) {
    errors.push('Passwords do not match.');
  }
  return errors;
}

module.exports = {
  validateLogin,
  validateSignup,
  validateUserCreation,
  validateResetPassword,
};
