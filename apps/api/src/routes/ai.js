const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { sendServiceError } = require('../lib/serviceError');
const chat = require('../services/aiChatService');
const provider = require('../services/aiProvider');

// The assistant only ever surfaces business/accounting analytics — the same
// data CONTACT users are already denied everywhere else in the app
// (/api/analytics/*, /api/reports/*). Enforced here at the route, not left
// to the model to police itself.
const businessAccess = (db) => [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];

const SUGGESTIONS = {
  ADMIN: [
    "Give me today's business summary.",
    'How are sales performing this month?',
    'Who owes us money?',
    'How much do we owe vendors?',
    'What is our current inventory value?',
    'Explain our profit trend.',
  ],
  ACCOUNTANT: [
    'Show overdue receivables.',
    'Show overdue vendor bills.',
    'Explain the latest P&L.',
    'Compare this month with last month.',
    'Show cash flow.',
    'Which invoices are partially paid?',
  ],
};

function aiRoutes(db) {
  const router = express.Router();
  const access = businessAccess(db);

  router.post('/ai/chat', ...access, async (req, res) => {
    try {
      const result = await chat.sendMessage(db, req.user, {
        message: req.body.message,
        conversationId: req.body.conversationId,
        context: {
          currentRoute: typeof req.body.context?.currentPage === 'string' ? req.body.context.currentPage.slice(0, 200) : undefined,
          selectedRecordId: typeof req.body.context?.selectedRecordId === 'string' ? req.body.context.selectedRecordId.slice(0, 100) : undefined,
        },
      });
      return res.json(result);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  router.get('/ai/conversations', ...access, async (req, res, next) => {
    try {
      const conversations = await chat.listConversations(db, req.user.id);
      return res.json({ conversations });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/ai/conversations/:id', ...access, async (req, res, next) => {
    try {
      const conversation = await chat.getConversation(db, req.user.id, req.params.id);
      if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
      return res.json({ conversation });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/ai/conversations/:id', ...access, async (req, res, next) => {
    try {
      const deleted = await chat.clearConversation(db, req.user.id, req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Conversation not found.' });
      return res.json({ deleted: true });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/ai/suggestions', ...access, (req, res) => {
    return res.json({ suggestions: SUGGESTIONS[req.user.role] || [], aiAvailable: provider.isConfigured() });
  });

  return router;
}

module.exports = { aiRoutes };
