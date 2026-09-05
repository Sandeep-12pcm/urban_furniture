const productService = require('../services/product.service');
const { validateProductCreate, validateProductUpdate } = require('../validators/product.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function getAll(req, res, next) {
  try {
    const result = await productService.getAllProducts(req.query);
    return successResponse(res, result, 'Products retrieved successfully.');
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.id);
    return successResponse(res, product, 'Product retrieved successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const errors = validateProductCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const product = await productService.createProduct(req.body);
    return successResponse(res, product, 'Product created successfully.', 201);
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateProductUpdate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const product = await productService.updateProduct(req.params.id, req.body);
    return successResponse(res, product, 'Product updated successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await productService.deleteProduct(req.params.id);
    return successResponse(res, result.product, result.message);
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
