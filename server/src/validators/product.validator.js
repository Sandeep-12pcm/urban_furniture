const VALID_PRODUCT_TYPES = ['STORABLE', 'CONSUMABLE', 'SERVICE'];

function validateProductCreate(body = {}) {
  const errors = [];

  if (!body.code || typeof body.code !== 'string' || !body.code.trim()) {
    errors.push('Product code is required.');
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Product name is required.');
  }

  if (body.type && !VALID_PRODUCT_TYPES.includes(body.type)) {
    errors.push(`Invalid product type '${body.type}'. Allowed values: ${VALID_PRODUCT_TYPES.join(', ')}`);
  }

  if (body.salesPrice !== undefined && body.salesPrice !== null) {
    const num = Number(body.salesPrice);
    if (isNaN(num) || num < 0) {
      errors.push('Sales price must be a non-negative number.');
    }
  }

  if (body.costPrice !== undefined && body.costPrice !== null) {
    const num = Number(body.costPrice);
    if (isNaN(num) || num < 0) {
      errors.push('Cost price must be a non-negative number.');
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

function validateProductUpdate(body = {}) {
  const errors = [];

  if (body.code !== undefined) {
    if (typeof body.code !== 'string' || !body.code.trim()) {
      errors.push('Product code cannot be empty.');
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('Product name cannot be empty.');
    }
  }

  if (body.type !== undefined && !VALID_PRODUCT_TYPES.includes(body.type)) {
    errors.push(`Invalid product type '${body.type}'. Allowed values: ${VALID_PRODUCT_TYPES.join(', ')}`);
  }

  if (body.salesPrice !== undefined && body.salesPrice !== null) {
    const num = Number(body.salesPrice);
    if (isNaN(num) || num < 0) {
      errors.push('Sales price must be a non-negative number.');
    }
  }

  if (body.costPrice !== undefined && body.costPrice !== null) {
    const num = Number(body.costPrice);
    if (isNaN(num) || num < 0) {
      errors.push('Cost price must be a non-negative number.');
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Field isActive must be a boolean.');
  }

  return errors;
}

module.exports = {
  validateProductCreate,
  validateProductUpdate,
};
