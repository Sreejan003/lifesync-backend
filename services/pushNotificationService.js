/**
 * LifeSync Web Push Notification Service (backend/services/pushNotificationService.js)
 * --------------------------------------------------------------------------
 * Implements RFC 8291 / 8292 Web Push Protocol via VAPID keys.
 * Dispatches encrypted push messages to Google (FCM), Apple (APNs), and Mozilla (Autopush)
 * to wake up Service Workers and display notifications even when LifeSync is completely closed.
 */

let webpush;
try {
    webpush = require('web-push');
} catch (e) {
    webpush = null;
}
const db = require('../config/db');

// Configure VAPID credentials
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BGZ2QUl6ZcWXQswnjZaz8Vu8DymQVR6W64vex9yMgbELW12AQ_76hkx6PJsCY_kPQ2GcENYXAsPy058g54TYfyA';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'PujCkI9mXMTztekyPODLa69cWGGrppFk806i0qOOsn4';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@lifesync.edu';

if (webpush && vapidPublicKey && vapidPrivateKey) {
    try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } catch (e) {
        console.warn('⚠️ Web Push VAPID setup notice:', e.message);
    }
}

/**
 * Return current VAPID public key for frontend subscription handshake
 */
function getVapidPublicKey() {
    return vapidPublicKey;
}

/**
 * Store or update a user's browser push subscription
 */
async function savePushSubscription(userId, subscription, userAgent = '') {
    if (!subscription || !subscription.endpoint) {
        throw new Error('Valid push subscription with endpoint is required.');
    }
    const { endpoint, keys } = subscription;
    if (!keys || !keys.p256dh || !keys.auth) {
        throw new Error('Push subscription encryption keys (p256dh, auth) are required.');
    }

    // Check if endpoint exists
    const existing = await db.query(
        'SELECT id, user_id FROM push_subscriptions WHERE endpoint = $1',
        [endpoint]
    );

    if (existing.rows.length > 0) {
        // Update user_id and keys in case same browser switched student accounts
        await db.query(
            `UPDATE push_subscriptions
             SET user_id = $1, p256dh = $2, auth = $3, user_agent = $4, created_at = $5
             WHERE endpoint = $6`,
            [userId, keys.p256dh, keys.auth, userAgent || '', new Date().toISOString(), endpoint]
        );
        return { success: true, updated: true };
    }

    // Insert new subscription
    await db.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, endpoint, keys.p256dh, keys.auth, userAgent || '', new Date().toISOString()]
    );

    return { success: true, created: true };
}

/**
 * Remove push subscription (unsubscribe)
 */
async function removePushSubscription(userId, endpoint) {
    if (endpoint) {
        await db.query(
            'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
            [userId, endpoint]
        );
    } else {
        await db.query(
            'DELETE FROM push_subscriptions WHERE user_id = $1',
            [userId]
        );
    }
    return { success: true };
}

/**
 * Send Web Push notification to all active devices registered to a student
 */
async function sendPushToUser(userId, payload) {
    try {
        const subs = await db.query(
            'SELECT * FROM push_subscriptions WHERE user_id = $1',
            [userId]
        );

        if (subs.rows.length === 0) {
            return { sent: 0, failed: 0 };
        }

        const pushPayload = JSON.stringify({
            title: payload.title || 'LifeSync Reminder',
            body: payload.message || payload.body || 'You have an academic reminder.',
            icon: payload.icon || 'favicon.ico',
            badge: payload.badge || 'favicon.ico',
            tag: payload.tag || 'lifesync-push',
            data: {
                targetTab: payload.targetTab || 'dashboard',
                url: payload.url || '/#' + (payload.targetTab || 'dashboard')
            }
        });

        let sent = 0;
        let failed = 0;

        for (const sub of subs.rows) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, pushPayload);
                sent++;
            } catch (err) {
                failed++;
                // Status 404 or 410 Gone indicates the browser revoked or expired the subscription
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                } else {
                    console.warn(`Web push delivery error (${sub.endpoint.slice(0, 30)}...):`, err.message);
                }
            }
        }

        return { sent, failed };
    } catch (err) {
        console.error(`Error sending push to user ${userId}:`, err.message);
        return { sent: 0, failed: 1, error: err.message };
    }
}

module.exports = {
    getVapidPublicKey,
    savePushSubscription,
    removePushSubscription,
    sendPushToUser
};
