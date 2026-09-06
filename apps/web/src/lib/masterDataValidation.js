const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobileRegex = /^(\+91[-\s]?)?[6-9]\d{9}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;

function isBlank(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function isValidMoney(value) {
  if (value === '' || value === null || value === undefined) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

export function validateContactForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = 'Contact name is required.';
  else if (form.name.trim().length > 150) errors.name = 'Contact name must be 150 characters or fewer.';

  if (!['CUSTOMER', 'VENDOR', 'BOTH'].includes(form.type)) errors.type = 'Type is required.';

  if (form.email && !emailRegex.test(form.email)) errors.email = 'Please enter a valid email address.';
  if (form.mobile && !mobileRegex.test(form.mobile)) errors.mobile = 'Please enter a valid 10-digit mobile number.';
  if (form.pincode && !pincodeRegex.test(form.pincode)) errors.pincode = 'Please enter a valid 6-digit pincode.';

  if (form.createPortalAccount) {
    if (isBlank(form.portalLoginId)) errors.portalLoginId = 'Portal login ID is required.';
    if (isBlank(form.portalEmail) || !emailRegex.test(form.portalEmail)) {
      errors.portalEmail = 'A valid portal email is required.';
    }
    if (isBlank(form.portalPassword) || form.portalPassword.length < 8) {
      errors.portalPassword = 'Portal password must be at least 8 characters.';
    }
  }

  return errors;
}

export function validateCategoryForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = 'Category name is required.';
  else if (form.name.trim().length > 100) errors.name = 'Category name must be 100 characters or fewer.';
  return errors;
}

export function validateProductForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = 'Product name is required.';
  if (!['GOODS', 'SERVICE', 'COMBO'].includes(form.type)) errors.type = 'Type is required.';
  if (isBlank(form.categoryId)) errors.categoryId = 'Category is required.';
  if (!isValidMoney(form.salesPrice)) errors.salesPrice = 'Sales price must be a valid amount and cannot be negative.';
  if (!isValidMoney(form.purchasePrice)) errors.purchasePrice = 'Purchase price must be a valid amount and cannot be negative.';

  if (form.sku && form.sku.trim().length > 50) errors.sku = 'SKU must be 50 characters or fewer.';
  if (form.barcode && form.barcode.trim().length > 50) errors.barcode = 'Barcode must be 50 characters or fewer.';
  if (form.taxRate !== undefined && form.taxRate !== null && form.taxRate !== '') {
    const rate = Number(form.taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      errors.taxRate = 'Tax rate must be between 0% and 100%.';
    }
  }
  if (form.imageUrl && form.imageUrl.trim().length > 1000) errors.imageUrl = 'Image URL must be 1000 characters or fewer.';
  if (form.stock !== undefined && form.stock !== null && form.stock !== '') {
    const stock = Number(form.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      errors.stock = 'Stock quantity cannot be negative.';
    }
  }
  if (form.initialStock !== undefined && form.initialStock !== null && form.initialStock !== '') {
    const stock = Number(form.initialStock);
    if (!Number.isFinite(stock) || stock < 0) {
      errors.initialStock = 'Initial stock cannot be negative.';
    }
  }
  return errors;
}

export function validateAccountForm(form) {
  const errors = {};
  if (isBlank(form.accountCode)) errors.accountCode = 'Account code is required.';
  if (isBlank(form.accountName)) errors.accountName = 'Account name is required.';
  if (!['ASSET', 'LIABILITY', 'EXPENSE', 'INCOME', 'CAPITAL'].includes(form.type)) errors.type = 'Account type is required.';
  return errors;
}

export function validateJournalForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = 'Journal name is required.';
  if (!['SALES', 'PURCHASE', 'BANK', 'CASH'].includes(form.type)) errors.type = 'Journal type is required.';
  if (isBlank(form.defaultAccountId)) errors.defaultAccountId = 'Default account is required.';
  return errors;
}

export function validateAnalyticAccountForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = 'Analytic account name is required.';
  if (!['INCOME', 'EXPENSE'].includes(form.type)) errors.type = 'Type is required.';
  return errors;
}

export function validateBudgetForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = 'Budget name is required.';
  if (isBlank(form.periodStart)) errors.periodStart = 'Period start date is required.';
  if (isBlank(form.periodEnd)) errors.periodEnd = 'Period end date is required.';
  if (form.periodStart && form.periodEnd && new Date(form.periodEnd) < new Date(form.periodStart)) {
    errors.periodEnd = 'Budget end date cannot be before start date.';
  }
  if (!isValidMoney(form.plannedAmount)) errors.plannedAmount = 'Planned amount must be a valid amount and cannot be negative.';
  if (isBlank(form.analyticAccountId)) errors.analyticAccountId = 'Analytic account is required.';
  if (isBlank(form.responsibleUserId)) errors.responsibleUserId = 'Responsible person is required.';
  return errors;
}
