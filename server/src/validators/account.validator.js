const VALID_ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

function validateAccountCreate(body = {}) {
  const errors = [];

  if (!body.code || typeof body.code !== 'string' || !body.code.trim()) {
    errors.push('Account code is required.');
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Account name is required.');
  }

  if (!body.type || !VALID_ACCOUNT_TYPES.includes(body.type)) {
    errors.push(`Account type is required and must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`);
  }

  if (body.currentBalance !== undefined && body.currentBalance !== null) {
    if (isNaN(Number(body.currentBalance))) {
      errors.push('Current balance must be a valid number.');
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

function validateAccountUpdate(body = {}) {
  const errors = [];

  if (body.code !== undefined) {
    if (typeof body.code !== 'string' || !body.code.trim()) {
      errors.push('Account code cannot be empty.');
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('Account name cannot be empty.');
    }
  }

  if (body.type !== undefined && !VALID_ACCOUNT_TYPES.includes(body.type)) {
    errors.push(`Account type must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`);
  }

  if (body.currentBalance !== undefined && body.currentBalance !== null) {
    if (isNaN(Number(body.currentBalance))) {
      errors.push('Current balance must be a valid number.');
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

module.exports = {
  validateAccountCreate,
  validateAccountUpdate,
};
