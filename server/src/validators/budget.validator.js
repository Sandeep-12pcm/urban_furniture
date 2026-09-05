function isValidDate(dateStr) {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function validateBudgetCreate(body = {}) {
  const errors = [];

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Budget name is required.');
  }

  if (!body.dateFrom) {
    errors.push('Budget start date (dateFrom) is required.');
  } else if (!isValidDate(body.dateFrom)) {
    errors.push('Field dateFrom must be a valid date.');
  }

  if (!body.dateTo) {
    errors.push('Budget end date (dateTo) is required.');
  } else if (!isValidDate(body.dateTo)) {
    errors.push('Field dateTo must be a valid date.');
  }

  if (body.dateFrom && body.dateTo && isValidDate(body.dateFrom) && isValidDate(body.dateTo)) {
    if (new Date(body.dateTo) < new Date(body.dateFrom)) {
      errors.push('End date (dateTo) cannot be earlier than start date (dateFrom).');
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      errors.push('Field items must be an array.');
    } else {
      body.items.forEach((item, index) => {
        if (item.plannedAmount !== undefined && (isNaN(Number(item.plannedAmount)) || Number(item.plannedAmount) < 0)) {
          errors.push(`Item at index ${index}: plannedAmount must be a non-negative number.`);
        }
        if (item.practicalAmount !== undefined && (isNaN(Number(item.practicalAmount)) || Number(item.practicalAmount) < 0)) {
          errors.push(`Item at index ${index}: practicalAmount must be a non-negative number.`);
        }
      });
    }
  }

  return errors;
}

function validateBudgetUpdate(body = {}) {
  const errors = [];

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('Budget name cannot be empty.');
    }
  }

  if (body.dateFrom !== undefined && !isValidDate(body.dateFrom)) {
    errors.push('Field dateFrom must be a valid date.');
  }

  if (body.dateTo !== undefined && !isValidDate(body.dateTo)) {
    errors.push('Field dateTo must be a valid date.');
  }

  if (body.dateFrom && body.dateTo && isValidDate(body.dateFrom) && isValidDate(body.dateTo)) {
    if (new Date(body.dateTo) < new Date(body.dateFrom)) {
      errors.push('End date (dateTo) cannot be earlier than start date (dateFrom).');
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      errors.push('Field items must be an array.');
    } else {
      body.items.forEach((item, index) => {
        if (item.plannedAmount !== undefined && (isNaN(Number(item.plannedAmount)) || Number(item.plannedAmount) < 0)) {
          errors.push(`Item at index ${index}: plannedAmount must be a non-negative number.`);
        }
        if (item.practicalAmount !== undefined && (isNaN(Number(item.practicalAmount)) || Number(item.practicalAmount) < 0)) {
          errors.push(`Item at index ${index}: practicalAmount must be a non-negative number.`);
        }
      });
    }
  }

  return errors;
}

module.exports = {
  validateBudgetCreate,
  validateBudgetUpdate,
};
