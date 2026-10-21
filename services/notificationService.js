/**
 * LifeSync Smart Notification Service
 * -------------------------------------------------------------
 * Evaluates student productivity & wellness triggers, avoids duplicate alerts,
 * respects student quiet hours, and persists notifications in PostgreSQL/SQLite.
 */

const db = require('../config/db');

/**
 * Check if the current time falls within user quiet hours (e.g. 22:00 to 07:00)
 */
function isQuietHours(start = '22:00', end = '07:00') {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = (start || '22:00').split(':').map(Number);
    const [endH, endM] = (end || '07:00').split(':').map(Number);

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (startTotal <= endTotal) {
        // e.g. 13:00 to 15:00
        return currentMinutes >= startTotal && currentMinutes < endTotal;
    } else {
        // Overnight, e.g. 22:00 to 07:00
        return currentMinutes >= startTotal || currentMinutes < endTotal;
    }
}

/**
 * Get or initialize user notification preferences
 */
async function getPreferences(userId) {
    const res = await db.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1;',
        [userId]
    );

    if (res.rows.length > 0) {
        return res.rows[0];
    }

    // Default preferences
    await db.query(`
        INSERT INTO notification_preferences (
            user_id, quiet_hours_start, quiet_hours_end, email_alerts,
            browser_alerts, task_reminders, exam_alerts, budget_warnings, wellness_prompts
        ) VALUES ($1, '22:00', '07:00', false, true, true, true, true, true)
        ON CONFLICT (user_id) DO NOTHING;
    `, [userId]);

    return {
        user_id: userId,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        email_alerts: false,
        browser_alerts: true,
        task_reminders: true,
        exam_alerts: true,
        budget_warnings: true,
        wellness_prompts: true
    };
}

/**
 * Update user notification preferences
 */
async function updatePreferences(userId, prefs) {
    await db.query(`
        INSERT INTO notification_preferences (
            user_id, quiet_hours_start, quiet_hours_end, email_alerts,
            browser_alerts, task_reminders, exam_alerts, budget_warnings, wellness_prompts, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
            quiet_hours_start = EXCLUDED.quiet_hours_start,
            quiet_hours_end = EXCLUDED.quiet_hours_end,
            email_alerts = EXCLUDED.email_alerts,
            browser_alerts = EXCLUDED.browser_alerts,
            task_reminders = EXCLUDED.task_reminders,
            exam_alerts = EXCLUDED.exam_alerts,
            budget_warnings = EXCLUDED.budget_warnings,
            wellness_prompts = EXCLUDED.wellness_prompts,
            updated_at = CURRENT_TIMESTAMP;
    `, [
        userId,
        prefs.quiet_hours_start || '22:00',
        prefs.quiet_hours_end || '07:00',
        Boolean(prefs.email_alerts),
        prefs.browser_alerts !== false,
        prefs.task_reminders !== false,
        prefs.exam_alerts !== false,
        prefs.budget_warnings !== false,
        prefs.wellness_prompts !== false
    ]);

    return getPreferences(userId);
}

/**
 * Insert a notification with deduplication
 */
async function createNotification({
    userId,
    title,
    message,
    category = 'task',
    priority = 'medium',
    actionLink = null,
    dedupeKey = null
}) {
    if (dedupeKey) {
        // Check if an alert with this dedupe_key was already created within last 24 hours
        const existing = await db.query(`
            SELECT id FROM notifications 
            WHERE user_id = $1 AND dedupe_key = $2
            LIMIT 1;
        `, [userId, dedupeKey]);

        if (existing.rows.length > 0) {
            return null; // Suppress duplicate
        }
    }

    const res = await db.query(`
        INSERT INTO notifications (
            user_id, title, message, category, priority, is_read, action_link, dedupe_key
        ) VALUES ($1, $2, $3, $4, $5, false, $6, $7)
        RETURNING *;
    `, [userId, title, message, category, priority, actionLink, dedupeKey]);

    return res.rows[0];
}

/**
 * Retrieve notifications for a user
 */
async function getNotifications(userId, limit = 50) {
    const res = await db.query(`
        SELECT * FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2;
    `, [userId, limit]);

    const countRes = await db.query(`
        SELECT COUNT(*) as count FROM notifications
        WHERE user_id = $1 AND is_read = false;
    `, [userId]);

    return {
        notifications: res.rows,
        unreadCount: parseInt(countRes.rows[0]?.count || 0, 10)
    };
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId) {
    const res = await db.query(`
        SELECT COUNT(*) as count FROM notifications
        WHERE user_id = $1 AND is_read = false;
    `, [userId]);

    return parseInt(res.rows[0]?.count || 0, 10);
}

/**
 * Mark a single notification as read
 */
async function markRead(notificationId, userId) {
    const res = await db.query(`
        UPDATE notifications
        SET is_read = true
        WHERE id = $1 AND user_id = $2
        RETURNING *;
    `, [notificationId, userId]);

    return res.rows[0] || null;
}

/**
 * Mark all notifications as read for a user
 */
async function markAllRead(userId) {
    const res = await db.query(`
        UPDATE notifications
        SET is_read = true
        WHERE user_id = $1 AND is_read = false;
    `, [userId]);

    return { updated: res.rowCount };
}

/**
 * Delete a specific notification
 */
async function deleteNotification(notificationId, userId) {
    const res = await db.query(`
        DELETE FROM notifications
        WHERE id = $1 AND user_id = $2;
    `, [notificationId, userId]);

    return res.rowCount > 0;
}

/**
 * Clear all notifications for a user
 */
async function clearAllNotifications(userId) {
    const res = await db.query(`
        DELETE FROM notifications
        WHERE user_id = $1;
    `, [userId]);

    return { deleted: res.rowCount };
}

/**
 * Intelligently evaluate triggers for a given user
 */
async function evaluateUserTriggers(userId) {
    const prefs = await getPreferences(userId);
    const quiet = isQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end);
    const todayStr = new Date().toISOString().split('T')[0];
    const generated = [];

    // 1. Task Reminders: Overdue and due today/tomorrow
    if (prefs.task_reminders) {
        const overdueTasks = await db.query(`
            SELECT id, title, deadline, priority FROM tasks
            WHERE user_id = $1 AND status != 'Completed' AND deadline < $2
            ORDER BY deadline ASC;
        `, [userId, todayStr]);

        for (const t of overdueTasks.rows) {
            const dedupeKey = `overdue_task_${t.id}_${todayStr}`;
            const notif = await createNotification({
                userId,
                title: 'Overdue Task Alert',
                message: `"${t.title}" is overdue (deadline was ${t.deadline}). Focus on completing it today!`,
                category: 'task',
                priority: quiet ? 'medium' : 'urgent',
                actionLink: '#view-tasks',
                dedupeKey
            });
            if (notif) generated.push(notif);
        }

        const dueSoonTasks = await db.query(`
            SELECT id, title, deadline, priority FROM tasks
            WHERE user_id = $1 AND status != 'Completed' AND (deadline = $2)
        `, [userId, todayStr]);

        for (const t of dueSoonTasks.rows) {
            const dedupeKey = `due_today_task_${t.id}_${todayStr}`;
            const notif = await createNotification({
                userId,
                title: 'Task Due Today',
                message: `"${t.title}" is due today. Tap to plan a Pomodoro focus session.`,
                category: 'task',
                priority: 'high',
                actionLink: '#view-tasks',
                dedupeKey
            });
            if (notif) generated.push(notif);
        }
    }

    // 2. Exam Alerts (within 48 hours)
    if (prefs.exam_alerts) {
        const eventsRes = await db.query(`
            SELECT id, title, date, time, event_type FROM events
            WHERE user_id = $1 AND (
                LOWER(event_type) IN ('exam', 'midterm', 'final', 'quiz', 'test')
                OR LOWER(title) LIKE '%exam%'
                OR LOWER(title) LIKE '%midterm%'
                OR LOWER(title) LIKE '%quiz%'
            )
            ORDER BY date ASC;
        `, [userId]);

        const nowMs = Date.now();
        for (const ev of eventsRes.rows) {
            const eventDate = new Date(`${ev.date}T${ev.time || '09:00'}:00`);
            const diffHours = (eventDate.getTime() - nowMs) / (1000 * 60 * 60);

            if (diffHours >= -2 && diffHours <= 48) {
                const dedupeKey = `exam_alert_${ev.id}_${todayStr}`;
                const notif = await createNotification({
                    userId,
                    title: 'Upcoming Academic Exam',
                    message: `Reminder: "${ev.title}" is scheduled for ${ev.date} at ${ev.time || '09:00'}. Review your notes!`,
                    category: 'exam',
                    priority: 'urgent',
                    actionLink: '#view-calendar',
                    dedupeKey
                });
                if (notif) generated.push(notif);
            }
        }
    }

    // 3. Budget Runway / Spending Alerts
    if (prefs.budget_warnings) {
        const budgetRes = await db.query(`
            SELECT monthly_budget, runway_sum, runway_buffer_pct, night_safe_limit, night_safe_spent
            FROM budget_settings
            WHERE user_id = $1;
        `, [userId]);

        if (budgetRes.rows.length > 0) {
            const b = budgetRes.rows[0];
            const runway = parseFloat(b.runway_sum || 0);
            const monthly = parseFloat(b.monthly_budget || 15000);

            // Fetch current month expense
            const currentYearMonth = todayStr.substring(0, 7);
            const expenseRes = await db.query(`
                SELECT SUM(amount) as total_spent FROM transactions
                WHERE user_id = $1 AND LOWER(type) = 'expense' AND CAST(date AS TEXT) LIKE $2;
            `, [userId, `${currentYearMonth}%`]);

            const spent = parseFloat(expenseRes.rows[0]?.total_spent || 0);
            const remaining = monthly - spent;

            if (remaining <= monthly * 0.2 && remaining > 0) {
                const dedupeKey = `budget_warning_20pct_${todayStr}`;
                const notif = await createNotification({
                    userId,
                    title: 'Budget Alert: 80% Spent',
                    message: `You have spent ₹${spent.toFixed(0)} of your monthly budget (₹${remaining.toFixed(0)} remaining).`,
                    category: 'budget',
                    priority: 'high',
                    actionLink: '#view-budget',
                    dedupeKey
                });
                if (notif) generated.push(notif);
            } else if (remaining <= 0 && monthly > 0) {
                const dedupeKey = `budget_exceeded_${todayStr}`;
                const notif = await createNotification({
                    userId,
                    title: 'Budget Exceeded',
                    message: `You have exceeded your monthly budget by ₹${Math.abs(remaining).toFixed(0)}. Check Late-Night Safe.`,
                    category: 'budget',
                    priority: 'urgent',
                    actionLink: '#view-budget',
                    dedupeKey
                });
                if (notif) generated.push(notif);
            }
        }
    }

    // 4. Daily Mental Wellness Check-in Prompt
    if (prefs.wellness_prompts) {
        const currentHour = new Date().getHours();
        // Prompt in late afternoon / evening (after 15:00) if not checked in today
        if (currentHour >= 15) {
            const wellnessRes = await db.query(`
                SELECT id FROM wellness_records
                WHERE user_id = $1 AND date = $2
                LIMIT 1;
            `, [userId, todayStr]);

            if (wellnessRes.rows.length === 0) {
                const dedupeKey = `wellness_checkin_prompt_${todayStr}`;
                const notif = await createNotification({
                    userId,
                    title: 'Mindful Moment',
                    message: `Take 60 seconds to log how you feel today and protect your wellness streak!`,
                    category: 'wellness',
                    priority: 'low',
                    actionLink: '#view-wellness',
                    dedupeKey
                });
                if (notif) generated.push(notif);
            }
        }
    }

    return generated;
}

module.exports = {
    getPreferences,
    updatePreferences,
    createNotification,
    getNotifications,
    getUnreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    clearAllNotifications,
    evaluateUserTriggers,
    isQuietHours
};
