const VALID_PO_STATUSES = ['DRAFT', 'SENT', 'CONFIRMED', 'CANCELLED'];

function validatePurchaseOrderCreate(body = {}) {
  const errors = [];

  if (!body.vendorId || typeof body.vendorId !== 'string' || !body.vendorId.trim()) {
    errors.push('Vendor ID (vendorId) is required.');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('At least one item is required in the purchase order.');
  } else {
    body.items.forEach((item, index) => {
      if (!item.productId || typeof item.productId !== 'string' || !item.productId.trim()) {
        errors.push(`Item at index ${index}: Product ID (productId) is required.`);
      }
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        errors.push(`Item at index ${index}: Quantity must be greater than 0.`);
      }
      const price = Number(item.unitPrice);
      if (isNaN(price) || price < 0) {
        errors.push(`Item at index ${index}: Unit price must be non-negative.`);
      }
      if (item.taxRate !== undefined && item.taxRate !== null) {
        const tax = Number(item.taxRate);
        if (isNaN(tax) || tax < 0 || tax > 100) {
          errors.push(`Item at index ${index}: Tax rate must be between 0 and 100.`);
        }
      }
    });
  }

  if (body.status && !VALID_PO_STATUSES.includes(body.status)) {
    errors.push(`Invalid status '${body.status}'. Allowed: ${VALID_PO_STATUSES.join(', ')}`);
  }

  return errors;
}

function validatePurchaseOrderUpdate(body = {}) {
  const errors = [];

  if (body.vendorId !== undefined) {
    if (typeof body.vendorId !== 'string' || !body.vendorId.trim()) {
      errors.push('Vendor ID cannot be empty.');
    }
  }

  if (body.status !== undefined) {
    if (!VALID_PO_STATUSES.includes(body.status)) {
      errors.push(`Invalid status '${body.status}'. Allowed: ${VALID_PO_STATUSES.join(', ')}`);
    }
  }

  if (body.items !== undefined) {
    if (!Array.isArray(body.items) || body.items.length === 0) {
      errors.push('If items are provided, at least one item is required.');
    } else {
      body.items.forEach((item, index) => {
        if (!item.productId || typeof item.productId !== 'string' || !item.productId.trim()) {
          errors.push(`Item at index ${index}: Product ID (productId) is required.`);
        }
        const qty = Number(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          errors.push(`Item at index ${index}: Quantity must be greater than 0.`);
        }
        const price = Number(item.unitPrice);
        if (isNaN(price) || price < 0) {
          errors.push(`Item at index ${index}: Unit price must be non-negative.`);
        }
        if (item.taxRate !== undefined && item.taxRate !== null) {
          const tax = Number(item.taxRate);
          if (isNaN(tax) || tax < 0 || tax > 100) {
            errors.push(`Item at index ${index}: Tax rate must be between 0 and 100.`);
          }
        }
      });
    }
  }

  return errors;
}

module.exports = {
  VALID_PO_STATUSES,
  validatePurchaseOrderCreate,
  validatePurchaseOrderUpdate,
};
