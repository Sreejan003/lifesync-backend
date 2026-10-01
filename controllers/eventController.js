/**
 * LifeSync Calendar & Reminders Controller (backend/controllers/eventController.js)
 * -------------------------------------------------------------
 * Complete CRUD for academic and personal calendar events.
 * Enforces strict user tenant isolation by req.user.id.
 */

const db = require('../config/db');

/**
 * GET /api/events
 * Retrieve events belonging to logged-in user
 */
async function getEvents(req, res, next) {
    try {
        const userId = req.user.id;
        const { date, event_type } = req.query;

        let queryText = 'SELECT * FROM events WHERE user_id = $1';
        const params = [userId];
        let paramIdx = 2;

        if (date) {
            queryText += ` AND date = $${paramIdx++}`;
            params.push(date);
        }
        if (event_type && event_type !== 'all') {
            queryText += ` AND LOWER(event_type) = LOWER($${paramIdx++})`;
            params.push(event_type);
        }

        queryText += ' ORDER BY date ASC, time ASC';

        const result = await db.query(queryText, params);
        return res.status(200).json(result.rows);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/events/:id
 */
async function getEventById(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            'SELECT * FROM events WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/events
 */
async function createEvent(req, res, next) {
    try {
        const userId = req.user.id;
        const { title, description, date, time, event_type, category, reminder, hasReminder } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Event title is required.' });
        }
        if (!date) {
            return res.status(400).json({ error: 'Event date is required.' });
        }

        const type = event_type || category || 'Study';
        const eventTime = time || '09:00';
        const isReminder = reminder !== undefined ? Boolean(reminder) : (hasReminder !== undefined ? Boolean(hasReminder) : false);

        const result = await db.query(
            `INSERT INTO events (user_id, title, description, date, time, event_type, reminder)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                userId,
                title.trim(),
                (description || '').trim(),
                date,
                eventTime,
                type,
                isReminder ? 1 : 0
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/events/:id
 */
async function updateEvent(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const existing = await db.query('SELECT * FROM events WHERE id = $1 AND user_id = $2', [id, userId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        const current = existing.rows[0];
        const { title, description, date, time, event_type, category, reminder, hasReminder } = req.body;

        const updatedTitle = title !== undefined ? title.trim() : current.title;
        const updatedDesc = description !== undefined ? description.trim() : current.description;
        const updatedDate = date !== undefined ? date : current.date;
        const updatedTime = time !== undefined ? time : current.time;
        const updatedType = (event_type !== undefined || category !== undefined)
            ? (event_type || category)
            : current.event_type;

        let updatedReminder = current.reminder;
        if (reminder !== undefined || hasReminder !== undefined) {
            updatedReminder = Boolean(reminder !== undefined ? reminder : hasReminder) ? 1 : 0;
        }

        const result = await db.query(
            `UPDATE events
             SET title = $1, description = $2, date = $3, time = $4, event_type = $5, reminder = $6
             WHERE id = $7 AND user_id = $8
             RETURNING *`,
            [
                updatedTitle,
                updatedDesc,
                updatedDate,
                updatedTime,
                updatedType,
                updatedReminder,
                id,
                userId
            ]
        );

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/events/:id
 */
async function deleteEvent(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            'DELETE FROM events WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        return res.status(200).json({ message: 'Event deleted successfully.', event: result.rows[0] });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent
};
