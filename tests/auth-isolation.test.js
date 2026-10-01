/**
 * LifeSync Multi-User Data Isolation Test
 * -------------------------------------------------------------
 * Verifies that:
 * - User A cannot access User B's tasks, events, budget, or wellness
 * - Cross-user updates/deletions are strictly blocked (404/unauthorized)
 * - Dashboard metrics reflect only the authenticated user's own data
 */

const http = require('http');
const { app, startServer } = require('../server');

let serverInstance;
let baseUrl;

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const reqOptions = {
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        if (options.body) {
            reqOptions.headers['Content-Type'] = 'application/json';
        }

        const req = http.request(url, reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    } else {
        console.log(`✓ PASS: ${message}`);
    }
}

async function runIsolationTests() {
    console.log('--- Starting LifeSync Multi-User Tenant Isolation Tests ---\n');

    serverInstance = await startServer(0);
    const port = serverInstance.address().port;
    baseUrl = `http://localhost:${port}`;

    try {
        const timestamp = Date.now();
        const userAEmail = `alice_${timestamp}@lifesync.edu`;
        const userBEmail = `bob_${timestamp}@lifesync.edu`;

        // 1. Register User A (Alice)
        const regA = await request('/api/auth/register', {
            method: 'POST',
            body: { name: 'Alice Walker', email: userAEmail, password: 'Password123!' }
        });
        assert(regA.status === 201, 'User A (Alice) registered');
        const tokenA = regA.body.token;

        // 2. Register User B (Bob)
        const regB = await request('/api/auth/register', {
            method: 'POST',
            body: { name: 'Bob Roberts', email: userBEmail, password: 'Password123!' }
        });
        assert(regB.status === 201, 'User B (Bob) registered');
        const tokenB = regB.body.token;

        // 3. User A creates resources in all modules
        console.log('\nCreating resources under User A:');
        const taskA = await request('/api/tasks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenA}` },
            body: { title: "Alice's Private Task", priority: 'High', category: 'Study' }
        });
        assert(taskA.status === 201, "Created Alice's task");
        const taskAId = taskA.body.id;

        const eventA = await request('/api/events', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenA}` },
            body: { title: "Alice's Secret Exam", date: '2026-10-15', time: '10:00', event_type: 'Exam' }
        });
        assert(eventA.status === 201, "Created Alice's event");
        const eventAId = eventA.body.id;

        const txA = await request('/api/budget', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenA}` },
            body: { type: 'income', amount: 12000, category: 'Allowance', description: "Alice's Scholarship" }
        });
        assert(txA.status === 201, "Created Alice's transaction");
        const txAId = txA.body.id;

        const wellA = await request('/api/wellness', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenA}` },
            body: { mood: 'great', note: "Alice's Personal Journal Entry" }
        });
        assert(wellA.status === 201, "Created Alice's wellness check-in");
        const wellAId = wellA.body.id;

        // 4. Verify User B cannot view User A's data
        console.log("\nVerifying User B cannot view User A's data:");
        const bTasks = await request('/api/tasks', { headers: { Authorization: `Bearer ${tokenB}` } });
        assert(!bTasks.body.some(t => t.id === taskAId), "User B cannot see Alice's task in task list");

        const bTaskSingle = await request(`/api/tasks/${taskAId}`, { headers: { Authorization: `Bearer ${tokenB}` } });
        assert(bTaskSingle.status === 404, "User B receives 404 attempting to GET Alice's task");

        const bEvents = await request('/api/events', { headers: { Authorization: `Bearer ${tokenB}` } });
        assert(!bEvents.body.some(e => e.id === eventAId), "User B cannot see Alice's event in event list");

        const bTx = await request('/api/budget', { headers: { Authorization: `Bearer ${tokenB}` } });
        assert(!bTx.body.some(t => t.id === txAId), "User B cannot see Alice's transaction");

        const bWell = await request('/api/wellness', { headers: { Authorization: `Bearer ${tokenB}` } });
        assert(!bWell.body.some(w => w.id === wellAId), "User B cannot see Alice's wellness record");

        // 5. Verify User B cannot modify or delete User A's data
        console.log("\nVerifying User B cannot modify or delete User A's data:");
        const bUpdateTask = await request(`/api/tasks/${taskAId}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${tokenB}` },
            body: { title: 'Hacked by Bob' }
        });
        assert(bUpdateTask.status === 404, "User B cannot modify Alice's task (404)");

        const bDeleteTask = await request(`/api/tasks/${taskAId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokenB}` }
        });
        assert(bDeleteTask.status === 404, "User B cannot delete Alice's task (404)");

        const bDeleteEvent = await request(`/api/events/${eventAId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokenB}` }
        });
        assert(bDeleteEvent.status === 404, "User B cannot delete Alice's event (404)");

        const bDeleteTx = await request(`/api/budget/${txAId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokenB}` }
        });
        assert(bDeleteTx.status === 404, "User B cannot delete Alice's budget transaction (404)");

        const bDeleteWell = await request(`/api/wellness/${wellAId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokenB}` }
        });
        assert(bDeleteWell.status === 404, "User B cannot delete Alice's wellness record (404)");

        // 6. Verify User B's dashboard summary is clean and isolated
        const bDash = await request('/api/dashboard', { headers: { Authorization: `Bearer ${tokenB}` } });
        assert(bDash.body.pendingTasks === 0, "User B's dashboard shows 0 pending tasks");
        assert(bDash.body.budget.income === 0, "User B's dashboard shows ₹0 income");
        assert(bDash.body.latestMood === null, "User B's dashboard shows null mood");

        console.log('\n🎉 ALL MULTI-USER TENANT ISOLATION TESTS PASSED! 🎉\n');
    } finally {
        if (serverInstance) {
            serverInstance.close();
        }
    }
}

if (require.main === module) {
    runIsolationTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n❌ Isolation Test Failed:', err);
            process.exit(1);
        });
}

module.exports = { runIsolationTests };
