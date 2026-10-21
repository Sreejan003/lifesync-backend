/**
 * LifeSync Pomodoro Timer Routes
 * -------------------------------------------------------------
 * Mounts Pomodoro focus session endpoints under /api/pomodoro.
 * Protected by JWT authentication middleware.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pomodoroController = require('../controllers/pomodoroController');

// All pomodoro endpoints require authentication
router.use(authMiddleware);

router.post('/session', pomodoroController.recordSession);
router.get('/stats', pomodoroController.getStats);
router.get('/settings', pomodoroController.getSettings);
router.put('/settings', pomodoroController.updateSettings);

module.exports = router;
