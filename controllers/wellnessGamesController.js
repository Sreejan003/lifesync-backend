/**
 * LifeSync Mental Wellness Games Controller (backend/controllers/wellnessGamesController.js)
 * ----------------------------------------------------------------------------------------
 * Manages user-specific persistence for mindful refresh games:
 * 1. Zen Sudoku (progress, completion, times, hints, checks)
 * 2. Word Scramble (streak, best streak, XP, words completed, hints)
 * 3. Mindful Riddles (attempted, solved, XP)
 * 4. 4-7-8 Breathing Pacer (cycles, completed sessions)
 * 5. Mindful Games Summary (aggregated dashboard metrics)
 *
 * Enforces strict user tenant isolation by req.user.id.
 */

const db = require('../config/db');

// Helper: Ensure a row exists in wellness_game_progress for the given user
async function ensureGameProgressRow(userId) {
    const existing = await db.query(
        'SELECT * FROM wellness_game_progress WHERE user_id = $1',
        [userId]
    );
    if (existing.rows.length > 0) {
        return existing.rows[0];
    }

    const created = await db.query(
        `INSERT INTO wellness_game_progress (user_id)
         VALUES ($1)
         RETURNING *`,
        [userId]
    );
    return created.rows[0] || {
        user_id: userId,
        scramble_xp: 0,
        scramble_streak: 0,
        scramble_best_streak: 0,
        scramble_words_completed: 0,
        scramble_hints_used: 0,
        riddles_attempted: 0,
        riddles_solved: 0,
        riddles_xp: 0,
        breathing_cycles: 0,
        breathing_sessions: 0
    };
}

/**
 * GET /api/wellness/sudoku
 * Retrieve user's recent Sudoku games and completion stats
 */
async function getSudokuProgress(req, res, next) {
    try {
        const userId = req.user.id;

        const gamesRes = await db.query(
            'SELECT * FROM wellness_sudoku_games WHERE user_id = $1 ORDER BY id DESC LIMIT 15',
            [userId]
        );

        const countRes = await db.query(
            'SELECT COUNT(*) as count FROM wellness_sudoku_games WHERE user_id = $1 AND is_completed = 1',
            [userId]
        );

        const completedCount = parseInt((countRes.rows[0] && countRes.rows[0].count) || 0, 10);

        return res.status(200).json({
            completedCount,
            totalGames: gamesRes.rows.length,
            recentGames: gamesRes.rows
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/wellness/sudoku/progress
 * Save in-progress Sudoku state (timer, mistakes, hints, checks)
 */
async function saveSudokuProgress(req, res, next) {
    try {
        const userId = req.user.id;
        const { puzzleId, difficulty, timeSeconds, mistakesCount, hintsUsed, checksCount } = req.body;

        const pid = (puzzleId || `board_${Date.now()}`).toString().slice(0, 100);
        const diff = (difficulty && ['easy', 'medium', 'hard'].includes(difficulty.toLowerCase()))
            ? difficulty.toLowerCase()
            : 'medium';
        const timeSec = Math.max(0, parseInt(timeSeconds, 10) || 0);
        const mistakes = Math.max(0, parseInt(mistakesCount, 10) || 0);
        const hints = Math.max(0, parseInt(hintsUsed, 10) || 0);
        const checks = Math.max(0, parseInt(checksCount, 10) || 0);

        // Check if game already tracked for this puzzle
        const existing = await db.query(
            'SELECT id FROM wellness_sudoku_games WHERE user_id = $1 AND puzzle_id = $2',
            [userId, pid]
        );

        let result;
        if (existing.rows.length > 0) {
            result = await db.query(
                `UPDATE wellness_sudoku_games
                 SET difficulty = $1, time_seconds = $2, mistakes_count = $3, hints_used = $4, checks_count = $5, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6 AND user_id = $7
                 RETURNING *`,
                [diff, timeSec, mistakes, hints, checks, existing.rows[0].id, userId]
            );
        } else {
            result = await db.query(
                `INSERT INTO wellness_sudoku_games (user_id, puzzle_id, difficulty, is_completed, time_seconds, mistakes_count, hints_used, checks_count)
                 VALUES ($1, $2, $3, 0, $4, $5, $6, $7)
                 RETURNING *`,
                [userId, pid, diff, timeSec, mistakes, hints, checks]
            );
        }

        return res.status(200).json({
            message: 'Sudoku progress saved successfully.',
            game: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/wellness/sudoku/complete
 * Record completion of a Sudoku puzzle and award XP
 */
async function completeSudoku(req, res, next) {
    try {
        const userId = req.user.id;
        const { puzzleId, difficulty, timeSeconds, mistakesCount, hintsUsed, checksCount } = req.body;

        const pid = (puzzleId || `board_${Date.now()}`).toString().slice(0, 100);
        const diff = (difficulty && ['easy', 'medium', 'hard'].includes(difficulty.toLowerCase()))
            ? difficulty.toLowerCase()
            : 'medium';
        const timeSec = Math.max(0, parseInt(timeSeconds, 10) || 0);
        const mistakes = Math.max(0, parseInt(mistakesCount, 10) || 0);
        const hints = Math.max(0, parseInt(hintsUsed, 10) || 0);
        const checks = Math.max(0, parseInt(checksCount, 10) || 0);

        const existing = await db.query(
            'SELECT id, is_completed FROM wellness_sudoku_games WHERE user_id = $1 AND puzzle_id = $2',
            [userId, pid]
        );

        let result;
        if (existing.rows.length > 0) {
            result = await db.query(
                `UPDATE wellness_sudoku_games
                 SET is_completed = 1, difficulty = $1, time_seconds = $2, mistakes_count = $3, hints_used = $4, checks_count = $5, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6 AND user_id = $7
                 RETURNING *`,
                [diff, timeSec, mistakes, hints, checks, existing.rows[0].id, userId]
            );
        } else {
            result = await db.query(
                `INSERT INTO wellness_sudoku_games (user_id, puzzle_id, difficulty, is_completed, time_seconds, mistakes_count, hints_used, checks_count, completed_at)
                 VALUES ($1, $2, $3, 1, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                 RETURNING *`,
                [userId, pid, diff, timeSec, mistakes, hints, checks]
            );
        }

        // Award +50 XP to profile
        try {
            await db.query(
                'UPDATE profiles SET xp = xp + 50 WHERE user_id = $1',
                [userId]
            );
        } catch (e) {}

        return res.status(200).json({
            message: '🎉 Sudoku puzzle completed!',
            game: result.rows[0],
            xpAwarded: 50
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/wellness/word-scramble/progress
 * Retrieve Word Scramble streak and stats
 */
async function getWordScrambleProgress(req, res, next) {
    try {
        const userId = req.user.id;
        const progress = await ensureGameProgressRow(userId);

        return res.status(200).json({
            streak: progress.scramble_streak || 0,
            bestStreak: progress.scramble_best_streak || 0,
            xp: progress.scramble_xp || 0,
            wordsCompleted: progress.scramble_words_completed || 0,
            hintsUsed: progress.scramble_hints_used || 0,
            lastPlayedAt: progress.scramble_last_played || null
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/wellness/word-scramble/progress
 * Record Word Scramble progress / word solved
 */
async function saveWordScrambleProgress(req, res, next) {
    try {
        const userId = req.user.id;
        const { streak, xpEarned, wordCompleted, hintsUsed } = req.body;

        const current = await ensureGameProgressRow(userId);

        const newStreak = streak !== undefined ? Math.max(0, parseInt(streak, 10) || 0) : (current.scramble_streak || 0);
        const bestStreak = Math.max(current.scramble_best_streak || 0, newStreak);
        const addXp = Math.max(0, parseInt(xpEarned, 10) || 0);
        const newTotalXp = (current.scramble_xp || 0) + addXp;
        const wordsInc = (wordCompleted === true || wordCompleted === 1) ? 1 : (parseInt(req.body.wordsCompleted, 10) || 0);
        const newWordsCompleted = (current.scramble_words_completed || 0) + wordsInc;
        const hintsInc = Math.max(0, parseInt(hintsUsed, 10) || 0);
        const newHintsUsed = (current.scramble_hints_used || 0) + hintsInc;

        const updated = await db.query(
            `UPDATE wellness_game_progress
             SET scramble_streak = $1,
                 scramble_best_streak = $2,
                 scramble_xp = $3,
                 scramble_words_completed = $4,
                 scramble_hints_used = $5,
                 scramble_last_played = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $6
             RETURNING *`,
            [newStreak, bestStreak, newTotalXp, newWordsCompleted, newHintsUsed, userId]
        );

        if (addXp > 0) {
            try {
                await db.query(
                    'UPDATE profiles SET xp = xp + $1 WHERE user_id = $2',
                    [addXp, userId]
                );
            } catch (e) {}
        }

        const row = updated.rows[0] || {};
        return res.status(200).json({
            message: 'Word Scramble progress saved.',
            streak: row.scramble_streak || 0,
            bestStreak: row.scramble_best_streak || 0,
            xp: row.scramble_xp || 0,
            wordsCompleted: row.scramble_words_completed || 0,
            hintsUsed: row.scramble_hints_used || 0,
            lastPlayedAt: row.scramble_last_played || new Date().toISOString()
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/wellness/riddle/progress
 * Retrieve Mindful Riddle stats
 */
async function getRiddleProgress(req, res, next) {
    try {
        const userId = req.user.id;
        const progress = await ensureGameProgressRow(userId);

        return res.status(200).json({
            riddlesAttempted: progress.riddles_attempted || 0,
            riddlesSolved: progress.riddles_solved || 0,
            xp: progress.riddles_xp || 0,
            lastPlayedAt: progress.riddles_last_played || null
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/wellness/riddle/progress
 * Record Mindful Riddle attempted or revealed/solved
 */
async function saveRiddleProgress(req, res, next) {
    try {
        const userId = req.user.id;
        const { attempted, solved, xpEarned } = req.body;

        const current = await ensureGameProgressRow(userId);

        const attemptInc = (attempted === true || attempted === 1) ? 1 : 0;
        const solvedInc = (solved === true || solved === 1) ? 1 : 0;
        const addXp = Math.max(0, parseInt(xpEarned, 10) || (solvedInc ? 20 : 0));

        const newAttempted = (current.riddles_attempted || 0) + attemptInc;
        const newSolved = (current.riddles_solved || 0) + solvedInc;
        const newXp = (current.riddles_xp || 0) + addXp;

        const updated = await db.query(
            `UPDATE wellness_game_progress
             SET riddles_attempted = $1,
                 riddles_solved = $2,
                 riddles_xp = $3,
                 riddles_last_played = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $4
             RETURNING *`,
            [newAttempted, newSolved, newXp, userId]
        );

        if (addXp > 0) {
            try {
                await db.query(
                    'UPDATE profiles SET xp = xp + $1 WHERE user_id = $2',
                    [addXp, userId]
                );
            } catch (e) {}
        }

        const row = updated.rows[0] || {};
        return res.status(200).json({
            message: 'Riddle progress saved.',
            riddlesAttempted: row.riddles_attempted || 0,
            riddlesSolved: row.riddles_solved || 0,
            xp: row.riddles_xp || 0,
            lastPlayedAt: row.riddles_last_played || new Date().toISOString()
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/wellness/breathing/progress
 * Retrieve 4-7-8 Breathing Pacer summary
 */
async function getBreathingProgress(req, res, next) {
    try {
        const userId = req.user.id;
        const progress = await ensureGameProgressRow(userId);

        return res.status(200).json({
            totalCycles: progress.breathing_cycles || 0,
            totalSessions: progress.breathing_sessions || 0,
            lastSessionAt: progress.breathing_last_session || null
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/wellness/breathing/progress
 * Record completed cycles and session
 */
async function saveBreathingProgress(req, res, next) {
    try {
        const userId = req.user.id;
        const { cyclesCompleted, sessionCompleted } = req.body;

        const current = await ensureGameProgressRow(userId);

        const cyclesInc = Math.max(0, parseInt(cyclesCompleted, 10) || 0);
        const sessionInc = (sessionCompleted === true || sessionCompleted === 1 || cyclesInc >= 3) ? 1 : 0;

        const newCycles = (current.breathing_cycles || 0) + cyclesInc;
        const newSessions = (current.breathing_sessions || 0) + sessionInc;

        const updated = await db.query(
            `UPDATE wellness_game_progress
             SET breathing_cycles = $1,
                 breathing_sessions = $2,
                 breathing_last_session = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $3
             RETURNING *`,
            [newCycles, newSessions, userId]
        );

        const row = updated.rows[0] || {};
        return res.status(200).json({
            message: 'Breathing session progress recorded.',
            totalCycles: row.breathing_cycles || 0,
            totalSessions: row.breathing_sessions || 0,
            lastSessionAt: row.breathing_last_session || new Date().toISOString()
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/wellness/games/summary
 * Aggregate student statistics across all mindful games
 */
async function getWellnessGamesSummary(req, res, next) {
    try {
        const userId = req.user.id;

        // Sudoku stats
        const sudokuRes = await db.query(
            'SELECT COUNT(*) as count FROM wellness_sudoku_games WHERE user_id = $1 AND is_completed = 1',
            [userId]
        );
        const sudokuCompleted = parseInt((sudokuRes.rows[0] && sudokuRes.rows[0].count) || 0, 10);

        // Progress row
        const progress = await ensureGameProgressRow(userId);

        const wordScrambleXp = progress.scramble_xp || 0;
        const wordScrambleStreak = progress.scramble_streak || 0;
        const wordsCompleted = progress.scramble_words_completed || 0;
        const riddlesSolved = progress.riddles_solved || 0;
        const breathingSessions = progress.breathing_sessions || 0;
        const breathingCycles = progress.breathing_cycles || 0;

        const totalMindfulBreaks = sudokuCompleted + wordsCompleted + riddlesSolved + breathingSessions;

        return res.status(200).json({
            sudokuCompleted,
            wordScrambleXp,
            wordScrambleStreak,
            riddlesSolved,
            breathingSessions,
            breathingCycles,
            totalMindfulBreaks
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getSudokuProgress,
    saveSudokuProgress,
    completeSudoku,
    getWordScrambleProgress,
    saveWordScrambleProgress,
    getRiddleProgress,
    saveRiddleProgress,
    getBreathingProgress,
    saveBreathingProgress,
    getWellnessGamesSummary
};
