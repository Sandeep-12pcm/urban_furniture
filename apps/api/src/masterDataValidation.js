const { requiredString, emailRegex } = require('./validation');

const mobileRegex = /^(\+91[-\s]?)?[6-9]\d{9}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;

function isValidMoney(value) {
  if (value === undefined || value === null || value === '') return false;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num >= 0;
}

function isValidDateString(value) {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function validateContact(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    const error = requiredString(body.name, 'Contact name');
    if (error) errors.push(error);
    else if (body.name.trim().length > 150) errors.push('Contact name must be 150 characters or fewer.');
  }

  if (!partial || body.type !== undefined) {
    if (!['CUSTOMER', 'VENDOR', 'BOTH'].includes(body.type)) {
      errors.push('Type must be Customer, Vendor, or Both.');
    }
  }

  if (body.email && !emailRegex.test(body.email)) {
    errors.push('Please enter a valid email address.');
  }

  if (body.mobile && !mobileRegex.test(body.mobile)) {
    errors.push('Please enter a valid 10-digit mobile number.');
  }

  if (body.pincode && !pincodeRegex.test(body.pincode)) {
    errors.push('Please enter a valid 6-digit pincode.');
  }

  if (typeof body.city === 'string' && body.city.trim().length > 100) {
    errors.push('City must be 100 characters or fewer.');
  }

  if (typeof body.state === 'string' && body.state.trim().length > 100) {
    errors.push('State must be 100 characters or fewer.');
  }

  return errors;
}

function validateCreatePortalAccount(body = {}) {
  const errors = [
    requiredString(body.loginId, 'Portal login ID'),
    requiredString(body.email, 'Portal email'),
    requiredString(body.password, 'Portal password'),
  ].filter(Boolean);

  if (body.email && !emailRegex.test(body.email)) {
    errors.push('Please enter a valid portal email address.');
  }

  if (body.password && body.password.length < 8) {
    errors.push('Portal password must be at least 8 characters.');
  }

  return errors;
}

function validateProductCategory(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    const error = requiredString(body.name, 'Category name');
    if (error) errors.push(error);
    else if (body.name.trim().length > 100) errors.push('Category name must be 100 characters or fewer.');
  }

  if (body.description !== undefined && body.description !== null && String(body.description).length > 500) {
    errors.push('Description must be 500 characters or fewer.');
  }

  return errors;
}

function validateProduct(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    const error = requiredString(body.name, 'Product name');
    if (error) errors.push(error);
  }

  if (!partial || body.type !== undefined) {
    if (!['GOODS', 'SERVICE', 'COMBO'].includes(body.type)) {
      errors.push('Type must be Goods, Service, or Combo.');
    }
  }

  if (!partial || body.categoryId !== undefined) {
    const error = requiredString(body.categoryId, 'Category');
    if (error) errors.push(error);
  }

  if (!partial || body.salesPrice !== undefined) {
    if (!isValidMoney(body.salesPrice)) errors.push('Sales price must be a valid amount and cannot be negative.');
  }

  if (!partial || body.purchasePrice !== undefined) {
    if (!isValidMoney(body.purchasePrice)) errors.push('Purchase price must be a valid amount and cannot be negative.');
  }

  return errors;
}

function validateAccount(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.accountCode !== undefined) {
    const error = requiredString(body.accountCode, 'Account code');
    if (error) errors.push(error);
    else if (body.accountCode.trim().length > 20) errors.push('Account code must be 20 characters or fewer.');
  }

  if (!partial || body.accountName !== undefined) {
    const error = requiredString(body.accountName, 'Account name');
    if (error) errors.push(error);
  }

  if (!partial || body.type !== undefined) {
    if (!['ASSET', 'LIABILITY', 'EXPENSE', 'INCOME', 'CAPITAL'].includes(body.type)) {
      errors.push('Account type must be Asset, Liability, Expense, Income, or Capital.');
    }
  }

  return errors;
}

function validateJournal(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    const error = requiredString(body.name, 'Journal name');
    if (error) errors.push(error);
  }

  if (!partial || body.type !== undefined) {
    if (!['SALES', 'PURCHASE', 'BANK', 'CASH'].includes(body.type)) {
      errors.push('Journal type must be Sales, Purchase, Bank, or Cash.');
    }
  }

  if (!partial || body.defaultAccountId !== undefined) {
    const error = requiredString(body.defaultAccountId, 'Default account');
    if (error) errors.push(error);
  }

  return errors;
}

function validateAnalyticAccount(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    const error = requiredString(body.name, 'Analytic account name');
    if (error) errors.push(error);
  }

  if (!partial || body.type !== undefined) {
    if (!['INCOME', 'EXPENSE'].includes(body.type)) {
      errors.push('Type must be Income or Expense.');
    }
  }

  return errors;
}

function validateBudget(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    const error = requiredString(body.name, 'Budget name');
    if (error) errors.push(error);
  }

  if (!partial || body.periodStart !== undefined) {
    if (!isValidDateString(body.periodStart)) errors.push('Period start date is required.');
  }

  if (!partial || body.periodEnd !== undefined) {
    if (!isValidDateString(body.periodEnd)) errors.push('Period end date is required.');
  }

  if (
    isValidDateString(body.periodStart) &&
    isValidDateString(body.periodEnd) &&
    new Date(body.periodEnd) < new Date(body.periodStart)
  ) {
    errors.push('Budget end date cannot be before start date.');
  }

  if (!partial || body.plannedAmount !== undefined) {
    if (!isValidMoney(body.plannedAmount)) errors.push('Planned amount must be a valid amount and cannot be negative.');
  }

  if (!partial || body.analyticAccountId !== undefined) {
    const error = requiredString(body.analyticAccountId, 'Analytic account');
    if (error) errors.push(error);
  }

  if (!partial || body.responsibleUserId !== undefined) {
    const error = requiredString(body.responsibleUserId, 'Responsible person');
    if (error) errors.push(error);
  }

  return errors;
}

module.exports = {
  validateContact,
  validateCreatePortalAccount,
  validateProductCategory,
  validateProduct,
  validateAccount,
  validateJournal,
  validateAnalyticAccount,
  validateBudget,
  isValidMoney,
  isValidDateString,
};
