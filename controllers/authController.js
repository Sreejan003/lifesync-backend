const emailService = require('../services/emailService');
/**
 * LifeSync Auth Controller (backend/controllers/authController.js)
 * -------------------------------------------------------------
 * Handles user registration with bcrypt password hashing,
 * credential login, JWT token issuance, and current user retrieval.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
    JWT_SECRET,
    generateToken,
    generatePasswordResetToken,
    verifyPasswordResetToken
} = require('../config/jwt');

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required.' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'Email is required.' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const trimmedName = name.trim();

        // Check for existing email
        const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const avatarLetter = trimmedName.charAt(0).toUpperCase() || 'S';

        // Insert new user, profile, and default budget atomically in a transaction
        const newUser = await db.transaction(async (tx) => {
            const result = await tx.query(
                `INSERT INTO users (name, email, password, avatar_letter)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, name, email, avatar_letter, created_at`,
                [trimmedName, normalizedEmail, hashedPassword, avatarLetter]
            );

            const user = result.rows[0];

            await tx.query(
                `INSERT INTO profiles (user_id, name, email) VALUES ($1, $2, $3)`,
                [user.id, user.name, user.email]
            );
            await tx.query(
                `INSERT INTO budget_settings (user_id) VALUES ($1)`,
                [user.id]
            );

            return user;
        });

        const token = generateToken(newUser);

        return res.status(201).json({
            message: 'User registered successfully.',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                avatarLetter: newUser.avatar_letter || avatarLetter,
                createdAt: newUser.created_at
            },
            token
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Look up user
        const result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = result.rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = generateToken(user);

        return res.status(200).json({
            message: 'Logged in successfully.',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarLetter: user.avatar_letter || user.name.charAt(0).toUpperCase(),
                createdAt: user.created_at
            },
            token
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
    try {
        const result = await db.query(
            'SELECT id, name, email, avatar_letter, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = result.rows[0];
        return res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarLetter: user.avatar_letter || user.name.charAt(0).toUpperCase(),
            createdAt: user.created_at
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/google (Google OAuth / Simulation Endpoint)
 */
async function googleAuth(req, res, next) {
    try {
        const { credential, idToken, accessToken } = req.body;
        const googleToken = credential || idToken;

        if (!googleToken && !accessToken) {
            return res.status(401).json({
                error: 'Authentication failed: A valid Google credential or access token is required.'
            });
        }

        let verifiedEmail = null;
        let verifiedName = null;
        let verifiedPicture = null;

        // 1. Verify Google ID Token / GIS credential with Google tokeninfo
        if (googleToken) {
            try {
                const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleToken)}`);
                if (!googleRes.ok) {
                    return res.status(401).json({ error: 'Invalid Google OAuth ID token.' });
                }
                const tokenInfo = await googleRes.json();
                
                // Verify audience if configured
                const expectedClientId = process.env.GOOGLE_CLIENT_ID;
                if (expectedClientId && tokenInfo.aud && tokenInfo.aud !== expectedClientId) {
                    return res.status(401).json({ error: 'Google OAuth token audience mismatch.' });
                }
                
                if (!tokenInfo.email || tokenInfo.email_verified === 'false' || tokenInfo.email_verified === false) {
                    return res.status(401).json({ error: 'Unverified Google email address.' });
                }

                verifiedEmail = tokenInfo.email.trim().toLowerCase();
                verifiedName = tokenInfo.name ? tokenInfo.name.trim() : verifiedEmail.split('@')[0];
                verifiedPicture = tokenInfo.picture || null;
            } catch (err) {
                console.error('Google ID token verification failed:', err.message);
                return res.status(401).json({ error: 'Failed to verify Google token with Google servers.' });
            }
        } else if (accessToken) {
            // 2. Verify Google Access Token with Google userinfo
            try {
                const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (!userinfoRes.ok) {
                    return res.status(401).json({ error: 'Invalid Google access token.' });
                }
                const profile = await userinfoRes.json();
                if (!profile.email || profile.email_verified === false) {
                    return res.status(401).json({ error: 'Unverified Google email address.' });
                }

                verifiedEmail = profile.email.trim().toLowerCase();
                verifiedName = profile.name ? profile.name.trim() : verifiedEmail.split('@')[0];
                verifiedPicture = profile.picture || null;
            } catch (err) {
                console.error('Google userinfo verification failed:', err.message);
                return res.status(401).json({ error: 'Failed to verify Google access token with Google servers.' });
            }
        }

        if (!verifiedEmail) {
            return res.status(401).json({ error: 'No verified email returned from Google identity service.' });
        }

        const avatarLetter = (verifiedName ? verifiedName.charAt(0) : 'G').toUpperCase();

        let result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [verifiedEmail]);
        let user;
        let isNewUser = false;

        if (result.rows.length === 0) {
            isNewUser = true;
            // Create user atomically with high-entropy cryptographic password
            const tempPass = await bcrypt.hash('GoogleOAuth_' + Math.random().toString(36) + Date.now(), 10);
            user = await db.transaction(async (tx) => {
                const insertResult = await tx.query(
                    `INSERT INTO users (name, email, password, avatar_letter)
                     VALUES ($1, $2, $3, $4)
                     RETURNING id, name, email, avatar_letter, created_at`,
                    [verifiedName, verifiedEmail, tempPass, avatarLetter]
                );
                const created = insertResult.rows[0];
                await tx.query('INSERT INTO profiles (user_id, name, email) VALUES ($1, $2, $3)', [created.id, created.name, created.email]);
                await tx.query('INSERT INTO budget_settings (user_id) VALUES ($1)', [created.id]);
                return created;
            });
        } else {
            user = result.rows[0];
            if (verifiedName && user.name !== verifiedName) {
                try {
                    await db.query('UPDATE users SET name = $1, avatar_letter = $2 WHERE id = $3', [verifiedName, avatarLetter, user.id]);
                    user.name = verifiedName;
                    user.avatar_letter = avatarLetter;
                } catch (e) {}
            }
        }

        const token = generateToken(user);
        return res.status(200).json({
            message: 'Google login successful.',
            isNewUser: isNewUser,
            needsProfileSetup: isNewUser,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarLetter: user.avatar_letter || avatarLetter,
                picture: verifiedPicture,
                isGoogleUser: true,
                isNewUser: isNewUser,
                needsProfileSetup: isNewUser
            },
            token
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email address is required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const result = await db.query('SELECT id, name, email FROM users WHERE LOWER(email) = $1', [normalizedEmail]);

        // Security best practice: Always return 200 with uniform message to prevent user enumeration
        if (result.rows.length === 0) {
            return res.status(200).json({
                message: 'If an account matches that email, reset instructions have been dispatched.'
            });
        }

        const user = result.rows[0];
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const clientUrl = process.env.CLIENT_URL || (host ? `${proto}://${host}` : 'http://localhost:5000');

        // Isolated password reset token
        const resetToken = generatePasswordResetToken(user);

        const resetUrl = `${clientUrl}/auth.html?token=${resetToken}&tab=reset`;

        await emailService.sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetUrl
        });

        // Response does not leak user's email or identity confirmation
        return res.status(200).json({
            message: 'If an account matches that email, reset instructions have been dispatched.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res, next) {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        let decoded;
        try {
            decoded = verifyPasswordResetToken(token);
        } catch (jwtErr) {
            return res.status(401).json({ error: 'Invalid or expired password reset link. Please request a new one.' });
        }

        if (decoded.type !== 'pwd_reset' || !decoded.userId) {
            return res.status(401).json({ error: 'Invalid reset token payload.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, decoded.userId]);

        return res.status(200).json({
            message: 'Password has been updated successfully. You can now sign in with your new password.'
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    register,
    login,
    getMe,
    googleAuth,
    forgotPassword,
    resetPassword
};
