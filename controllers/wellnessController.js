/**
 * LifeSync Mental Wellness Controller (backend/controllers/wellnessController.js)
 * -------------------------------------------------------------
 * Complete CRUD for daily mood check-ins and non-clinical wellbeing summaries.
 * Enforces strict user tenant isolation by req.user.id.
 */

const db = require('../config/db');

const VALID_MOODS = ['great', 'good', 'okay', 'stressed', 'low', 'happy', 'sad'];

/**
 * GET /api/wellness
 * Retrieve mood check-in records for logged-in user
 */
async function getWellnessRecords(req, res, next) {
    try {
        const userId = req.user.id;
        const result = await db.query(
            'SELECT * FROM wellness_records WHERE user_id = $1 ORDER BY date DESC, id DESC',
            [userId]
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/wellness/:id
 */
async function getWellnessById(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            'SELECT * FROM wellness_records WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Wellness record not found.' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/wellness
 * Record a mood check-in
 */
async function createWellnessRecord(req, res, next) {
    try {
        const userId = req.user.id;
        const { mood, note, notes, stress, energy, date } = req.body;

        if (!mood || !mood.trim()) {
            return res.status(400).json({ error: 'Mood is required.' });
        }

        const normalizedMood = mood.trim().toLowerCase();
        if (!VALID_MOODS.includes(normalizedMood)) {
            return res.status(400).json({
                error: `Invalid mood "${mood}". Valid moods: ${VALID_MOODS.join(', ')}`
            });
        }

        const recordDate = date || new Date().toISOString().split('T')[0];
        const recordNote = (note !== undefined ? note : (notes || '')).trim();
        const stressLevel = Math.max(1, Math.min(5, parseInt(stress, 10) || 2));
        const energyLevel = Math.max(1, Math.min(5, parseInt(energy, 10) || 3));

        // Check if an entry already exists for today; if so, update it
        const existing = await db.query(
            'SELECT id FROM wellness_records WHERE user_id = $1 AND date = $2',
            [userId, recordDate]
        );

        let result;
        if (existing.rows.length > 0) {
            result = await db.query(
                `UPDATE wellness_records
                 SET mood = $1, note = $2, stress = $3, energy = $4
                 WHERE id = $5 AND user_id = $6
                 RETURNING *`,
                [normalizedMood, recordNote, stressLevel, energyLevel, existing.rows[0].id, userId]
            );
        } else {
            result = await db.query(
                `INSERT INTO wellness_records (user_id, mood, note, stress, energy, date)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [userId, normalizedMood, recordNote, stressLevel, energyLevel, recordDate]
            );
        }

        return res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/wellness/:id
 */
function formatLocalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function deleteWellnessRecord(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            'DELETE FROM wellness_records WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Wellness record not found.' });
        }

        return res.status(200).json({ message: 'Wellness record deleted.', record: result.rows[0] });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/wellness/summary
 * Mood history, streak, and recent 7-day trend
 */
async function getWellnessSummary(req, res, next) {
    try {
        const userId = req.user.id;

        const recordsRes = await db.query(
            'SELECT * FROM wellness_records WHERE user_id = $1 ORDER BY date DESC',
            [userId]
        );
        const records = recordsRes.rows;

        // Calculate streak (consecutive tracked days starting from today or yesterday)
        let streak = 0;
        const dateSet = new Set(records.map(r => String(r.date).split('T')[0]));

        let checkDate = new Date();
        const todayStr = formatLocalDate(checkDate);

        // If not checked in today, check if checked in yesterday
        if (!dateSet.has(todayStr)) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
            const dateStr = formatLocalDate(checkDate);
            if (dateSet.has(dateStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        // 7-day trend
        const weeklyDays = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = formatLocalDate(d);
            const found = records.find(r => String(r.date).split('T')[0] === dStr);

            weeklyDays.push({
                date: dStr,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                mood: found ? found.mood : null,
                stress: found ? found.stress : null,
                energy: found ? found.energy : null
            });
        }

        const latestEntry = records.length > 0 ? records[0] : null;

        return res.status(200).json({
            streak,
            latestMood: latestEntry ? latestEntry.mood : null,
            latestEntry,
            totalEntries: records.length,
            daysTracked: `${weeklyDays.filter(d => d.mood !== null).length}/7`,
            weeklyDays,
            history: records.slice(0, 14) // Recent 14 check-ins
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getWellnessRecords,
    getWellnessById,
    createWellnessRecord,
    deleteWellnessRecord,
    getWellnessSummary
};
