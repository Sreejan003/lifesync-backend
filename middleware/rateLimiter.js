/**
 * LifeSync In-Memory Rate Limiting Middleware
 * (backend/middleware/rateLimiter.js)
 * -------------------------------------------------------------
 * Protects critical authentication endpoints (/login, /register,
 * /forgot-password, /reset-password, /google) against brute force
 * and denial-of-service attempts.
 */

function createRateLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 30, message = 'Too many requests. Please try again later.' } = {}) {
    const hits = new Map();

    // Clean up stale entries every 5 minutes
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of hits.entries()) {
            if (now > data.resetTime) {
                hits.delete(ip);
            }
        }
    }, 5 * 60 * 1000);

    if (cleanupInterval.unref) {
        cleanupInterval.unref();
    }

    return function rateLimiterMiddleware(req, res, next) {
        // Skip or generously allow in automated test environment
        if (process.env.NODE_ENV === 'test') {
            return next();
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
        const now = Date.now();

        let clientData = hits.get(ip);
        if (!clientData || now > clientData.resetTime) {
            clientData = {
                count: 1,
                resetTime: now + windowMs
            };
            hits.set(ip, clientData);
            return next();
        }

        clientData.count++;
        if (clientData.count > maxRequests) {
            const retryAfterSec = Math.ceil((clientData.resetTime - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            return res.status(429).json({
                error: message,
                retryAfter: retryAfterSec
            });
        }

        next();
    };
}

// Pre-configured auth rate limiter
const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 30,           // 30 attempts per 15 minutes
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
});

module.exports = {
    createRateLimiter,
    authRateLimiter
};
