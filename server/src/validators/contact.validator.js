const VALID_TYPES = ['CUSTOMER', 'VENDOR', 'BOTH'];

function validateContactCreate(body = {}) {
  const errors = [];

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Contact name is required.');
  }

  if (body.type && !VALID_TYPES.includes(body.type)) {
    errors.push(`Invalid contact type '${body.type}'. Allowed values: ${VALID_TYPES.join(', ')}`);
  }

  if (body.email && typeof body.email === 'string' && body.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      errors.push('Invalid email address format.');
    }
  }

  if (body.isCompany !== undefined && typeof body.isCompany !== 'boolean') {
    errors.push('Field isCompany must be a boolean.');
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

function validateContactUpdate(body = {}) {
  const errors = [];

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('Contact name cannot be empty.');
    }
  }

  if (body.type !== undefined && !VALID_TYPES.includes(body.type)) {
    errors.push(`Invalid contact type '${body.type}'. Allowed values: ${VALID_TYPES.join(', ')}`);
  }

  if (body.email !== undefined && body.email !== null && body.email !== '') {
    if (typeof body.email !== 'string') {
      errors.push('Email must be a string.');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email.trim())) {
        errors.push('Invalid email address format.');
      }
    }
  }

  if (body.isCompany !== undefined && typeof body.isCompany !== 'boolean') {
    errors.push('Field isCompany must be a boolean.');
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

module.exports = {
  validateContactCreate,
  validateContactUpdate,
};
