const accountingService = require('../services/accounting.service');
const { successResponse, errorResponse } = require('../utils/response');

async function getAll(req, res) {
  try {
    const entries = await accountingService.getJournalEntries(req.query);
    return successResponse(res, entries, 'Journal entries retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 500);
  }
}

async function getById(req, res) {
  try {
    const entry = await accountingService.getJournalEntryById(req.params.id);
    return successResponse(res, entry, 'Journal entry retrieved successfully.');
  } catch (error) {
    return errorResponse(res, error.message, [error.message], 404);
  }
}

module.exports = {
  getAll,
  getById,
};
