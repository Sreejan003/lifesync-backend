/**
 * LifeSync Student Profile Controller (backend/controllers/profileController.js)
 * -------------------------------------------------------------
 * Manages student academic details, identity, and preferences.
 */

const db = require('../config/db');

async function getProfile(req, res, next) {
    try {
        const userId = req.user.id;
        let result = await db.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);

        if (result.rows.length === 0) {
            const userRes = await db.query('SELECT name, email FROM users WHERE id = $1', [userId]);
            const user = userRes.rows[0] || {};
            await db.query(
                `INSERT INTO profiles (user_id, name, email) VALUES ($1, $2, $3)`,
                [userId, user.name || req.user.name, user.email || req.user.email]
            );
            result = await db.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
        }

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

async function updateProfile(req, res, next) {
    try {
        const userId = req.user.id;
        const { name, university, major, yearSemester, studentId, currency, xp, notificationsEnabled } = req.body;

        const currentRes = await db.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
        const current = currentRes.rows[0] || {};

        const updatedName = name !== undefined ? name.trim() : (current.name || req.user.name);
        const updatedUni = university !== undefined ? university.trim() : (current.university || '');
        const updatedMajor = major !== undefined ? major.trim() : (current.major || '');
        const updatedYrSem = yearSemester !== undefined ? yearSemester.trim() : (current.year_semester || '');
        const updatedStuId = studentId !== undefined ? studentId.trim() : (current.student_id || '');
        const updatedCurr = currency !== undefined ? currency : (current.currency || '₹');
        const updatedXp = xp !== undefined ? parseInt(xp, 10) : (current.xp || 120);
        const updatedNotif = notificationsEnabled !== undefined ? (Boolean(notificationsEnabled) ? 1 : 0) : (current.notifications_enabled || 1);

        // Also update name in users table if name is updated
        if (name && name.trim()) {
            await db.query('UPDATE users SET name = $1 WHERE id = $2', [updatedName, userId]);
        }

        await db.query(
            `INSERT INTO profiles (user_id, name, email, university, major, year_semester, student_id, currency, xp, notifications_enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT(user_id) DO UPDATE SET
                name = EXCLUDED.name,
                university = EXCLUDED.university,
                major = EXCLUDED.major,
                year_semester = EXCLUDED.year_semester,
                student_id = EXCLUDED.student_id,
                currency = EXCLUDED.currency,
                xp = EXCLUDED.xp,
                notifications_enabled = EXCLUDED.notifications_enabled`,
            [userId, updatedName, req.user.email, updatedUni, updatedMajor, updatedYrSem, updatedStuId, updatedCurr, updatedXp, updatedNotif]
        );

        const updated = await db.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
        return res.status(200).json(updated.rows[0]);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getProfile,
    updateProfile
};
