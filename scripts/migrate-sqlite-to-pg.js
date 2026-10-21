/**
 * LifeSync SQLite to PostgreSQL / Supabase Data Migration Utility
 * -------------------------------------------------------------
 * Safely extracts all records from local SQLite (lifesync.db)
 * and inserts them into Supabase PostgreSQL via DATABASE_URL.
 *
 * Verifies record counts across all tables before concluding.
 * Does NOT delete the SQLite database.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

async function migrateData() {
    const databaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();
    if (!databaseUrl) {
        console.error('❌ Error: DATABASE_URL is not set in environment or backend/.env.');
        console.error('   Please provide a valid PostgreSQL/Supabase connection string to migrate data.');
        process.exit(1);
    }

    const sqlitePath = path.join(__dirname, '..', 'lifesync.db');
    if (!fs.existsSync(sqlitePath)) {
        console.log(`ℹ️ SQLite database does not exist at ${sqlitePath}. Nothing to migrate.`);
        process.exit(0);
    }

    console.log('=================================================');
    console.log('🔄 LifeSync Data Migration: SQLite -> PostgreSQL');
    console.log(`📂 Source: ${sqlitePath}`);
    console.log(`🌐 Target: ${databaseUrl.replace(/:[^:]*@/, ':****@')}`);
    console.log('=================================================');

    // Connect to SQLite
    const sqliteDb = new sqlite3.Database(sqlitePath);
    const sqliteQuery = (sql, params = []) => new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });

    // Connect to Postgres
    const sslConfig = (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1'))
        ? false
        : { rejectUnauthorized: false };
    const pgPool = new Pool({
        connectionString: databaseUrl,
        ssl: sslConfig
    });

    // Tables in dependency order
    const tables = [
        'users',
        'tasks',
        'events',
        'transactions',
        'budget_settings',
        'wellness_records',
        'profiles',
        'wellness_sudoku_games',
        'wellness_game_progress',
        'notifications',
        'notification_preferences',
        'pomodoro_sessions',
        'pomodoro_settings'
    ];

    const migrationSummary = [];

    const client = await pgPool.connect();
    try {
        await client.query('BEGIN;');

        for (const table of tables) {
            // Check if table exists in SQLite
            const tableExists = await sqliteQuery(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                [table]
            );

            if (tableExists.length === 0) {
                migrationSummary.push({ table, sourceCount: 0, targetCount: 0, status: 'SKIPPED (Not in SQLite)' });
                continue;
            }

            const rows = await sqliteQuery(`SELECT * FROM ${table};`);
            if (rows.length === 0) {
                migrationSummary.push({ table, sourceCount: 0, targetCount: 0, status: 'EMPTY' });
                continue;
            }

            console.log(`📦 Migrating table '${table}' (${rows.length} rows)...`);

            // Insert each row
            for (const row of rows) {
                const keys = Object.keys(row);
                const values = Object.values(row);
                const columns = keys.join(', ');
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

                const insertSql = `
                    INSERT INTO ${table} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT DO NOTHING;
                `;

                await client.query(insertSql, values);
            }

            // If table has auto-increment 'id', reset sequence in Postgres
            const hasId = rows.length > 0 && ('id' in rows[0]);
            if (hasId) {
                try {
                    await client.query(`
                        SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1))
                        FROM ${table};
                    `);
                } catch (seqErr) {
                    // Ignore if not a sequence
                }
            }

            // Verify count
            const pgCountRes = await client.query(`SELECT COUNT(*) as count FROM ${table};`);
            const pgCount = parseInt(pgCountRes.rows[0].count, 10);

            migrationSummary.push({
                table,
                sourceCount: rows.length,
                targetCount: pgCount,
                status: pgCount >= rows.length ? 'VERIFIED ✅' : 'PARTIAL ⚠️'
            });
        }

        await client.query('COMMIT;');
        console.log('=================================================');
        console.log('📊 Migration Summary:');
        console.table(migrationSummary);
        console.log('🎉 Data migration completed successfully!');
        console.log('=================================================');
    } catch (err) {
        await client.query('ROLLBACK;');
        console.error('❌ Data migration failed! Rolled back transaction.', err);
        throw err;
    } finally {
        client.release();
        await pgPool.end();
        sqliteDb.close();
    }
}

if (require.main === module) {
    migrateData()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { migrateData };
