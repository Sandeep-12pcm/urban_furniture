const vendorBillService = require('../services/vendorBill.service');
const { validateVendorBillCreate, validateBillPayment } = require('../validators/vendorBill.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function create(req, res) {
  try {
    const errors = validateVendorBillCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed for vendor bill creation.', errors, 422);
    }

    const bill = await vendorBillService.createVendorBill(req.body);
    return successResponse(res, bill, 'Vendor bill created successfully.', 201);
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

async function getAll(req, res) {
  try {
    const bills = await vendorBillService.getVendorBills(req.query);
    return successResponse(res, bills, 'Vendor bills retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 500);
  }
}

async function getById(req, res) {
  try {
    const bill = await vendorBillService.getVendorBillById(req.params.id);
    return successResponse(res, bill, 'Vendor bill retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 404);
  }
}

async function postBill(req, res) {
  try {
    const posted = await vendorBillService.postVendorBill(req.params.id);
    return successResponse(res, posted, 'Vendor bill posted and balanced journal entry generated.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

async function registerPayment(req, res) {
  try {
    const errors = validateBillPayment(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed for payment registration.', errors, 422);
    }

    const result = await vendorBillService.registerBillPayment(req.params.id, req.body);
    return successResponse(res, result, 'Payment registered against vendor bill successfully.', 201);
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

module.exports = {
  create,
  getAll,
  getById,
  postBill,
  registerPayment,
};
