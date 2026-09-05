const journalService = require('../services/journal.service');
const { validateJournalCreate, validateJournalUpdate } = require('../validators/journal.validator');
const { successResponse, errorResponse } = require('../utils/response');

async function getAll(req, res, next) {
  try {
    const result = await journalService.getAllJournals(req.query);
    return successResponse(res, result, 'Journals retrieved successfully.');
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const journal = await journalService.getJournalById(req.params.id);
    return successResponse(res, journal, 'Journal retrieved successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const errors = validateJournalCreate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const journal = await journalService.createJournal(req.body);
    return successResponse(res, journal, 'Journal created successfully.', 201);
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateJournalUpdate(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], errors, 400);
    }

    const journal = await journalService.updateJournal(req.params.id, req.body);
    return successResponse(res, journal, 'Journal updated successfully.');
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.message, [error.message], error.statusCode);
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await journalService.deleteJournal(req.params.id);
    return successResponse(res, result.journal, result.message);
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
