const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
