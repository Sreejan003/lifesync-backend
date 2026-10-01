/**
 * LifeSync Mailjet Email Service (backend/services/emailService.js)
 * -------------------------------------------------------------
 * Sends transactional emails (e.g. password resets, security notifications)
 * using the Mailjet Send API v3.1.
 */

const MAILJET_API_URL = 'https://api.mailjet.com/v3.1/send';

/**
 * Send an email via Mailjet Send API v3.1
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} [options.toName] - Recipient name
 * @param {string} options.subject - Email subject line
 * @param {string} options.text - Plain text version
 * @param {string} options.html - HTML version
 */
async function sendMail({ to, toName, subject, text, html }) {
    const apiKey = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    const senderEmail = process.env.MAILJET_SENDER_EMAIL;
    const senderName = process.env.MAILJET_SENDER_NAME || 'LifeSync';

    // If Secret Key or Sender Email is not configured yet, fallback to console preview
    if (!apiKey || !secretKey || !senderEmail) {
        console.log('----------------------------------------------------');
        console.log('📧 [Mailjet Notice: Incomplete Credentials in .env]');
        console.log(`   To: ${toName ? `${toName} <${to}>` : to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Text Content:\n${text}`);
        console.log('----------------------------------------------------');
        return {
            success: true,
            simulated: true,
            message: 'Email preview logged to server console (waiting for Secret Key & Sender Email in .env).'
        };
    }

    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

    const payload = {
        Messages: [
            {
                From: {
                    Email: senderEmail,
                    Name: senderName
                },
                To: [
                    {
                        Email: to,
                        Name: toName || to.split('@')[0]
                    }
                ],
                Subject: subject,
                TextPart: text,
                HTMLPart: html
            }
        ]
    };

    try {
        const response = await fetch(MAILJET_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Mailjet API Error:', data);
            throw new Error(data.ErrorMessage || (data.Messages && data.Messages[0]?.Errors?.[0]?.ErrorMessage) || 'Mailjet delivery failed.');
        }

        console.log(`✅ Mailjet email dispatched successfully to: ${to}`);
        return { success: true, data };
    } catch (err) {
        console.error('❌ Error sending email via Mailjet:', err.message);
        throw err;
    }
}

/**
 * Send password reset email with secure token link
 */
async function sendPasswordResetEmail({ to, name, resetUrl }) {
    const subject = 'LifeSync Password Reset Request';
    const text = `Hi ${name || 'there'},\n\nWe received a request to reset your LifeSync password.\nClick the link below to set a new password:\n${resetUrl}\n\nThis link will expire in 60 minutes. If you did not request this, you can safely ignore this email.\n\nBest regards,\nThe LifeSync Team`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f3fb; margin: 0; padding: 30px 10px; }
            .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(108, 92, 231, 0.1); border: 1px solid #e9e8f4; }
            .header { background: linear-gradient(135deg, #6C5CE7, #8e78ff); padding: 32px 24px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
            .content { padding: 32px 28px; color: #374151; font-size: 14.5px; line-height: 1.6; }
            .button-wrap { text-align: center; margin: 28px 0; }
            .btn { display: inline-block; background: #6C5CE7; color: #ffffff !important; padding: 13px 28px; font-size: 14.5px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 6px 20px rgba(108, 92, 231, 0.35); }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; background: #fafafa; border-top: 1px solid #f0f0f0; }
            .note { font-size: 12.5px; color: #6b7280; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>LifeSync</h1>
            </div>
            <div class="content">
                <p>Hi <strong>${name || 'Student'}</strong>,</p>
                <p>We received a request to reset your password for your <strong>LifeSync</strong> account. Click the button below to choose a new password:</p>
                <div class="button-wrap">
                    <a href="${resetUrl}" class="btn" target="_blank">Reset My Password</a>
                </div>
                <p class="note"><strong>Security notice:</strong> This link is single-use and will automatically expire in <strong>60 minutes</strong>. If you did not request this password reset, please ignore this email or review your account settings.</p>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} LifeSync Student Productivity System. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    `;

    return sendMail({
        to,
        toName: name,
        subject,
        text,
        html
    });
}

module.exports = {
    sendMail,
    sendPasswordResetEmail
};
