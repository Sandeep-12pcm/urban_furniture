function validateAnalyticCreate(body = {}) {
  const errors = [];

  if (!body.code || typeof body.code !== 'string' || !body.code.trim()) {
    errors.push('Analytic account code is required.');
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Analytic account name is required.');
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

function validateAnalyticUpdate(body = {}) {
  const errors = [];

  if (body.code !== undefined) {
    if (typeof body.code !== 'string' || !body.code.trim()) {
      errors.push('Analytic account code cannot be empty.');
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('Analytic account name cannot be empty.');
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

module.exports = {
  validateAnalyticCreate,
  validateAnalyticUpdate,
};
