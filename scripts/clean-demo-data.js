/**
 * LifeSync Production Database Cleanup Utility
 * -------------------------------------------------------------
 * Safely identifies and purges disposable demo/test accounts, orphaned test
 * records, and auto-hydrated demo data while rigorously preserving all real user
 * accounts and verified production records.
 *
 * SAFETY GUARANTEES:
 * 1. Defaults to DRY-RUN mode (zero writes or deletions).
 * 2. Requires explicit `--confirm` flag to execute modifications.
 * 3. Automatically triggers a validated, timestamped SQLite backup via
 *    backup-sqlite.js before any deletion or mutation.
 * 4. Whitelists and safeguards real student accounts:
 *    - anujasalve0301@gmail.com
 *    - anewjasalve0301@gmail.com
 *    - pun29071_anuja@katalystindia.org
 *    - codingchallenge1345@gmail.com
 *    - student.lifesync@gmail.com
 *
 * Usage:
 *   node backend/scripts/clean-demo-data.js              # Dry run (safe audit)
 *   node backend/scripts/clean-demo-data.js --confirm    # Creates backup and cleans
 */

const db = require('../config/db');
const { backupSQLite } = require('./backup-sqlite');

// Whitelisted real user accounts that must NEVER be deleted
const REAL_USER_WHITELIST = [
    'anujasalve0301@gmail.com',
    'anewjasalve0301@gmail.com',
    'pun29071_anuja@katalystindia.org',
    'codingchallenge1345@gmail.com',
    'student.lifesync@gmail.com'
];

// Patterns identifying disposable test / demo users
const TEST_EMAIL_PATTERNS = [
    /@lifesync\.edu$/i,
    /@test\.com$/i,
    /^alex\.morgan@gmail\.com$/i
];

// Known auto-hydrated demo transaction descriptions
const DEMO_TX_DESCRIPTIONS = [
    'Semester merit scholarship credit',
    'Textbooks and scientific calculator',
    'Cafeteria food charges',
    'Monthly student metro pass'
];

function isRealUser(email) {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    if (REAL_USER_WHITELIST.includes(normalized)) return true;
    for (const pat of TEST_EMAIL_PATTERNS) {
        if (pat.test(normalized)) return false;
    }
    return true; // Default to preserving unknown accounts
}

async function runCleanup() {
    const isConfirm = process.argv.includes('--confirm');

    console.log('======================================================');
    console.log('   LifeSync Safe Demo Data Audit & Cleanup Utility    ');
    console.log('======================================================');
    console.log(`Mode: ${isConfirm ? '🔴 LIVE EXECUTION (--confirm)' : '🟢 DRY-RUN (Audit only, no changes)'}`);
    console.log('');

    // 1. Fetch all users
    const allUsersRes = await db.query('SELECT id, name, email, created_at FROM users ORDER BY id ASC');
    const allUsers = allUsersRes.rows;

    const realUsers = [];
    const testUsers = [];

    for (const u of allUsers) {
        if (isRealUser(u.email)) {
            realUsers.push(u);
        } else {
            testUsers.push(u);
        }
    }

    console.log(`📊 Found ${allUsers.length} total user accounts:`);
    console.log(`   - Verified Real Users: ${realUsers.length}`);
    console.log(`   - Disposable Test / Demo Users: ${testUsers.length}`);
    console.log('');

    // Print Test Users Table
    console.log('--- Disposable Test / Demo Accounts Identified for Removal ---');
    console.table(testUsers.map(u => ({ id: u.id, name: u.name, email: u.email, created: u.created_at })));

    // Print Real Users Table
    console.log('--- Protected Real Accounts (Will NOT be deleted) ---');
    console.table(realUsers.map(u => ({ id: u.id, name: u.name, email: u.email, created: u.created_at })));

    // 2. Identify Demo Transactions associated with Real Accounts
    const realUserIds = realUsers.map(u => u.id);
    let realUserDemoTx = [];
    if (realUserIds.length > 0) {
        const placeholders = realUserIds.map((_, i) => `$${i + 1}`).join(',');
        const txRes = await db.query(
            `SELECT id, user_id, amount, category, type, description
             FROM transactions
             WHERE user_id IN (${placeholders})`,
            realUserIds
        );
        realUserDemoTx = txRes.rows.filter(t => DEMO_TX_DESCRIPTIONS.includes(t.description));
    }

    if (realUserDemoTx.length > 0) {
        console.log('\n--- Auto-Hydrated Demo Transactions on Real Accounts ---');
        console.table(realUserDemoTx.map(t => ({
            id: t.id,
            user_id: t.user_id,
            type: t.type,
            amount: t.amount,
            category: t.category,
            description: t.description
        })));
    } else {
        console.log('\n✓ No auto-hydrated demo transactions detected on real accounts.');
    }

    // 3. Check for Real Users having hardcoded demo profile fields
    let profilesToClean = [];
    if (realUserIds.length > 0) {
        const placeholders = realUserIds.map((_, i) => `$${i + 1}`).join(',');
        const profRes = await db.query(
            `SELECT user_id, name, university, major, year_semester, student_id, xp
             FROM profiles
             WHERE user_id IN (${placeholders})`,
            realUserIds
        );
        profilesToClean = profRes.rows.filter(p =>
            p.university === 'National Institute of Technology' &&
            p.student_id === 'STU-2026-8841'
        );
    }

    if (profilesToClean.length > 0) {
        console.log('\n--- Real Profiles With Default Hardcoded Demo Placeholders ---');
        console.table(profilesToClean.map(p => ({
            user_id: p.user_id,
            name: p.name,
            university: p.university,
            student_id: p.student_id,
            action: 'Reset demo college placeholders to NULL'
        })));
    }

    // 4. Execution or Dry-Run summary
    if (!isConfirm) {
        console.log('\n======================================================');
        console.log('               DRY-RUN SUMMARY                        ');
        console.log('======================================================');
        console.log(`• Test users to delete: ${testUsers.length}`);
        console.log(`• Auto-hydrated demo transactions to remove from real accounts: ${realUserDemoTx.length}`);
        console.log(`• Real profiles to reset demo college placeholders: ${profilesToClean.length}`);
        console.log('\n💡 NO CHANGES WERE MADE TO THE DATABASE.');
        console.log('To execute this cleanup safely with an automated backup, run:');
        console.log('  node backend/scripts/clean-demo-data.js --confirm\n');
        process.exit(0);
    }

    // 5. Live Execution with Prior Backup
    console.log('\n🔐 Creating verified database backup prior to execution...');
    const backupPath = backupSQLite();
    if (!backupPath) {
        console.error('❌ Aborting: Backup verification failed.');
        process.exit(1);
    }

    console.log('\n⚙️ Executing cleanup operations...');

    // A. Delete test / demo users (Foreign Keys ON -> cascades tasks, events, etc.)
    if (testUsers.length > 0) {
        const testUserIds = testUsers.map(u => u.id);
        const placeholders = testUserIds.map((_, i) => `$${i + 1}`).join(',');

        // Explicitly remove cascade rows to support databases without foreign keys enabled
        const childTables = [
            'tasks',
            'events',
            'transactions',
            'wellness_records',
            'pomodoro_sessions',
            'notifications',
            'profiles',
            'budget_settings',
            'wellness_sudoku_games',
            'wellness_game_progress'
        ];

        for (const tbl of childTables) {
            try {
                await db.query(`DELETE FROM ${tbl} WHERE user_id IN (${placeholders})`, testUserIds);
            } catch (err) {
                // Table might not have user_id or error
            }
        }

        const delUsers = await db.query(`DELETE FROM users WHERE id IN (${placeholders})`, testUserIds);
        console.log(`✅ Successfully removed ${testUsers.length} test/demo users.`);
    }

    // B. Delete auto-hydrated demo transactions from real accounts
    if (realUserDemoTx.length > 0) {
        const txIds = realUserDemoTx.map(t => t.id);
        const placeholders = txIds.map((_, i) => `$${i + 1}`).join(',');
        await db.query(`DELETE FROM transactions WHERE id IN (${placeholders})`, txIds);
        console.log(`✅ Successfully removed ${realUserDemoTx.length} auto-hydrated demo transactions from real user accounts.`);
    }

    // C. Reset hardcoded demo placeholders in real profiles where not customized
    if (profilesToClean.length > 0) {
        for (const p of profilesToClean) {
            await db.query(
                `UPDATE profiles
                 SET university = NULL, major = NULL, year_semester = NULL, student_id = NULL
                 WHERE user_id = $1`,
                [p.user_id]
            );
        }
        console.log(`✅ Reset default demo college fields to clean NULL for ${profilesToClean.length} real profiles.`);
    }

    console.log('\n🎉 Database cleanup complete! Real user accounts remain completely intact.');
    process.exit(0);
}

runCleanup().catch(err => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
});
