const salesService = require('../services/sales.service');
const { validateSalesOrderCreate, validateSalesOrderUpdate } = require('../validators/sales.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function create(req, res) {
  try {
    const errors = validateSalesOrderCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed for sales order creation.', errors, 422);
    }

    const so = await salesService.createSalesOrder(req.body);
    return successResponse(res, so, 'Sales order created successfully.', 201);
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

async function getAll(req, res) {
  try {
    const orders = await salesService.getSalesOrders(req.query);
    return successResponse(res, orders, 'Sales orders retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 500);
  }
}

async function getById(req, res) {
  try {
    const so = await salesService.getSalesOrderById(req.params.id);
    return successResponse(res, so, 'Sales order retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 404);
  }
}

async function update(req, res) {
  try {
    const errors = validateSalesOrderUpdate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed for sales order update.', errors, 422);
    }

    const updated = await salesService.updateSalesOrder(req.params.id, req.body);
    return successResponse(res, updated, 'Sales order updated successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

async function convertToInvoice(req, res) {
  try {
    const invoice = await salesService.convertSOToInvoice(req.params.id, req.body);
    return successResponse(res, invoice, 'Sales order successfully converted to customer invoice.', 201);
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 400);
  }
}

module.exports = {
  create,
  getAll,
  getById,
  update,
  convertToInvoice,
};
