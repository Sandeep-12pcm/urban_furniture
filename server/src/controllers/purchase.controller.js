const purchaseService = require('../services/purchase.service');
const { validatePurchaseOrderCreate, validatePurchaseOrderUpdate } = require('../validators/purchase.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function create(req, res) {
  try {
    const errors = validatePurchaseOrderCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed for purchase order creation.', errors, 422);
    }

    const po = await purchaseService.createPurchaseOrder(req.body);
    return successResponse(res, po, 'Purchase order created successfully.', 201);
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

async function getAll(req, res) {
  try {
    const orders = await purchaseService.getPurchaseOrders(req.query);
    return successResponse(res, orders, 'Purchase orders retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 500);
  }
}

async function getById(req, res) {
  try {
    const po = await purchaseService.getPurchaseOrderById(req.params.id);
    return successResponse(res, po, 'Purchase order retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 404);
  }
}

async function update(req, res) {
  try {
    const errors = validatePurchaseOrderUpdate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed for purchase order update.', errors, 422);
    }

    const updated = await purchaseService.updatePurchaseOrder(req.params.id, req.body);
    return successResponse(res, updated, 'Purchase order updated successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

async function convertToBill(req, res) {
  try {
    const vendorBill = await purchaseService.convertPOToBill(req.params.id, req.body);
    return successResponse(res, vendorBill, 'Purchase order successfully converted to vendor bill.', 201);
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

module.exports = {
  create,
  getAll,
  getById,
  update,
  convertToBill,
};
