const invoiceService = require('../services/invoice.service');
const { validateInvoiceCreate, validateInvoicePayment } = require('../validators/invoice.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function create(req, res) {
  try {
    const errors = validateInvoiceCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed for invoice creation.', errors, 422);
    }

    const invoice = await invoiceService.createInvoice(req.body);
    return successResponse(res, invoice, 'Customer invoice created successfully.', 201);
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

async function getAll(req, res) {
  try {
    const invoices = await invoiceService.getInvoices(req.query);
    return successResponse(res, invoices, 'Customer invoices retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 500);
  }
}

async function getById(req, res) {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    return successResponse(res, invoice, 'Customer invoice retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 404);
  }
}

async function postInvoice(req, res) {
  try {
    const posted = await invoiceService.postInvoice(req.params.id);
    return successResponse(res, posted, 'Customer invoice posted and balanced journal entry generated.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

async function registerPayment(req, res) {
  try {
    const errors = validateInvoicePayment(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed for payment registration.', errors, 422);
    }

    const result = await invoiceService.registerInvoicePayment(req.params.id, req.body);
    return successResponse(res, result, 'Payment registered against invoice successfully.', 201);
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

module.exports = {
  create,
  getAll,
  getById,
  postInvoice,
  registerPayment,
};
