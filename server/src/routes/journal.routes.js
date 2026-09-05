const express = require('express');
const journalController = require('../controllers/journal.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', journalController.getAll);
router.get('/:id', journalController.getById);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), journalController.create);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), journalController.update);
router.patch('/:id', requireRole('ADMIN', 'ACCOUNTANT'), journalController.update);
router.delete('/:id', requireRole('ADMIN'), journalController.remove);

module.exports = router;
