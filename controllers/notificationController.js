/**
 * LifeSync Notification Controller
 * -------------------------------------------------------------
 * REST API endpoints for user notification center and preferences.
 */

const notificationService = require('../services/notificationService');

/**
 * GET /api/notifications
 */
async function getNotifications(req, res, next) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit, 10) || 50;
        const result = await notificationService.getNotifications(userId, limit);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/notifications/unread-count
 */
async function getUnreadCount(req, res, next) {
    try {
        const userId = req.user.id;
        const count = await notificationService.getUnreadCount(userId);
        res.status(200).json({ unreadCount: count });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/notifications/:id/read
 */
async function markNotificationRead(req, res, next) {
    try {
        const userId = req.user.id;
        const id = parseInt(req.params.id, 10);
        const updated = await notificationService.markRead(id, userId);
        if (!updated) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.status(200).json({ notification: updated });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/notifications/mark-all-read
 */
async function markAllNotificationsRead(req, res, next) {
    try {
        const userId = req.user.id;
        const result = await notificationService.markAllRead(userId);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/notifications/:id
 */
async function deleteNotification(req, res, next) {
    try {
        const userId = req.user.id;
        const id = parseInt(req.params.id, 10);
        const success = await notificationService.deleteNotification(id, userId);
        if (!success) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.status(200).json({ success: true });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/notifications
 */
async function clearAllNotifications(req, res, next) {
    try {
        const userId = req.user.id;
        const result = await notificationService.clearAllNotifications(userId);
        res.status(200).json({ success: true, deleted: result.deleted });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/notifications/preferences
 */
async function getPreferences(req, res, next) {
    try {
        const userId = req.user.id;
        const prefs = await notificationService.getPreferences(userId);
        res.status(200).json({ preferences: prefs });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/notifications/preferences
 */
async function updatePreferences(req, res, next) {
    try {
        const userId = req.user.id;
        const updated = await notificationService.updatePreferences(userId, req.body || {});
        res.status(200).json({ preferences: updated });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/notifications/check-triggers
 * Manually trigger or refresh notifications evaluation for the current user
 */
async function checkTriggers(req, res, next) {
    try {
        const userId = req.user.id;
        const generated = await notificationService.evaluateUserTriggers(userId);
        const data = await notificationService.getNotifications(userId);
        res.status(200).json({
            newAlertsGenerated: generated.length,
            ...data
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/notifications/vapid-public-key
 */
async function getVapidPublicKey(req, res, next) {
    try {
        const pushNotificationService = require('../services/pushNotificationService');
        const key = pushNotificationService.getVapidPublicKey();
        res.status(200).json({ publicKey: key });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/notifications/push-subscribe
 */
async function subscribePush(req, res, next) {
    try {
        const userId = req.user.id;
        const subscription = req.body.subscription || req.body;
        const pushNotificationService = require('../services/pushNotificationService');
        const result = await pushNotificationService.savePushSubscription(
            userId,
            subscription,
            req.headers['user-agent'] || ''
        );
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

/**
 * POST /api/notifications/push-unsubscribe
 */
async function unsubscribePush(req, res, next) {
    try {
        const userId = req.user.id;
        const { endpoint } = req.body || {};
        const pushNotificationService = require('../services/pushNotificationService');
        const result = await pushNotificationService.removePushSubscription(userId, endpoint);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/notifications/push-test
 */
async function sendTestPush(req, res, next) {
    try {
        const userId = req.user.id;
        const pushNotificationService = require('../services/pushNotificationService');
        const result = await pushNotificationService.sendPushToUser(userId, {
            title: 'LifeSync Closed-Tab Alert ✦',
            message: 'Web Push is active! You will receive focus breaks, deadlines, and smart reminders even when the web app is closed.',
            targetTab: 'dashboard'
        });
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    getPreferences,
    updatePreferences,
    checkTriggers,
    getVapidPublicKey,
    subscribePush,
    unsubscribePush,
    sendTestPush
};
