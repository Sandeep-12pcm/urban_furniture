const budgetService = require('../services/budget.service');
const { validateBudgetCreate, validateBudgetUpdate } = require('../validators/budget.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function getAll(req, res, next) {
  try {
    const result = await budgetService.getAllBudgets(req.query);
    return successResponse(res, result, 'Budgets retrieved successfully.');
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const budget = await budgetService.getBudgetById(req.params.id);
    return successResponse(res, budget, 'Budget retrieved successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const errors = validateBudgetCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const budget = await budgetService.createBudget(req.body);
    return successResponse(res, budget, 'Budget created successfully.', 201);
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateBudgetUpdate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const budget = await budgetService.updateBudget(req.params.id, req.body);
    return successResponse(res, budget, 'Budget updated successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await budgetService.deleteBudget(req.params.id);
    return successResponse(res, result.budget, result.message);
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
