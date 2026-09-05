const express = require('express');
const contactController = require('../controllers/contact.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('ADMIN', 'ACCOUNTANT'));

router.get('/', contactController.getAll);
router.get('/:id', contactController.getById);
router.post('/', contactController.create);
router.put('/:id', contactController.update);
router.patch('/:id', contactController.update);
router.delete('/:id', contactController.remove);

module.exports = router;
