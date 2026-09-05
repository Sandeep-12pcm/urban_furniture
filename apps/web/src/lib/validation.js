const passwordRules = [
  { test: (value) => value.length >= 8, message: 'Password must be at least 8 characters.' },
  { test: (value) => /[A-Z]/.test(value), message: 'Password must include an uppercase letter.' },
  { test: (value) => /[a-z]/.test(value), message: 'Password must include a lowercase letter.' },
  { test: (value) => /\d/.test(value), message: 'Password must include a number.' },
  { test: (value) => /[^A-Za-z0-9]/.test(value), message: 'Password must include a special character.' },
];

export function validateLogin(form) {
  if (!form.loginId.trim()) return 'Login ID is required.';
  if (!form.password) return 'Password is required.';
  return '';
}

export function validateSignup(form) {
  if (!form.loginId.trim()) return 'Login ID is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
  const passwordError = passwordRules.find((rule) => !rule.test(form.password));
  if (passwordError) return passwordError.message;
  if (form.password !== form.confirmPassword) return 'Passwords do not match.';
  return '';
}

export function validateAdminUser(form) {
  if (!form.loginId.trim()) return 'Login ID is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
  if (!['ACCOUNTANT', 'CONTACT'].includes(form.role)) return 'Role must be Accountant or Contact.';
  const passwordError = passwordRules.find((rule) => !rule.test(form.password));
  if (passwordError) return passwordError.message;
  return '';
}

export function validateReset(form) {
  if (!form.token.trim()) return 'Reset token is required.';
  const passwordError = passwordRules.find((rule) => !rule.test(form.password));
  if (passwordError) return passwordError.message;
  if (form.password !== form.confirmPassword) return 'Passwords do not match.';
  return '';
}
