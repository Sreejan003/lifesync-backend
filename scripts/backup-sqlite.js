/**
 * LifeSync SQLite Database Backup Utility
 * -------------------------------------------------------------
 * Safely copies the active lifesync.db file into backend/backups/
 * with an ISO timestamp filename and validates file integrity.
 */

const fs = require('fs');
const path = require('path');

function backupSQLite() {
    const dbPath = path.join(__dirname, '..', 'lifesync.db');
    const backupsDir = path.join(__dirname, '..', 'backups');

    if (!fs.existsSync(dbPath)) {
        console.log(`ℹ️ No SQLite database found at: ${dbPath}. Skipping backup.`);
        return null;
    }

    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `lifesync_backup_${timestamp}.db`;
    const targetPath = path.join(backupsDir, backupFileName);

    try {
        fs.copyFileSync(dbPath, targetPath);
        const originalStats = fs.statSync(dbPath);
        const backupStats = fs.statSync(targetPath);

        if (originalStats.size === backupStats.size) {
            console.log(`✅ SQLite Backup successfully created!`);
            console.log(`   Source: ${dbPath} (${originalStats.size} bytes)`);
            console.log(`   Backup: ${targetPath} (${backupStats.size} bytes)`);
            return targetPath;
        } else {
            console.error(`❌ Backup size mismatch: ${originalStats.size} vs ${backupStats.size}`);
            return null;
        }
    } catch (err) {
        console.error(`❌ Failed to create SQLite backup:`, err.message);
        throw err;
    }
}

if (require.main === module) {
    backupSQLite();
}

module.exports = { backupSQLite };
