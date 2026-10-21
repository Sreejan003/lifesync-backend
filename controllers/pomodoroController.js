/**
 * LifeSync Pomodoro Focus Timer Controller
 * -------------------------------------------------------------
 * Logs completed focus/break sessions, calculates daily productivity statistics,
 * awards student XP points, and manages timer settings.
 */

const db = require('../config/db');

/**
 * POST /api/pomodoro/session
 * Record a completed or ended Pomodoro session
 */
async function recordSession(req, res, next) {
    try {
        const userId = req.user.id;
        const { taskId, mode = 'focus', durationMinutes = 25, startedAt, completed = true } = req.body;

        const effectiveStartedAt = startedAt ? new Date(startedAt).toISOString() : new Date().toISOString();
        const effectiveCompleted = completed !== false;
        const duration = parseInt(durationMinutes, 10) || 25;

        const sessionRes = await db.query(`
            INSERT INTO pomodoro_sessions (
                user_id, task_id, mode, duration_minutes, completed, started_at, completed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            RETURNING *;
        `, [userId, taskId || null, mode, duration, effectiveCompleted, effectiveStartedAt]);

        let xpAwarded = 0;
        // Award XP for completed focus sessions
        if (effectiveCompleted && mode === 'focus') {
            xpAwarded = Math.max(10, Math.round(duration * 1.0)); // ~25 XP for 25m
            await db.query(`
                UPDATE profiles
                SET xp = COALESCE(xp, 0) + $1
                WHERE user_id = $2;
            `, [xpAwarded, userId]);
        }

        res.status(201).json({
            session: sessionRes.rows[0],
            xpAwarded
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/pomodoro/stats
 * Get student's focus statistics for today and lifetime
 */
async function getStats(req, res, next) {
    try {
        const userId = req.user.id;
        const todayStr = new Date().toISOString().split('T')[0];

        // Today's stats
        const todayRes = await db.query(`
            SELECT 
                COALESCE(SUM(duration_minutes), 0) as focus_minutes,
                COUNT(*) as sessions_count
            FROM pomodoro_sessions
            WHERE user_id = $1 
              AND mode = 'focus' 
              AND completed = true
              AND completed_at >= $2;
        `, [userId, `${todayStr} 00:00:00`]);

        // Total lifetime stats
        const totalRes = await db.query(`
            SELECT 
                COALESCE(SUM(duration_minutes), 0) as total_focus_minutes,
                COUNT(*) as total_sessions
            FROM pomodoro_sessions
            WHERE user_id = $1 
              AND mode = 'focus' 
              AND completed = true;
        `, [userId]);

        // Recent 10 sessions with task details if available
        const recentRes = await db.query(`
            SELECT 
                p.id, p.task_id, p.mode, p.duration_minutes, p.completed, p.started_at, p.completed_at,
                t.title as task_title, t.category as task_category
            FROM pomodoro_sessions p
            LEFT JOIN tasks t ON p.task_id = t.id
            WHERE p.user_id = $1
            ORDER BY p.completed_at DESC
            LIMIT 10;
        `, [userId]);

        res.status(200).json({
            today: {
                focusMinutes: parseInt(todayRes.rows[0]?.focus_minutes || 0, 10),
                sessionsCount: parseInt(todayRes.rows[0]?.sessions_count || 0, 10)
            },
            lifetime: {
                totalFocusMinutes: parseInt(totalRes.rows[0]?.total_focus_minutes || 0, 10),
                totalSessions: parseInt(totalRes.rows[0]?.total_sessions || 0, 10)
            },
            recentSessions: recentRes.rows
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/pomodoro/settings
 */
async function getSettings(req, res, next) {
    try {
        const userId = req.user.id;
        let settingsRes = await db.query(
            'SELECT * FROM pomodoro_settings WHERE user_id = $1;',
            [userId]
        );

        if (settingsRes.rows.length === 0) {
            // Seed defaults
            await db.query(`
                INSERT INTO pomodoro_settings (
                    user_id, focus_duration, short_break, long_break,
                    sessions_until_long_break, auto_start_breaks, sound_enabled
                ) VALUES ($1, 25, 5, 15, 4, false, true)
                ON CONFLICT (user_id) DO NOTHING;
            `, [userId]);

            settingsRes = await db.query(
                'SELECT * FROM pomodoro_settings WHERE user_id = $1;',
                [userId]
            );
        }

        res.status(200).json({ settings: settingsRes.rows[0] });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/pomodoro/settings
 */
async function updateSettings(req, res, next) {
    try {
        const userId = req.user.id;
        const {
            focusDuration = 25,
            shortBreak = 5,
            longBreak = 15,
            sessionsUntilLongBreak = 4,
            autoStartBreaks = false,
            soundEnabled = true
        } = req.body;

        await db.query(`
            INSERT INTO pomodoro_settings (
                user_id, focus_duration, short_break, long_break,
                sessions_until_long_break, auto_start_breaks, sound_enabled, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                focus_duration = EXCLUDED.focus_duration,
                short_break = EXCLUDED.short_break,
                long_break = EXCLUDED.long_break,
                sessions_until_long_break = EXCLUDED.sessions_until_long_break,
                auto_start_breaks = EXCLUDED.auto_start_breaks,
                sound_enabled = EXCLUDED.sound_enabled,
                updated_at = CURRENT_TIMESTAMP;
        `, [
            userId,
            parseInt(focusDuration, 10) || 25,
            parseInt(shortBreak, 10) || 5,
            parseInt(longBreak, 10) || 15,
            parseInt(sessionsUntilLongBreak, 10) || 4,
            Boolean(autoStartBreaks),
            soundEnabled !== false
        ]);

        const updated = await db.query('SELECT * FROM pomodoro_settings WHERE user_id = $1;', [userId]);
        res.status(200).json({ settings: updated.rows[0] });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    recordSession,
    getStats,
    getSettings,
    updateSettings
};
