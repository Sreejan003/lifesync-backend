/**
 * LifeSync Background Notification Scheduler
 * -------------------------------------------------------------
 * Periodically scans active user accounts to trigger smart reminders
 * (overdue tasks, impending exams, budget thresholds) without duplicating.
 */

const db = require('../config/db');
const notificationService = require('./notificationService');

let intervalTimer = null;

async function runScheduledEvaluation() {
    try {
        // Query users created or active recently
        const usersRes = await db.query('SELECT id FROM users LIMIT 100;');
        for (const user of usersRes.rows) {
            try {
                const newAlerts = await notificationService.evaluateUserTriggers(user.id);
                if (newAlerts && newAlerts.length > 0) {
                    const pushService = require('./pushNotificationService');
                    for (const alert of newAlerts) {
                        try {
                            await pushService.sendPushToUser(user.id, {
                                title: alert.title,
                                body: alert.message,
                                tag: 'lifesync-alert-' + alert.id,
                                targetTab: alert.category === 'task' ? 'tasks' : alert.category === 'exam' ? 'calendar' : 'dashboard'
                            });
                        } catch (pErr) {
                            // Non-critical if device offline or unsubscribed
                        }
                    }
                }
            } catch (userErr) {
                // Keep evaluating remaining users if one fails
                console.error(`⚠️ Scheduler trigger error for user ${user.id}:`, userErr.message);
            }
        }
    } catch (err) {
        console.error('⚠️ Scheduler query error:', err.message);
    }
}

/**
 * Start the background scheduler timer
 * @param {number} intervalMs - Defaults to 10 minutes (600,000 ms)
 */
function startScheduler(intervalMs = 600000) {
    if (intervalTimer) return;

    // Run first evaluation shortly after startup (10 seconds)
    setTimeout(() => {
        runScheduledEvaluation();
    }, 10000);

    intervalTimer = setInterval(() => {
        runScheduledEvaluation();
    }, intervalMs);

    console.log('⏰ LifeSync Notification Scheduler initialized.');
}

/**
 * Stop scheduler on server shutdown
 */
function stopScheduler() {
    if (intervalTimer) {
        clearInterval(intervalTimer);
        intervalTimer = null;
        console.log('⏰ LifeSync Notification Scheduler stopped.');
    }
}

module.exports = {
    startScheduler,
    stopScheduler,
    runScheduledEvaluation
};
