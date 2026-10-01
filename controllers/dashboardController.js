/**
 * LifeSync Dashboard Controller (backend/controllers/dashboardController.js)
 * -------------------------------------------------------------
 * Aggregates live cross-module metrics directly from database tables:
 * - Student info (users table)
 * - Task counts (tasks table)
 * - Upcoming events & next exam (events table)
 * - Budget totals (transactions table)
 * - Latest mood & wellness streak (wellness_records table)
 */

const db = require('../config/db');

async function getDashboardSummary(req, res, next) {
    try {
        const userId = req.user.id;

        // 1. User Info
        const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0] || { name: req.user.name || 'Student' };

        // 2. Task metrics
        const tasksRes = await db.query('SELECT status, deadline FROM tasks WHERE user_id = $1', [userId]);
        const tasks = tasksRes.rows;

        const pendingTasks = tasks.filter(t => t.status !== 'Completed').length;
        const completedTasks = tasks.filter(t => t.status === 'Completed').length;

        // Find closest upcoming deadline
        const todayStr = new Date().toISOString().split('T')[0];
        const upcomingDeadlines = tasks
            .filter(t => t.status !== 'Completed' && t.deadline && t.deadline >= todayStr)
            .map(t => String(t.deadline).split('T')[0])
            .sort();

        const nextDeadline = upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;

        // 3. Upcoming Events & Exams
        const eventsRes = await db.query(
            'SELECT title, date, time, event_type FROM events WHERE user_id = $1 AND date >= $2 ORDER BY date ASC, time ASC',
            [userId, todayStr]
        );
        const upcomingEvents = eventsRes.rows.length;

        const nextExam = eventsRes.rows.find(e =>
            ['exam', 'midterm', 'final', 'quiz', 'test'].some(w => (e.title || '').toLowerCase().includes(w) || (e.event_type || '').toLowerCase().includes(w))
        ) || null;

        // 4. Budget Totals
        const txRes = await db.query('SELECT type, amount, date FROM transactions WHERE user_id = $1', [userId]);
        let totalIncome = 0;
        let totalExpenses = 0;
        const currentMonth = new Date().toISOString().slice(0, 7);
        let spentThisMonth = 0;

        txRes.rows.forEach(t => {
            const amt = parseFloat(t.amount) || 0;
            const tType = (t.type || '').toLowerCase();
            if (tType === 'income') {
                totalIncome += amt;
            } else {
                totalExpenses += amt;
                if (t.date && String(t.date).startsWith(currentMonth)) {
                    spentThisMonth += amt;
                }
            }
        });

        const budgetSettingsRes = await db.query('SELECT * FROM budget_settings WHERE user_id = $1', [userId]);
        const budgetSettings = budgetSettingsRes.rows[0] || {};
        const monthlyBudget = parseFloat(budgetSettings.monthly_budget) || 15000;

        // 5. Mental Wellness
        const wellnessRes = await db.query(
            'SELECT mood, date, stress, energy FROM wellness_records WHERE user_id = $1 ORDER BY date DESC LIMIT 1',
            [userId]
        );
        const latestRecord = wellnessRes.rows[0];
        const latestMood = latestRecord ? latestRecord.mood : null;

        return res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            pendingTasks,
            completedTasks,
            upcomingEvents,
            nextDeadline,
            nextExam: nextExam ? { title: nextExam.title, date: nextExam.date, time: nextExam.time } : null,
            budget: {
                income: Math.round(totalIncome * 100) / 100,
                expenses: Math.round(totalExpenses * 100) / 100,
                remaining: Math.round((totalIncome - totalExpenses) * 100) / 100,
                monthlyBudget,
                spentThisMonth: Math.round(spentThisMonth * 100) / 100,
                budgetRemaining: Math.max(0, monthlyBudget - spentThisMonth)
            },
            latestMood
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getDashboardSummary
};
