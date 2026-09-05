// Service-layer functions (salesService, purchaseService, paymentService,
// accountingService) throw via `Object.assign(new Error(message), { status })`
// for expected, user-facing failures (validation, invalid state transitions,
// etc.) — that `.status` + `.message` are safe to return as-is. Anything
// without a numeric `.status` is unexpected (a raw DB error, a bug) and must
// never leak its message to the client.
function sendServiceError(res, error) {
  if (error && typeof error.status === 'number') {
    return res.status(error.status).json({ message: error.message, errors: error.errors });
  }
  console.error(error);
  return res.status(500).json({ message: 'Internal server error.' });
}

module.exports = { sendServiceError };
