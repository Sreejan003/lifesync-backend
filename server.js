/**
 * LifeSync REST API Server (backend/server.js)
 * -------------------------------------------------------------
 * Main entrypoint for LifeSync backend application.
 * Serves REST endpoints under /api/* and hosts frontend static assets.
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

// Serve frontend static files from repository root
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);

// Fallback middleware to serve index.html for frontend client routes
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return res.sendFile(path.join(frontendPath, 'index.html'));
    }
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: `API route ${req.method} ${req.path} not found.` });
    }
    next();
});

// Global Error Handler
app.use(errorHandler);

// Initialize Database and Start Server
async function startServer(portToUse) {
    try {
        await db.initDatabase();

        const activePort = portToUse !== undefined ? portToUse : (process.env.PORT || 5000);
        const server = app.listen(activePort, () => {
            console.log(`=================================================`);
            console.log(`🚀 LifeSync Backend Server Running on Port ${activePort}`);
            console.log(`🌐 Local URL:   http://localhost:${activePort}`);
            console.log(`🩺 Healthcheck: http://localhost:${activePort}/api/health`);
            console.log(`📦 Database:    ${db.getDriver().toUpperCase()}`);
            console.log(`=================================================`);
        });

        return server;
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        return null;
    }
}

// If invoked directly, start server
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
