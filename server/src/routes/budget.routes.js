const express = require('express');
const budgetController = require('../controllers/budget.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', budgetController.getAll);
router.get('/:id', budgetController.getById);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), budgetController.create);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), budgetController.update);
router.patch('/:id', requireRole('ADMIN', 'ACCOUNTANT'), budgetController.update);
router.delete('/:id', requireRole('ADMIN'), budgetController.remove);

module.exports = router;
