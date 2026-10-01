/**
 * LifeSync JWT Authentication Middleware
 * -------------------------------------------------------------
 * Extracts and verifies Bearer JWT token from Authorization header.
 * Attaches authenticated user context (id, email, name) to req.user.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Access denied. Authentication token is required.' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Malformed authorization header. Expected "Bearer <token>".' });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.id || decoded.sub,
            email: decoded.email,
            name: decoded.name || decoded.username
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token has expired. Please log in again.' });
        }
        return res.status(401).json({ error: 'Invalid authentication token.' });
    }
}

module.exports = authMiddleware;
