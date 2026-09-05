const analyticService = require('../services/analytic.service');
const { validateAnalyticCreate, validateAnalyticUpdate } = require('../validators/analytic.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function getAll(req, res, next) {
  try {
    const result = await analyticService.getAllAnalyticAccounts(req.query);
    return successResponse(res, result, 'Analytic Accounts retrieved successfully.');
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const account = await analyticService.getAnalyticAccountById(req.params.id);
    return successResponse(res, account, 'Analytic Account retrieved successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const errors = validateAnalyticCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const account = await analyticService.createAnalyticAccount(req.body);
    return successResponse(res, account, 'Analytic Account created successfully.', 201);
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateAnalyticUpdate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const account = await analyticService.updateAnalyticAccount(req.params.id, req.body);
    return successResponse(res, account, 'Analytic Account updated successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await analyticService.deleteAnalyticAccount(req.params.id);
    return successResponse(res, result.analyticAccount, result.message);
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
