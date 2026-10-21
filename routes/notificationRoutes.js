/**
 * LifeSync Notification Routes
 * -------------------------------------------------------------
 * Mounts notification center endpoints under /api/notifications.
 * Protected by JWT authentication middleware.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

// All notification routes require authenticated user
router.use(authMiddleware);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.post('/check-triggers', notificationController.checkTriggers);
router.put('/mark-all-read', notificationController.markAllNotificationsRead);
router.delete('/', notificationController.clearAllNotifications);

router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

// Web Push API (Closed-browser notifications)
router.get('/vapid-public-key', notificationController.getVapidPublicKey);
router.post('/push-subscribe', notificationController.subscribePush);
router.post('/push-unsubscribe', notificationController.unsubscribePush);
router.post('/push-test', notificationController.sendTestPush);

router.put('/:id/read', notificationController.markNotificationRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
