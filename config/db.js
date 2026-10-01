/**
 * LifeSync Database Connection Layer
 * -----------------------------------------------------------------
 * Seamless dual-mode database adapter:
 * - Production: Connects to PostgreSQL via DATABASE_URL (Render, Railway, Neon, Supabase)
 * - Local / Offline: Defaults to zero-config local SQLite (lifesync.db)
 *
 * Exposes a standardized async query(sql, params) interface returning { rows, rowCount }.
 */

const path = require('path');
const fs = require('fs');

let dbDriver = null; // 'pg' or 'sqlite'
let pool = null;     // pg.Pool
let sqliteDb = null; // sqlite3.Database

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();

if (databaseUrl) {
    // PostgreSQL connection
    const { Pool } = require('pg');
    dbDriver = 'pg';
    const sslConfig = (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1'))
        ? false
        : { rejectUnauthorized: false };

    pool = new Pool({
        connectionString: databaseUrl,
        ssl: sslConfig
    });

    console.log('📦 Using PostgreSQL database connection.');
} else if (isProduction) {
    // In production without DATABASE_URL, fail loudly at startup
    console.error('❌ FATAL: DATABASE_URL environment variable is not set.');
    console.error('   Set DATABASE_URL to a PostgreSQL connection string in your Vercel/Render environment variables.');
    process.exit(1);
} else {
    // Local / Offline: try SQLite, fail gracefully if not compiled
    try {
        const sqlite3 = require('sqlite3').verbose();
        dbDriver = 'sqlite';
        const dbPath = path.join(__dirname, '..', 'lifesync.db');
        sqliteDb = new sqlite3.Database(dbPath);
        console.log(`📦 Using local SQLite database at: ${dbPath}`);
    } catch (e) {
        console.error('❌ sqlite3 is not available and DATABASE_URL is not set.');
        console.error('   For local dev: run `npm install` inside the backend folder.');
        console.error('   For production: set DATABASE_URL in your environment variables.');
        process.exit(1);
    }
}

/**
 * Standardized query interface matching pg.Pool.query(sql, params)
 * @param {string} text - SQL query string
 * @param {Array} params - Array of parameter values
 * @returns {Promise<{ rows: Array, rowCount: number }>}
 */
function query(text, params = []) {
    if (dbDriver === 'pg') {
        return pool.query(text, params).then(res => ({
            rows: res.rows || [],
            rowCount: res.rowCount || 0
        }));
    }

    // SQLite adapter
    return new Promise((resolve, reject) => {
        // Convert PostgreSQL style $1, $2, $3 to SQLite ?
        let sqliteText = text.replace(/\$(\d+)/g, '?');

        // Check if query is a SELECT
        const trimmed = sqliteText.trim().toUpperCase();
        const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA');
        const hasReturning = trimmed.includes('RETURNING');

        if (isSelect || hasReturning) {
            sqliteDb.all(sqliteText, params, function (err, rows) {
                if (err) return reject(err);
                resolve({
                    rows: rows || [],
                    rowCount: rows ? rows.length : 0
                });
            });
        } else {
            sqliteDb.run(sqliteText, params, function (err) {
                if (err) return reject(err);
                resolve({
                    rows: [],
                    rowCount: this.changes || 0,
                    lastID: this.lastID
                });
            });
        }
    });
}

/**
 * Initialize all relational tables if they do not already exist
 */
async function initDatabase() {
    if (dbDriver === 'sqlite') {
        // Enable foreign key constraints in SQLite
        await query('PRAGMA foreign_keys = ON;');
    }

    const isPg = dbDriver === 'pg';
    const idType = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    const timestampType = isPg ? 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP';
    const numericType = isPg ? 'NUMERIC(10, 2)' : 'REAL';

    // 1. Users Table
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            id ${idType},
            name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            avatar_letter VARCHAR(5),
            created_at ${timestampType}
        );
    `);

    // 2. Tasks Table
    await query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id ${idType},
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            category VARCHAR(50) DEFAULT 'Study',
            deadline DATE,
            priority VARCHAR(20) DEFAULT 'Medium',
            status VARCHAR(20) DEFAULT 'Pending',
            description TEXT,
            created_at ${timestampType},
            completed_at ${timestampType}
        );
    `);

    // 3. Calendar Events Table
    await query(`
        CREATE TABLE IF NOT EXISTS events (
            id ${idType},
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            date DATE NOT NULL,
            time VARCHAR(10) DEFAULT '09:00',
            event_type VARCHAR(50) DEFAULT 'Study',
            reminder BOOLEAN DEFAULT 0,
            created_at ${timestampType}
        );
    `);

    // 4. Budget Transactions Table
    await query(`
        CREATE TABLE IF NOT EXISTS transactions (
            id ${idType},
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(20) NOT NULL,
            category VARCHAR(50) NOT NULL,
            amount ${numericType} NOT NULL,
            date DATE NOT NULL,
            description TEXT,
            created_at ${timestampType}
        );
    `);

    // 5. Budget Settings Table (runway, late night safe, monthly target)
    await query(`
        CREATE TABLE IF NOT EXISTS budget_settings (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            monthly_budget ${numericType} DEFAULT 0,
            runway_sum ${numericType} DEFAULT 0,
            runway_buffer_pct INTEGER DEFAULT 15,
            night_safe_limit ${numericType} DEFAULT 0,
            night_safe_spent ${numericType} DEFAULT 0,
            night_safe_locked BOOLEAN DEFAULT 0
        );
    `);

    // 6. Mental Wellness Records Table
    await query(`
        CREATE TABLE IF NOT EXISTS wellness_records (
            id ${idType},
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            mood VARCHAR(30) NOT NULL,
            note TEXT,
            stress INTEGER DEFAULT 2,
            energy INTEGER DEFAULT 3,
            date DATE NOT NULL,
            created_at ${timestampType}
        );
    `);

    // 7. Student Profiles Table
    await query(`
        CREATE TABLE IF NOT EXISTS profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100),
            email VARCHAR(255),
            university VARCHAR(255) DEFAULT '',
            major VARCHAR(255) DEFAULT '',
            year_semester VARCHAR(100) DEFAULT '',
            student_id VARCHAR(100) DEFAULT '',
            currency VARCHAR(10) DEFAULT '₹',
            xp INTEGER DEFAULT 120,
            notifications_enabled BOOLEAN DEFAULT 1
        );
    `);

    // 8. Wellness Sudoku Games Table
    await query(`
        CREATE TABLE IF NOT EXISTS wellness_sudoku_games (
            id ${idType},
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            puzzle_id VARCHAR(100),
            difficulty VARCHAR(20) DEFAULT 'medium',
            is_completed BOOLEAN DEFAULT 0,
            time_seconds INTEGER DEFAULT 0,
            mistakes_count INTEGER DEFAULT 0,
            hints_used INTEGER DEFAULT 0,
            checks_count INTEGER DEFAULT 0,
            started_at ${timestampType},
            completed_at ${timestampType},
            updated_at ${timestampType}
        );
    `);

    // 9. Wellness Game Progress (Word Scramble, Riddles, Breathing Pacer)
    await query(`
        CREATE TABLE IF NOT EXISTS wellness_game_progress (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            scramble_xp INTEGER DEFAULT 0,
            scramble_streak INTEGER DEFAULT 0,
            scramble_best_streak INTEGER DEFAULT 0,
            scramble_words_completed INTEGER DEFAULT 0,
            scramble_hints_used INTEGER DEFAULT 0,
            scramble_last_played ${timestampType},
            riddles_attempted INTEGER DEFAULT 0,
            riddles_solved INTEGER DEFAULT 0,
            riddles_xp INTEGER DEFAULT 0,
            riddles_last_played ${timestampType},
            breathing_cycles INTEGER DEFAULT 0,
            breathing_sessions INTEGER DEFAULT 0,
            breathing_last_session ${timestampType},
            created_at ${timestampType},
            updated_at ${timestampType}
        );
    `);

    console.log('✅ Database schema verified and initialized.');
}

/**
 * Execute a series of operations atomically within a database transaction.
 * @param {Function} callback - async (tx) => Promise<any>
 * @returns {Promise<any>}
 */
async function transaction(callback) {
    if (dbDriver === 'pg') {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const txWrapper = {
                query: (text, params = []) => client.query(text, params).then(res => ({
                    rows: res.rows || [],
                    rowCount: res.rowCount || 0
                }))
            };
            const result = await callback(txWrapper);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // SQLite transaction
    await query('BEGIN TRANSACTION');
    try {
        const txWrapper = { query };
        const result = await callback(txWrapper);
        await query('COMMIT');
        return result;
    } catch (err) {
        await query('ROLLBACK');
        throw err;
    }
}

module.exports = {
    query,
    transaction,
    initDatabase,
    getDriver: () => dbDriver
};
