/**
 * LifeSync Health Check Endpoint
 * -------------------------------------------------------------
 * GET /api/health
 * Verifies server uptime and live database connectivity (via SELECT 1 ping).
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
    try {
        const startTime = Date.now();
        await db.query('SELECT 1 as ping;');
        const latencyMs = Date.now() - startTime;

        res.status(200).json({
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            database: {
                status: 'connected',
                driver: db.getDriver(),
                latencyMs
            }
        });
    } catch (err) {
        console.error('❌ Health check database ping failed:', err.message);
        res.status(503).json({
            status: 'error',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            database: {
                status: 'disconnected',
                driver: db.getDriver(),
                error: err.message
            }
        });
    }
});

module.exports = router;
