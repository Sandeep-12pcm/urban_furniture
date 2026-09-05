const paymentService = require('../services/payment.service');
const { validatePaymentCreate } = require('../validators/payment.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function create(req, res) {
  try {
    const errors = validatePaymentCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed for payment creation.', errors, 422);
    }

    const payment = await paymentService.createPayment(req.body);
    return successResponse(res, payment, 'Payment created and balanced journal entry generated.', 201);
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

async function getAll(req, res) {
  try {
    const payments = await paymentService.getPayments(req.query);
    return successResponse(res, payments, 'Payments retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 500);
  }
}

async function getById(req, res) {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    return successResponse(res, payment, 'Payment retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 404);
  }
}

module.exports = {
  create,
  getAll,
  getById,
};
