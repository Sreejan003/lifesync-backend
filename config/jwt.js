/**
 * LifeSync JWT Configuration & Cryptographic Key Management
 * (backend/config/jwt.js)
 * -------------------------------------------------------------
 * Centralizes JWT secret resolution, enforces production secret
 * requirements, and isolates session vs. password-reset secrets.
 */

const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';
const envJwtSecret = process.env.JWT_SECRET;
const DEV_FALLBACK_SECRET = 'lifesync_super_secret_jwt_key_2026_student_dev';

if (isProduction && (!envJwtSecret || envJwtSecret === DEV_FALLBACK_SECRET)) {
    throw new Error(
        'FATAL SECURITY CONFIGURATION ERROR: process.env.JWT_SECRET is required in production and must NOT use the hardcoded development default.'
    );
}

const JWT_SECRET = envJwtSecret || DEV_FALLBACK_SECRET;
const JWT_EXPIRES_IN = '7d';

// Cryptographic isolation: Dedicated secret for password reset tokens
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || `${JWT_SECRET}_reset_token_secret_isolation`;
const JWT_RESET_EXPIRES_IN = '1h';

/**
 * Generate cryptographically signed JWT user session token
 */
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Generate isolated single-use password reset token
 */
function generatePasswordResetToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            type: 'pwd_reset'
        },
        JWT_RESET_SECRET,
        { expiresIn: JWT_RESET_EXPIRES_IN }
    );
}

/**
 * Verify password reset token using the isolated reset secret
 */
function verifyPasswordResetToken(token) {
    return jwt.verify(token, JWT_RESET_SECRET);
}

module.exports = {
    JWT_SECRET,
    JWT_RESET_SECRET,
    JWT_EXPIRES_IN,
    JWT_RESET_EXPIRES_IN,
    generateToken,
    generatePasswordResetToken,
    verifyPasswordResetToken
};
