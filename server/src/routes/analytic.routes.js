const express = require('express');
const analyticController = require('../controllers/analytic.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', analyticController.getAll);
router.get('/:id', analyticController.getById);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), analyticController.create);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), analyticController.update);
router.patch('/:id', requireRole('ADMIN', 'ACCOUNTANT'), analyticController.update);
router.delete('/:id', requireRole('ADMIN'), analyticController.remove);

module.exports = router;
