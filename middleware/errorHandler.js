/**
 * LifeSync Global Error Handling Middleware
 * -------------------------------------------------------------
 * Provides consistent JSON responses for unexpected server errors.
 * Safeguards sensitive environment and database details from clients.
 */

function errorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.url}:`, err.message || err);

    const status = err.status || err.statusCode || 500;
    const message = (status === 500 && process.env.NODE_ENV === 'production')
        ? 'An internal server error occurred.'
        : (err.message || 'Internal server error');

    res.status(status).json({
        error: message
    });
}

module.exports = errorHandler;
