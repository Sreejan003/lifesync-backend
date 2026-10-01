/**
 * LifeSync Task & Smart Organizer Controller (backend/controllers/taskController.js)
 * -------------------------------------------------------------
 * Complete CRUD for student tasks and rule-based Smart Task Organizer.
 * Enforces strict user tenant isolation by req.user.id.
 */

const db = require('../config/db');

// Helper: Calculate day difference between target date and today
function getDaysDiff(dateStr) {
    if (!dateStr) return 999;
    const clean = String(dateStr).split('T')[0].trim();
    if (!clean) return 999;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = clean.split('-');
    if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const target = new Date(y, m, d);
        if (!isNaN(target.getTime())) {
            const diffMs = target.getTime() - today.getTime();
            return Math.round(diffMs / (1000 * 60 * 60 * 24));
        }
    }

    const target = new Date(clean + 'T00:00:00');
    if (isNaN(target.getTime())) return 999;
    const diffMs = target.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * GET /api/tasks
 * Retrieve tasks belonging to logged-in user
 */
async function getTasks(req, res, next) {
    try {
        const userId = req.user.id;
        const { status, category, priority, search } = req.query;

        let queryText = 'SELECT * FROM tasks WHERE user_id = $1';
        const params = [userId];
        let paramIdx = 2;

        if (status && status !== 'all') {
            queryText += ` AND LOWER(status) = LOWER($${paramIdx++})`;
            params.push(status);
        }
        if (category && category !== 'all') {
            queryText += ` AND LOWER(category) = LOWER($${paramIdx++})`;
            params.push(category);
        }
        if (priority && priority !== 'all') {
            queryText += ` AND LOWER(priority) = LOWER($${paramIdx++})`;
            params.push(priority);
        }
        if (search && search.trim()) {
            queryText += ` AND (LOWER(title) LIKE LOWER($${paramIdx}) OR LOWER(description) LIKE LOWER($${paramIdx}))`;
            params.push(`%${search.trim()}%`);
            paramIdx++;
        }

        queryText += ' ORDER BY id DESC';

        const result = await db.query(queryText, params);
        return res.status(200).json(result.rows);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/tasks/:id
 */
async function getTaskById(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/tasks
 * Create task for logged-in user
 */
async function createTask(req, res, next) {
    try {
        const userId = req.user.id;
        const { title, category, deadline, dueDate, priority, status, description } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Task title is required.' });
        }

        const allowedPriorities = ['Low', 'Medium', 'High', 'Urgent'];
        const allowedStatuses = ['Pending', 'Completed', 'In Progress'];

        let taskPriority = 'Medium';
        if (priority) {
            const formatted = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
            if (!allowedPriorities.includes(formatted)) {
                return res.status(400).json({ error: `Invalid priority. Must be one of: ${allowedPriorities.join(', ')}` });
            }
            taskPriority = formatted;
        }

        let taskStatus = 'Pending';
        if (status) {
            const formatted = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            if (!allowedStatuses.includes(formatted)) {
                return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
            }
            taskStatus = formatted;
        }

        const taskDeadline = deadline || dueDate || null;
        const completedAt = taskStatus === 'Completed' ? new Date().toISOString() : null;

        const result = await db.query(
            `INSERT INTO tasks (user_id, title, category, deadline, priority, status, description, completed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                userId,
                title.trim(),
                category || 'Study',
                taskDeadline,
                taskPriority,
                taskStatus,
                (description || '').trim(),
                completedAt
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/tasks/:id
 * Update task
 */
async function updateTask(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verify task ownership
        const existing = await db.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const current = existing.rows[0];
        const { title, category, deadline, dueDate, priority, status, description } = req.body;

        const updatedTitle = title !== undefined ? title.trim() : current.title;
        const updatedCategory = category !== undefined ? category : current.category;
        const updatedDeadline = (deadline !== undefined || dueDate !== undefined)
            ? (deadline || dueDate)
            : current.deadline;

        const allowedPriorities = ['Low', 'Medium', 'High', 'Urgent'];
        const allowedStatuses = ['Pending', 'Completed', 'In Progress'];

        let updatedPriority = current.priority;
        if (priority !== undefined) {
            const formatted = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
            if (!allowedPriorities.includes(formatted)) {
                return res.status(400).json({ error: `Invalid priority. Must be one of: ${allowedPriorities.join(', ')}` });
            }
            updatedPriority = formatted;
        }

        let updatedStatus = current.status;
        let updatedCompletedAt = current.completed_at;
        if (status !== undefined) {
            const formatted = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            if (!allowedStatuses.includes(formatted)) {
                return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
            }
            updatedStatus = formatted;
            if (updatedStatus === 'Completed' && !current.completed_at) {
                updatedCompletedAt = new Date().toISOString();
            } else if (updatedStatus !== 'Completed') {
                updatedCompletedAt = null;
            }
        }

        const updatedDesc = description !== undefined ? description.trim() : current.description;

        const result = await db.query(
            `UPDATE tasks
             SET title = $1, category = $2, deadline = $3, priority = $4, status = $5, description = $6, completed_at = $7
             WHERE id = $8 AND user_id = $9
             RETURNING *`,
            [
                updatedTitle,
                updatedCategory,
                updatedDeadline,
                updatedPriority,
                updatedStatus,
                updatedDesc,
                updatedCompletedAt,
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
 * DELETE /api/tasks/:id
 */
async function deleteTask(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        return res.status(200).json({ message: 'Task deleted successfully.', task: result.rows[0] });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/tasks/prioritized
 * Smart Task Organizer (Rule-Based Algorithm)
 * ----------------------------------------------------------------------
 * Rules:
 * - Overdue + High priority       -> Very High
 * - Due today + High priority     -> Very High
 * - Due tomorrow + High priority   -> High
 * - Due within a few days + Medium -> Medium
 * - Far deadline + Low priority   -> Low
 * Also correlates upcoming academic exams from calendar within 4 days.
 */
async function getPrioritizedTasks(req, res, next) {
    try {
        const userId = req.user.id;

        // 1. Fetch pending tasks
        const tasksRes = await db.query(
            "SELECT * FROM tasks WHERE user_id = $1 AND status != 'Completed' ORDER BY id DESC",
            [userId]
        );
        const tasks = tasksRes.rows;

        // 2. Fetch upcoming events (for exam proximity boost)
        const eventsRes = await db.query(
            'SELECT * FROM events WHERE user_id = $1 ORDER BY date ASC',
            [userId]
        );
        const allEvents = eventsRes.rows;

        // Upcoming academic exams/reviews within next 4 days
        const upcomingExams = allEvents.filter(e => {
            const diff = getDaysDiff(e.date);
            const isExam = ['exam', 'study', 'class', 'assignment'].includes((e.event_type || '').toLowerCase());
            return isExam && diff >= 0 && diff <= 4;
        });

        // 3. Rule-based scoring
        const prioritized = tasks.map(task => {
            let score = 0;
            let reason = 'Normal Priority';
            const diff = getDaysDiff(task.deadline);
            const prio = (task.priority || 'Medium').toLowerCase();

            // A. Deadline Proximity Scoring
            if (task.deadline) {
                if (diff < 0) {
                    score += 120;
                    reason = `Overdue (${Math.abs(diff)}d ago)`;
                } else if (diff === 0) {
                    score += 90;
                    reason = 'Due today';
                } else if (diff === 1) {
                    score += 70;
                    reason = 'Due tomorrow';
                } else if (diff <= 3) {
                    score += 45;
                    reason = `Due in ${diff} days`;
                } else {
                    score += 20;
                    reason = `Due in ${diff} days`;
                }
            } else {
                score += 5;
                reason = 'No deadline set';
            }

            // B. Priority Weighting
            if (prio === 'high') {
                score += 30;
            } else if (prio === 'medium') {
                score += 20;
            } else {
                score += 10;
            }

            // C. Academic Exam Proximity Boost
            if (upcomingExams.length > 0) {
                const matchedExam = upcomingExams.find(exam => {
                    const examWords = (exam.title || '').toLowerCase().split(/\s+/);
                    const taskWords = (task.title || '').toLowerCase().split(/\s+/);
                    return examWords.some(w => w.length > 3 && taskWords.includes(w));
                }) || upcomingExams[0];

                if (matchedExam && diff >= 0 && diff <= 4) {
                    score += 25;
                    if (diff > 1) {
                        reason = `Upcoming Exam: ${matchedExam.title} (in ${getDaysDiff(matchedExam.date)}d)`;
                    }
                }
            }

            // D. Mapped Urgency Rank
            let calculatedPriority = 'Low';
            if (score >= 110) {
                calculatedPriority = 'Very High';
            } else if (score >= 80) {
                calculatedPriority = 'High';
            } else if (score >= 45) {
                calculatedPriority = 'Medium';
            }

            return {
                id: task.id,
                title: task.title,
                category: task.category,
                deadline: task.deadline,
                priority: task.priority,
                status: task.status,
                description: task.description,
                urgencyScore: score,
                calculatedPriority,
                reason,
                created_at: task.created_at
            };
        });

        // Sort descending by urgency score
        prioritized.sort((a, b) => b.urgencyScore - a.urgencyScore);

        return res.status(200).json(prioritized);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    getPrioritizedTasks
};
