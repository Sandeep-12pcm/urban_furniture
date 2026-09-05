const VALID_PAYMENT_METHODS = ['CASH', 'BANK'];
const VALID_PAYMENT_TYPES = ['INBOUND', 'OUTBOUND'];
const VALID_PARTNER_TYPES = ['CUSTOMER', 'VENDOR'];

function validatePaymentCreate(body = {}) {
  const errors = [];

  const amount = Number(body.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push('Payment amount must be a number greater than 0.');
  }

  if (body.paymentMethod && !VALID_PAYMENT_METHODS.includes(body.paymentMethod.toUpperCase())) {
    errors.push(`Invalid payment method '${body.paymentMethod}'. Allowed: ${VALID_PAYMENT_METHODS.join(', ')}`);
  }

  if (body.paymentType && !VALID_PAYMENT_TYPES.includes(body.paymentType.toUpperCase())) {
    errors.push(`Invalid payment type '${body.paymentType}'. Allowed: ${VALID_PAYMENT_TYPES.join(', ')}`);
  }

  if (body.partnerType && !VALID_PARTNER_TYPES.includes(body.partnerType.toUpperCase())) {
    errors.push(`Invalid partner type '${body.partnerType}'. Allowed: ${VALID_PARTNER_TYPES.join(', ')}`);
  }

  if (!body.contactId && !body.invoiceId && !body.billId) {
    errors.push('Either contactId, invoiceId, or billId must be provided.');
  }

  if (body.paymentDate && isNaN(Date.parse(body.paymentDate))) {
    errors.push('Payment date must be a valid date.');
  }

  return errors;
}

module.exports = {
  VALID_PAYMENT_METHODS,
  VALID_PAYMENT_TYPES,
  VALID_PARTNER_TYPES,
  validatePaymentCreate,
};
