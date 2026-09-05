const VALID_BILL_STATUSES = ['DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED'];

function validateVendorBillCreate(body = {}) {
  const errors = [];

  if (!body.vendorId || typeof body.vendorId !== 'string' || !body.vendorId.trim()) {
    errors.push('Vendor ID (vendorId) is required.');
  }

  if (body.billDate && isNaN(Date.parse(body.billDate))) {
    errors.push('Bill date (billDate) must be a valid date.');
  }

  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    errors.push('Due date (dueDate) must be a valid date.');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('At least one item is required in the vendor bill.');
  } else {
    body.items.forEach((item, index) => {
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

  if (body.status && !VALID_BILL_STATUSES.includes(body.status)) {
    errors.push(`Invalid status '${body.status}'. Allowed: ${VALID_BILL_STATUSES.join(', ')}`);
  }

  return errors;
}

function validateBillPayment(body = {}) {
  const errors = [];

  const amount = Number(body.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push('Payment amount must be a number greater than 0.');
  }

  if (!body.paymentMethod || !['CASH', 'BANK'].includes(body.paymentMethod.toUpperCase())) {
    errors.push("Payment method must be either 'CASH' or 'BANK'.");
  }

  if (body.paymentDate && isNaN(Date.parse(body.paymentDate))) {
    errors.push('Payment date must be a valid date.');
  }

  return errors;
}

module.exports = {
  VALID_BILL_STATUSES,
  validateVendorBillCreate,
  validateBillPayment,
};
