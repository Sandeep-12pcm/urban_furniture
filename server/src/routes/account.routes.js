const express = require('express');
const accountController = require('../controllers/account.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', accountController.getAll);
router.get('/:id', accountController.getById);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), accountController.create);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), accountController.update);
router.patch('/:id', requireRole('ADMIN', 'ACCOUNTANT'), accountController.update);
router.delete('/:id', requireRole('ADMIN'), accountController.remove);

module.exports = router;
