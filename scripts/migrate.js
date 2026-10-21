/**
 * LifeSync Database Migration Runner
 * -------------------------------------------------------------
 * Executes version-controlled SQL migrations from backend/migrations/
 * Tracks applied migrations in the schema_migrations table.
 * Supports both PostgreSQL/Supabase (production) and SQLite (local dev).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
    console.log('=================================================');
    console.log('🔄 LifeSync Database Migration Runner');
    console.log(`📦 Active Target: ${db.getDriver().toUpperCase()}`);
    console.log('=================================================');

    const isPg = db.getDriver() === 'pg';

    // 1. Create schema_migrations table if not exists
    if (isPg) {
        await db.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } else {
        await db.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) UNIQUE NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    // 2. Fetch already applied migrations
    const appliedRes = await db.query('SELECT name FROM schema_migrations ORDER BY id ASC;');
    const appliedSet = new Set(appliedRes.rows.map(r => r.name));

    // 3. Find migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
        console.log('⚠️ No migrations directory found.');
        return;
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    let executedCount = 0;

    for (const file of files) {
        if (appliedSet.has(file)) {
            console.log(`⏭️  Skipping already applied migration: ${file}`);
            continue;
        }

        console.log(`🚀 Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf8');

        if (isPg) {
            // Execute raw SQL on PostgreSQL
            await db.query(sqlContent);
        } else {
            // SQLite execution
            if (file.includes('rls')) {
                console.log(`   ℹ️ Note: ${file} contains PostgreSQL-specific RLS. Skipping on SQLite.`);
            } else {
                // Translate PostgreSQL dialect to SQLite
                const translatedSql = sqlContent
                    .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
                    .replace(/TIMESTAMP WITH TIME ZONE/gi, 'DATETIME')
                    .replace(/NUMERIC\(\d+,\s*\d+\)/gi, 'REAL')
                    .replace(/BOOLEAN DEFAULT FALSE/gi, 'BOOLEAN DEFAULT 0')
                    .replace(/BOOLEAN DEFAULT TRUE/gi, 'BOOLEAN DEFAULT 1');

                // Strip line comments before splitting
                const strippedSql = translatedSql.replace(/--.*$/gm, '').trim();

                // Split standard SQL statements by semicolon
                const statements = strippedSql
                    .split(/;\s*/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                for (const stmt of statements) {
                    try {
                        await db.query(stmt);
                    } catch (stmtErr) {
                        // Tolerate existing index or table if duplicate
                        if (!stmtErr.message.includes('already exists')) {
                            console.warn(`   ⚠️ Warning in statement: ${stmtErr.message}`);
                        }
                    }
                }
            }
        }

        // Record applied migration
        await db.query('INSERT INTO schema_migrations (name) VALUES ($1);', [file]);
        console.log(`✅ Applied migration: ${file}`);
        executedCount++;
    }

    console.log('=================================================');
    console.log(`🎉 Migrations complete! Applied ${executedCount} new migration(s).`);
    console.log('=================================================');
}

if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('❌ Migration failed:', err);
            process.exit(1);
        });
}

module.exports = { runMigrations };
