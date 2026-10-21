/**
 * Automated Test Suite for LifeSync Smart Notifications & Pomodoro Focus Timer
 * --------------------------------------------------------------------------
 * Tests:
 * 1. Live database healthcheck endpoint (GET /api/health)
 * 2. Smart Notification Triggers, Deduplication & CRUD
 * 3. Quiet Hours & Notification Preferences
 * 4. Multi-tenant isolation for notifications
 * 5. Pomodoro Session Recording & Daily Stats Calculation
 * 6. XP Point awards on focus session completion
 * 7. Pomodoro Timer Settings & Multi-tenant isolation
 */

const http = require('http');
const db = require('../config/db');
const { app, startServer } = require('../server');

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(url, { method, headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, body: parsed });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    } else {
        console.log(`✓ PASS: ${message}`);
    }
}

async function runTests() {
    console.log('\n--- Starting Notifications & Pomodoro Test Suite ---\n');

    server = await startServer(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    try {
        // ==========================================
        // 1. Healthcheck with Live DB Ping
        // ==========================================
        console.log('1. Testing Live Health Check Endpoint:');
        const healthRes = await request('GET', '/api/health');
        assert(healthRes.status === 200, 'GET /api/health returns 200 OK');
        assert(healthRes.body.status === 'ok', 'Health status is ok');
        assert(healthRes.body.database && healthRes.body.database.status === 'connected', 'Live database ping verified');
        assert(typeof healthRes.body.database.latencyMs === 'number', 'Latency measurement present');

        // ==========================================
        // 2. Authentication for Test Users
        // ==========================================
        console.log('\n2. Setting up Authenticated Test Users:');
        const userAEmail = `notif_a_${Date.now()}@lifesync.edu`;
        const regARes = await request('POST', '/api/auth/register', {
            name: 'Pomo User A',
            email: userAEmail,
            password: 'Password123!'
        });
        assert(regARes.status === 201, 'User A registered');
        const tokenA = regARes.body.token;

        const userBEmail = `notif_b_${Date.now()}@lifesync.edu`;
        const regBRes = await request('POST', '/api/auth/register', {
            name: 'Pomo User B',
            email: userBEmail,
            password: 'Password123!'
        });
        assert(regBRes.status === 201, 'User B registered');
        const tokenB = regBRes.body.token;

        // ==========================================
        // 3. Smart Notifications & Triggers
        // ==========================================
        console.log('\n3. Testing Smart Notification Triggers & Deduplication:');

        // Insert an overdue task directly into the database for User A (simulating historical/overdue task)
        await db.query(
            `INSERT INTO tasks (user_id, title, category, deadline, priority, status)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [regARes.body.user.id, 'Critical History Research Paper', 'Study', '2026-01-01', 'High', 'Pending']
        );

        // Create an exam event for User A in 24 hours
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        await request('POST', '/api/events', {
            title: 'Computer Architecture Midterm Exam',
            date: tomorrowStr,
            time: '10:00',
            event_type: 'Exam'
        }, tokenA);

        // Trigger smart notification evaluation
        const triggerRes = await request('POST', '/api/notifications/check-triggers', {}, tokenA);
        assert(triggerRes.status === 200, 'POST /api/notifications/check-triggers returned 200');
        assert(triggerRes.body.newAlertsGenerated >= 2, 'Generated overdue task and upcoming exam alerts');

        // Verify Deduplication (Running evaluation again on same day should not generate duplicates)
        const secondTriggerRes = await request('POST', '/api/notifications/check-triggers', {}, tokenA);
        assert(secondTriggerRes.body.newAlertsGenerated === 0, 'Deduplication verified: zero duplicate alerts generated on second scan');

        // Test GET /api/notifications
        const getNotifsRes = await request('GET', '/api/notifications', null, tokenA);
        assert(getNotifsRes.status === 200, 'GET /api/notifications returned 200');
        assert(getNotifsRes.body.notifications.length >= 2, 'Notifications list returned for User A');
        assert(getNotifsRes.body.unreadCount >= 2, 'Unread count reflects generated alerts');

        // Test Unread Count API
        const unreadCountRes = await request('GET', '/api/notifications/unread-count', null, tokenA);
        assert(unreadCountRes.status === 200, 'GET /api/notifications/unread-count returned 200');
        assert(unreadCountRes.body.unreadCount === getNotifsRes.body.unreadCount, 'Unread count is accurate');

        // Test Mark Single Read
        const firstNotifId = getNotifsRes.body.notifications[0].id;
        const markReadRes = await request('PUT', `/api/notifications/${firstNotifId}/read`, {}, tokenA);
        assert(markReadRes.status === 200, 'PUT /api/notifications/:id/read returned 200');

        // Test Mark All Read
        const markAllRes = await request('PUT', '/api/notifications/mark-all-read', {}, tokenA);
        assert(markAllRes.status === 200, 'PUT /api/notifications/mark-all-read returned 200');
        const afterAllReadRes = await request('GET', '/api/notifications/unread-count', null, tokenA);
        assert(afterAllReadRes.body.unreadCount === 0, 'Unread count is now 0');

        // Test Notification Preferences
        const getPrefsRes = await request('GET', '/api/notifications/preferences', null, tokenA);
        assert(getPrefsRes.status === 200, 'GET /api/notifications/preferences returned 200');
        assert(getPrefsRes.body.preferences.quiet_hours_start === '22:00', 'Default quiet hours start is 22:00');

        const updatePrefsRes = await request('PUT', '/api/notifications/preferences', {
            quiet_hours_start: '23:00',
            quiet_hours_end: '06:00',
            browser_alerts: true
        }, tokenA);
        assert(updatePrefsRes.status === 200, 'PUT /api/notifications/preferences returned 200');
        assert(updatePrefsRes.body.preferences.quiet_hours_start === '23:00', 'Updated quiet hours start to 23:00');

        // Multi-tenant isolation: User B should NOT see User A's notifications
        const userBNotifsRes = await request('GET', '/api/notifications', null, tokenB);
        assert(userBNotifsRes.body.notifications.length === 0, 'User B has isolated clean notification box');

        // User B cannot mark User A's notification as read
        const unauthorizedMarkRes = await request('PUT', `/api/notifications/${firstNotifId}/read`, {}, tokenB);
        assert(unauthorizedMarkRes.status === 404, 'User B cannot mark User A notification as read (404)');

        // ==========================================
        // 4. Pomodoro Focus Timer
        // ==========================================
        console.log('\n4. Testing Pomodoro Focus Timer API:');

        // Initial Stats (should be 0)
        const initialStatsRes = await request('GET', '/api/pomodoro/stats', null, tokenA);
        assert(initialStatsRes.status === 200, 'GET /api/pomodoro/stats returned 200');
        assert(initialStatsRes.body.today.focusMinutes === 0, 'Initial today focus minutes is 0');
        assert(initialStatsRes.body.today.sessionsCount === 0, 'Initial today sessions count is 0');

        // Record a 25-minute focus session
        const pomoRecordRes = await request('POST', '/api/pomodoro/session', {
            mode: 'focus',
            durationMinutes: 25,
            startedAt: new Date(Date.now() - 25 * 60000).toISOString(),
            completed: true
        }, tokenA);
        assert(pomoRecordRes.status === 201, 'POST /api/pomodoro/session recorded focus session (201)');
        assert(pomoRecordRes.body.xpAwarded >= 25, 'XP awarded for completing focus session');

        // Record a 5-minute short break session
        const breakRecordRes = await request('POST', '/api/pomodoro/session', {
            mode: 'short_break',
            durationMinutes: 5,
            completed: true
        }, tokenA);
        assert(breakRecordRes.status === 201, 'Short break recorded successfully');
        assert(breakRecordRes.body.xpAwarded === 0, 'No XP awarded for break session');

        // Verify updated stats
        const updatedStatsRes = await request('GET', '/api/pomodoro/stats', null, tokenA);
        assert(updatedStatsRes.body.today.focusMinutes === 25, 'Today focus minutes accurately updated to 25');
        assert(updatedStatsRes.body.today.sessionsCount === 1, 'Today focus sessions count is 1');
        assert(updatedStatsRes.body.recentSessions.length === 2, 'Both focus and break sessions appear in history');

        // Test Pomodoro Settings
        const settingsRes = await request('GET', '/api/pomodoro/settings', null, tokenA);
        assert(settingsRes.status === 200, 'GET /api/pomodoro/settings returned 200');
        assert(settingsRes.body.settings.focus_duration === 25, 'Default focus duration is 25m');

        const updateSettingsRes = await request('PUT', '/api/pomodoro/settings', {
            focusDuration: 30,
            shortBreak: 6,
            longBreak: 20
        }, tokenA);
        assert(updateSettingsRes.status === 200, 'PUT /api/pomodoro/settings updated custom durations');
        assert(updateSettingsRes.body.settings.focus_duration === 30, 'Focus duration updated to 30m');

        // Multi-tenant isolation: User B stats must remain 0
        const userBPomoStatsRes = await request('GET', '/api/pomodoro/stats', null, tokenB);
        assert(userBPomoStatsRes.body.today.focusMinutes === 0, 'User B has isolated focus minutes (0)');
        assert(userBPomoStatsRes.body.today.sessionsCount === 0, 'User B has isolated sessions count (0)');
        assert(userBPomoStatsRes.body.recentSessions.length === 0, 'User B has empty session history');

        // ==========================================
        // 8. Web Push RFC 8291/8292 Endpoint Registration & VAPID Handshake
        // ==========================================
        console.log('\n8. Testing Web Push (Closed-Tab Alerts) Endpoints:');
        const vapidRes = await request('GET', '/api/notifications/vapid-public-key', null, tokenA);
        assert(vapidRes.status === 200, 'GET /api/notifications/vapid-public-key returns 200');
        assert(typeof vapidRes.body.publicKey === 'string' && vapidRes.body.publicKey.length > 20, 'VAPID public key present and valid');

        const testSubA = {
            endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/lifesync-test-user-a-' + Date.now(),
            keys: {
                p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_76hkx6PJsCY_kPQ2GcENYXAsPy058g54TYfyA',
                auth: 'tBHItDa ق-auth-key'
            }
        };

        const subResA = await request('POST', '/api/notifications/push-subscribe', { subscription: testSubA }, tokenA);
        assert(subResA.status === 201, 'POST /api/notifications/push-subscribe returns 201');
        assert(subResA.body.success === true && subResA.body.created === true, 'Push subscription created in database');

        // Re-subscribe same endpoint updates record
        const reSubResA = await request('POST', '/api/notifications/push-subscribe', { subscription: testSubA }, tokenA);
        assert(reSubResA.status === 201, 'Re-subscribing returns 201');
        assert(reSubResA.body.updated === true, 'Duplicate endpoint updates cleanly');

        // Multi-tenant check: User B has no subscriptions registered under User A's endpoint
        const subCountUserB = await db.query('SELECT count(*) as count FROM push_subscriptions WHERE user_id = $1', [regBRes.body.user.id]);
        assert(Number(subCountUserB.rows[0].count) === 0, 'User B has 0 push subscriptions (multi-tenant isolation)');

        // Test push-unsubscribe
        const unsubResA = await request('POST', '/api/notifications/push-unsubscribe', { endpoint: testSubA.endpoint }, tokenA);
        assert(unsubResA.status === 200, 'POST /api/notifications/push-unsubscribe returns 200');
        const subCheckA = await db.query('SELECT count(*) as count FROM push_subscriptions WHERE endpoint = $1', [testSubA.endpoint]);
        assert(Number(subCheckA.rows[0].count) === 0, 'Subscription successfully removed from database');

        console.log('\n🎉 ALL SMART NOTIFICATIONS & POMODORO TESTS PASSED! 🎉\n');
    } finally {
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('❌ Test execution error:', err);
            process.exit(1);
        });
}

module.exports = { runTests };
