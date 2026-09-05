const VALID_JOURNAL_TYPES = ['SALE', 'PURCHASE', 'CASH', 'BANK', 'GENERAL'];

function validateJournalCreate(body = {}) {
  const errors = [];

  if (!body.code || typeof body.code !== 'string' || !body.code.trim()) {
    errors.push('Journal code is required.');
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Journal name is required.');
  }

  if (!body.type || !VALID_JOURNAL_TYPES.includes(body.type)) {
    errors.push(`Journal type is required and must be one of: ${VALID_JOURNAL_TYPES.join(', ')}`);
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

function validateJournalUpdate(body = {}) {
  const errors = [];

  if (body.code !== undefined) {
    if (typeof body.code !== 'string' || !body.code.trim()) {
      errors.push('Journal code cannot be empty.');
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('Journal name cannot be empty.');
    }
  }

  if (body.type !== undefined && !VALID_JOURNAL_TYPES.includes(body.type)) {
    errors.push(`Journal type must be one of: ${VALID_JOURNAL_TYPES.join(', ')}`);
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

module.exports = {
  validateJournalCreate,
  validateJournalUpdate,
};
