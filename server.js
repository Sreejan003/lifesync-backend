/**
 * LifeSync REST API Server (backend/server.js)
 * -------------------------------------------------------------
 * Main entrypoint for LifeSync backend application.
 * Serves REST endpoints under /api/*
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const db = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route Imports
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const eventRoutes = require('./routes/eventRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const wellnessRoutes = require('./routes/wellnessRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const pomodoroRoutes = require('./routes/pomodoroRoutes');
const scheduler = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5000';

// CORS configuration
const allowedOrigins = [
    CLIENT_URL,
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (such as mobile apps, curl, postman, server-to-server)
        if (!origin) {
            return callback(null, true);
        }

        // In non-production environments, allow local development addresses
        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
            return callback(null, true);
        }

        // Match against explicitly configured client URLs
        const isAllowed = allowedOrigins.some(allowed => origin.toLowerCase() === allowed.toLowerCase());
        if (isAllowed) {
            return callback(null, true);
        }

        return callback(new Error(`CORS policy: Access denied for origin ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/pomodoro', pomodoroRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: `API route ${req.method} ${req.path} not found.` });
    }
    res.status(404).json({ error: 'Not found' });
});

// Global Error Handler
app.use(errorHandler);

// Initialize Database and Start Server
let runningServer = null;

async function startServer(portToUse) {
    try {
        await db.initDatabase();

        const activePort = portToUse !== undefined ? portToUse : (process.env.PORT || 5000);
        return new Promise((resolve, reject) => {
            const server = app.listen(activePort, () => {
                const assignedPort = server.address() ? server.address().port : activePort;
                console.log(`=================================================`);
                console.log(`🚀 LifeSync Backend Server Running on Port ${assignedPort}`);
                console.log(`🌐 Local URL:   http://localhost:${assignedPort}`);
                console.log(`🩺 Healthcheck: http://localhost:${assignedPort}/api/health`);
                console.log(`📦 Database:    ${db.getDriver().toUpperCase()}`);
                console.log(`=================================================`);

                runningServer = server;

                // Start background smart notification scheduler
                scheduler.startScheduler();

                resolve(server);
            });
            server.on('error', reject);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        return null;
    }
}

// Graceful Shutdown Handler
function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down LifeSync server...`);
    scheduler.stopScheduler();

    if (runningServer) {
        runningServer.close(async () => {
            console.log('🚪 HTTP server closed.');
            await db.closeDatabase();
            console.log('👋 LifeSync process exited cleanly.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// If invoked directly, start server
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer, gracefulShutdown };
