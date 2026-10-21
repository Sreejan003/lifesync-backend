/**
 * LifeSync Budget Planner Controller (backend/controllers/budgetController.js)
 * -------------------------------------------------------------
 * Complete CRUD for financial transactions and server-side summary calculations.
 * Enforces strict user tenant isolation by req.user.id.
 */
const db = require('../config/db');

/**
 * GET /api/budget
 * List transactions for logged-in user
 */
async function getTransactions(req, res, next) {
    try {
        const userId = req.user.id;
        const { type, category, startDate, endDate } = req.query;

        let queryText = 'SELECT * FROM transactions WHERE user_id = $1';
        const params = [userId];
        let paramIdx = 2;

        if (type) {
            queryText += ` AND LOWER(type) = LOWER($${paramIdx++})`;
            params.push(type);
        }
        if (category) {
            queryText += ` AND LOWER(category) = LOWER($${paramIdx++})`;
            params.push(category);
        }
        if (startDate) {
            queryText += ` AND date >= $${paramIdx++}`;
            params.push(startDate);
        }
        if (endDate) {
            queryText += ` AND date <= $${paramIdx++}`;
            params.push(endDate);
        }

        queryText += ' ORDER BY date DESC, id DESC';

        const result = await db.query(queryText, params);
        return res.status(200).json(result.rows);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/budget/:id
 */
async function getTransactionById(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found.' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/budget
 * Create a new income or expense transaction
 */
async function createTransaction(req, res, next) {
    try {
        const userId = req.user.id;
        const { type, category, amount, date, description, title } = req.body;

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number.' });
        }

        const txType = (type || '').toLowerCase();
        if (txType !== 'income' && txType !== 'expense') {
            return res.status(400).json({ error: 'Transaction type must be either "income" or "expense".' });
        }

        const validCategories = [
            'food', 'transport', 'education', 'stationery',
            'entertainment', 'shopping', 'subscriptions', 'allowance', 'other'
        ];
        const txCategory = category ? category.trim() : (txType === 'income' ? 'Allowance' : 'Food');
        const txDate = date || new Date().toISOString().split('T')[0];
        const desc = (description || title || '').trim();

        const result = await db.query(
            `INSERT INTO transactions (user_id, type, category, amount, date, description)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [userId, txType, txCategory, numAmount, txDate, desc]
        );

        return res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/budget/:id
 */
async function updateTransaction(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const existing = await db.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found.' });
        }

        const current = existing.rows[0];
        const { type, category, amount, date, description, title } = req.body;

        let updatedType = current.type;
        if (type) {
            const lowered = type.toLowerCase();
            if (lowered === 'income' || lowered === 'expense') updatedType = lowered;
        }

        let updatedAmount = current.amount;
        if (amount !== undefined) {
            const num = parseFloat(amount);
            if (isNaN(num) || num <= 0) {
                return res.status(400).json({ error: 'Amount must be a positive number.' });
            }
            updatedAmount = num;
        }

        const updatedCategory = category !== undefined ? category : current.category;
        const updatedDate = date !== undefined ? date : current.date;
        const updatedDesc = (description !== undefined || title !== undefined)
            ? (description || title).trim()
            : current.description;

        const result = await db.query(
            `UPDATE transactions
             SET type = $1, category = $2, amount = $3, date = $4, description = $5
             WHERE id = $6 AND user_id = $7
             RETURNING *`,
            [updatedType, updatedCategory, updatedAmount, updatedDate, updatedDesc, id, userId]
        );

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/budget/:id
 */
async function deleteTransaction(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found.' });
        }

        return res.status(200).json({ message: 'Transaction deleted successfully.', transaction: result.rows[0] });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/budget/summary
 * Server-side calculation of financial metrics
 */
async function getBudgetSummary(req, res, next) {
    try {
        const userId = req.user.id;

        // 1. Fetch user budget settings
        let settingsRes = await db.query('SELECT * FROM budget_settings WHERE user_id = $1', [userId]);
        let settings = settingsRes.rows[0];
        if (!settings) {
            await db.query(
                `INSERT INTO budget_settings (user_id, monthly_budget, runway_sum, runway_buffer_pct, night_safe_limit, night_safe_spent, night_safe_locked)
                 VALUES ($1, 0, 0, 15, 0, 0, false)`,
                [userId]
            );
            settingsRes = await db.query('SELECT * FROM budget_settings WHERE user_id = $1', [userId]);
            settings = settingsRes.rows[0];
        }

        const monthlyBudget = (settings.monthly_budget !== undefined && settings.monthly_budget !== null) ? parseFloat(settings.monthly_budget) : 0;

        // 2. Fetch all transactions
        const txRes = await db.query('SELECT * FROM transactions WHERE user_id = $1', [userId]);
        const transactions = txRes.rows;

        let totalIncome = 0;
        let totalExpenses = 0;
        const categoryExpenses = {};

        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        let spentThisMonth = 0;

        transactions.forEach(t => {
            const amt = parseFloat(t.amount) || 0;
            const tType = (t.type || '').toLowerCase();
            const cat = t.category || 'Other';

            if (tType === 'income') {
                totalIncome += amt;
            } else {
                totalExpenses += amt;
                categoryExpenses[cat] = (categoryExpenses[cat] || 0) + amt;

                const dateStr = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date || '');
                if (dateStr.startsWith(currentMonth)) {
                    spentThisMonth += amt;
                }
            }
        });

        const remainingBalance = totalIncome - totalExpenses;
        const netBalance = (totalIncome + monthlyBudget) - totalExpenses;
        const remainingMonthlyBudget = Math.max(0, monthlyBudget - spentThisMonth);

        // Runway calculation
        const runwaySum = (settings.runway_sum !== undefined && settings.runway_sum !== null) ? parseFloat(settings.runway_sum) : 0;
        const bufferPct = (settings.runway_buffer_pct !== undefined && settings.runway_buffer_pct !== null) ? parseInt(settings.runway_buffer_pct, 10) : 15;
        const bufferAmount = (runwaySum * bufferPct) / 100;
        const usableLivingFunds = Math.max(0, runwaySum - bufferAmount);
        const monthlyLivingAllowance = runwaySum > 0 ? (usableLivingFunds / 4) : 0;

        return res.status(200).json({
            income: Math.round(totalIncome * 100) / 100,
            expenses: Math.round(totalExpenses * 100) / 100,
            remaining: Math.round(remainingBalance * 100) / 100,
            netBalance: Math.round(netBalance * 100) / 100,
            monthlyBudget,
            spentThisMonth: Math.round(spentThisMonth * 100) / 100,
            remainingMonthlyBudget: Math.round(remainingMonthlyBudget * 100) / 100,
            categoryExpenses,
            settings: {
                monthlyBudget,
                runway: {
                    sum: runwaySum,
                    bufferPct,
                    usableFunds: Math.round(usableLivingFunds),
                    monthlyAllowance: Math.round(monthlyLivingAllowance)
                },
                nightSafe: {
                    limit: (settings.night_safe_limit !== undefined && settings.night_safe_limit !== null) ? parseFloat(settings.night_safe_limit) : 0,
                    spent: (settings.night_safe_spent !== undefined && settings.night_safe_spent !== null) ? parseFloat(settings.night_safe_spent) : 0,
                    locked: Boolean(settings.night_safe_locked)
                }
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/budget/settings
 */
async function getBudgetSettings(req, res, next) {
    try {
        const userId = req.user.id;
        let resData = await db.query('SELECT * FROM budget_settings WHERE user_id = $1', [userId]);
        if (resData.rows.length === 0) {
            await db.query(
                `INSERT INTO budget_settings (user_id, monthly_budget, runway_sum, runway_buffer_pct, night_safe_limit, night_safe_spent, night_safe_locked)
                 VALUES ($1, 0, 0, 15, 0, 0, false)`,
                [userId]
            );
            resData = await db.query('SELECT * FROM budget_settings WHERE user_id = $1', [userId]);
        }
        return res.status(200).json(resData.rows[0]);
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/budget/settings
 */
async function updateBudgetSettings(req, res, next) {
    try {
        const userId = req.user.id;
        const { monthlyBudget, runwaySum, runwayBufferPct, nightSafeLimit, nightSafeSpent, nightSafeLocked } = req.body;

        const currentRes = await db.query('SELECT * FROM budget_settings WHERE user_id = $1', [userId]);
        const current = currentRes.rows[0] || {};

        const mBudget = monthlyBudget !== undefined ? parseFloat(monthlyBudget) : ((current.monthly_budget !== undefined && current.monthly_budget !== null) ? parseFloat(current.monthly_budget) : 0);
        const rSum = runwaySum !== undefined ? parseFloat(runwaySum) : ((current.runway_sum !== undefined && current.runway_sum !== null) ? parseFloat(current.runway_sum) : 0);
        const rBuf = runwayBufferPct !== undefined ? parseInt(runwayBufferPct, 10) : ((current.runway_buffer_pct !== undefined && current.runway_buffer_pct !== null) ? parseInt(current.runway_buffer_pct, 10) : 15);
        const nLimit = nightSafeLimit !== undefined ? parseFloat(nightSafeLimit) : ((current.night_safe_limit !== undefined && current.night_safe_limit !== null) ? parseFloat(current.night_safe_limit) : 0);
        const nSpent = nightSafeSpent !== undefined ? parseFloat(nightSafeSpent) : ((current.night_safe_spent !== undefined && current.night_safe_spent !== null) ? parseFloat(current.night_safe_spent) : 0);
        const nLocked = nightSafeLocked !== undefined ? Boolean(nightSafeLocked) : Boolean(current.night_safe_locked);

        await db.query(
            `INSERT INTO budget_settings (user_id, monthly_budget, runway_sum, runway_buffer_pct, night_safe_limit, night_safe_spent, night_safe_locked)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT(user_id) DO UPDATE SET
                monthly_budget = EXCLUDED.monthly_budget,
                runway_sum = EXCLUDED.runway_sum,
                runway_buffer_pct = EXCLUDED.runway_buffer_pct,
                night_safe_limit = EXCLUDED.night_safe_limit,
                night_safe_spent = EXCLUDED.night_safe_spent,
                night_safe_locked = EXCLUDED.night_safe_locked`,
            [userId, mBudget, rSum, rBuf, nLimit, nSpent, nLocked]
        );

        const updated = await db.query('SELECT * FROM budget_settings WHERE user_id = $1', [userId]);
        return res.status(200).json(updated.rows[0]);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getTransactions,
    getTransactionById,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getBudgetSummary,
    getBudgetSettings,
    updateBudgetSettings
};
