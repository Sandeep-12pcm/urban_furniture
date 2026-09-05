const accountService = require('../services/account.service');
const { validateAccountCreate, validateAccountUpdate } = require('../validators/account.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function getAll(req, res, next) {
  try {
    const result = await accountService.getAllAccounts(req.query);
    return successResponse(res, result, 'Chart of Accounts retrieved successfully.');
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const account = await accountService.getAccountById(req.params.id);
    return successResponse(res, account, 'Account retrieved successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const errors = validateAccountCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const account = await accountService.createAccount(req.body);
    return successResponse(res, account, 'Account created successfully.', 201);
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateAccountUpdate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const account = await accountService.updateAccount(req.params.id, req.body);
    return successResponse(res, account, 'Account updated successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await accountService.deleteAccount(req.params.id);
    return successResponse(res, result.account, result.message);
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
