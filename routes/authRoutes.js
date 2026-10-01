const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authRateLimiter } = require('../middleware/rateLimiter');

router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.get('/me', authMiddleware, authController.getMe);
router.post('/google', authRateLimiter, authController.googleAuth);
router.get('/google/client-id', (req, res) => {
    res.json({
        clientId: process.env.GOOGLE_CLIENT_ID || ''
    });
});
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);

module.exports = router;
