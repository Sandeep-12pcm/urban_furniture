const express = require('express');
const productController = require('../controllers/product.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', productController.getAll);
router.get('/:id', productController.getById);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), productController.create);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), productController.update);
router.patch('/:id', requireRole('ADMIN', 'ACCOUNTANT'), productController.update);
router.delete('/:id', requireRole('ADMIN', 'ACCOUNTANT'), productController.remove);

module.exports = router;
