const contactService = require('../services/contact.service');
const { validateContactCreate, validateContactUpdate } = require('../validators/contact.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function getAll(req, res, next) {
  try {
    const result = await contactService.getAllContacts(req.query);
    return successResponse(res, result, 'Contacts retrieved successfully.');
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const contact = await contactService.getContactById(req.params.id);
    return successResponse(res, contact, 'Contact retrieved successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const errors = validateContactCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const contact = await contactService.createContact(req.body);
    return successResponse(res, contact, 'Contact created successfully.', 201);
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateContactUpdate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const contact = await contactService.updateContact(req.params.id, req.body);
    return successResponse(res, contact, 'Contact updated successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await contactService.deleteContact(req.params.id);
    return successResponse(res, result.contact, result.message);
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
