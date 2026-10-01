/**
 * LifeSync API Integration Test Suite
 * -------------------------------------------------------------
 * Verifies all endpoints, authentication, CRUD operations,
 * rule-based smart prioritization, budget calculations, and dashboard summary.
 */

const http = require('http');
const { app, startServer } = require('../server');
const db = require('../config/db');

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

async function runTests() {
    console.log('--- Starting LifeSync Backend API Test Suite ---\n');

    // 0. Start test server on random port
    serverInstance = await startServer(0);
    const port = serverInstance.address().port;
    baseUrl = `http://localhost:${port}`;

    let userToken;
    let userId;
    let taskId;
    let eventId;
    let txIncomeId;
    let txExpenseId;
    let wellnessId;

    try {
        // 1. Health Check
        console.log('1. Testing Health Endpoint:');
        const healthRes = await request('/api/health');
        assert(healthRes.status === 200, 'GET /api/health returned 200');
        assert(healthRes.body.status === 'ok', 'Health status is "ok"');

        // 2. Authentication
        console.log('\n2. Testing Authentication:');
        const uniqueEmail = `student_${Date.now()}@lifesync.edu`;

        // Missing fields
        const badReg = await request('/api/auth/register', {
            method: 'POST',
            body: { email: uniqueEmail }
        });
        assert(badReg.status === 400, 'Registration rejects missing fields with 400');

        // Successful registration
        const regRes = await request('/api/auth/register', {
            method: 'POST',
            body: {
                name: 'Alex Morgan',
                email: uniqueEmail,
                password: 'Password123!'
            }
        });
        assert(regRes.status === 201, 'POST /api/auth/register returned 201 Created');
        assert(regRes.body.token, 'Registration issued valid JWT token');
        assert(regRes.body.user && regRes.body.user.name === 'Alex Morgan', 'User profile returned');
        userToken = regRes.body.token;
        userId = regRes.body.user.id;

        // Duplicate email rejection
        const dupRes = await request('/api/auth/register', {
            method: 'POST',
            body: {
                name: 'Alex Duplicate',
                email: uniqueEmail,
                password: 'Password123!'
            }
        });
        assert(dupRes.status === 400, 'Duplicate email registration rejected with 400');

        // Login
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            body: {
                email: uniqueEmail,
                password: 'Password123!'
            }
        });
        assert(loginRes.status === 200, 'POST /api/auth/login returned 200');
        assert(loginRes.body.token, 'Login returned valid JWT token');

        // Bad password login
        const badLogin = await request('/api/auth/login', {
            method: 'POST',
            body: {
                email: uniqueEmail,
                password: 'WrongPassword'
            }
        });
        assert(badLogin.status === 401, 'Invalid password rejected with 401');

        // GET /api/auth/me
        const meRes = await request('/api/auth/me', {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        assert(meRes.status === 200, 'GET /api/auth/me returned 200');
        assert(meRes.body.email === uniqueEmail, 'Correct user identity retrieved');

        // Unauthorized access without token
        const noTokenRes = await request('/api/auth/me');
        assert(noTokenRes.status === 401, 'Protected route rejects unauthenticated request with 401');

        // 3. To-Do List CRUD
        console.log('\n3. Testing Tasks CRUD & Smart Organizer:');
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        const createTaskRes = await request('/api/tasks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${userToken}` },
            body: {
                title: 'Operating Systems Lab Assignment',
                category: 'Assignment',
                deadline: tomorrow,
                priority: 'High',
                description: 'Implement CPU scheduling simulation'
            }
        });
        assert(createTaskRes.status === 201, 'POST /api/tasks created new task (201)');
        assert(createTaskRes.body.id, 'Task returned generated ID');
        taskId = createTaskRes.body.id;

        const getTasksRes = await request('/api/tasks', {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        assert(getTasksRes.status === 200, 'GET /api/tasks returned 200');
        assert(Array.isArray(getTasksRes.body) && getTasksRes.body.length >= 1, 'Tasks array returned');

        // Rule-based Smart Task Organizer
        const smartRes = await request('/api/tasks/prioritized', {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        assert(smartRes.status === 200, 'GET /api/tasks/prioritized returned 200');
        assert(Array.isArray(smartRes.body) && smartRes.body.length >= 1, 'Smart tasks array returned');
        const topTask = smartRes.body[0];
        assert(topTask.urgencyScore > 0, 'Top task has positive urgency score');
        assert(topTask.reason, `Top task contains explainable reason: "${topTask.reason}"`);

        // Update task status
        const updateTaskRes = await request(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${userToken}` },
            body: { status: 'Completed' }
        });
        assert(updateTaskRes.status === 200, 'PUT /api/tasks/:id updated status (200)');
        assert(updateTaskRes.body.status === 'Completed', 'Task marked Completed');

        // 4. Calendar Events CRUD
        console.log('\n4. Testing Calendar Events CRUD:');
        const createEventRes = await request('/api/events', {
            method: 'POST',
            headers: { Authorization: `Bearer ${userToken}` },
            body: {
                title: 'Software Engineering Midterm Exam',
                date: tomorrow,
                time: '10:00',
                event_type: 'Exam',
                reminder: true
            }
        });
        assert(createEventRes.status === 201, 'POST /api/events created new event (201)');
        eventId = createEventRes.body.id;

        const getEventsRes = await request('/api/events', {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        assert(getEventsRes.status === 200, 'GET /api/events returned 200');
        assert(getEventsRes.body.length >= 1, 'Events list contains created event');

        // 5. Budget Planner CRUD & Summary
        console.log('\n5. Testing Budget Planner & Calculations:');
        const incomeRes = await request('/api/budget', {
            method: 'POST',
            headers: { Authorization: `Bearer ${userToken}` },
            body: {
                type: 'income',
                category: 'Allowance',
                amount: 8000,
                description: 'Monthly student allowance'
            }
        });
        assert(incomeRes.status === 201, 'POST /api/budget recorded income (201)');
        txIncomeId = incomeRes.body.id;

        const expenseRes = await request('/api/budget', {
            method: 'POST',
            headers: { Authorization: `Bearer ${userToken}` },
            body: {
                type: 'expense',
                category: 'Food',
                amount: 5200,
                description: 'Cafeteria and groceries'
            }
        });
        assert(expenseRes.status === 201, 'POST /api/budget recorded expense (201)');
        txExpenseId = expenseRes.body.id;

        const budgetSummaryRes = await request('/api/budget/summary', {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        assert(budgetSummaryRes.status === 200, 'GET /api/budget/summary returned 200');
        assert(budgetSummaryRes.body.income === 8000, `Income calculated accurately: ₹${budgetSummaryRes.body.income}`);
        assert(budgetSummaryRes.body.expenses === 5200, `Expenses calculated accurately: ₹${budgetSummaryRes.body.expenses}`);
        assert(budgetSummaryRes.body.remaining === 2800, `Remaining balance calculated accurately: ₹${budgetSummaryRes.body.remaining}`);
        assert(budgetSummaryRes.body.categoryExpenses.Food === 5200, 'Category spending breakdown computed accurately');

        // 6. Mental Wellness CRUD & Summary
        console.log('\n6. Testing Mental Wellness Check-in & Summary:');
        const wellnessRes = await request('/api/wellness', {
            method: 'POST',
            headers: { Authorization: `Bearer ${userToken}` },
            body: {
                mood: 'great',
                stress: 1,
                energy: 5,
                note: 'Studied for midterm and feeling ready!'
            }
        });
        assert(wellnessRes.status === 201, 'POST /api/wellness recorded check-in (201)');
        wellnessId = wellnessRes.body.id;

        const wellnessSummaryRes = await request('/api/wellness/summary', {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        assert(wellnessSummaryRes.status === 200, 'GET /api/wellness/summary returned 200');
        assert(wellnessSummaryRes.body.streak >= 1, `Wellness streak calculated: ${wellnessSummaryRes.body.streak} day(s)`);
        assert(wellnessSummaryRes.body.latestMood === 'great', 'Latest mood recorded accurately');

        // 7. Dashboard Live Summary
        console.log('\n7. Testing Dashboard Real-time Summary:');
        const dashRes = await request('/api/dashboard', {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        assert(dashRes.status === 200, 'GET /api/dashboard returned 200');
        assert(dashRes.body.user && dashRes.body.user.name === 'Alex Morgan', 'Dashboard includes student user profile');
        assert(dashRes.body.budget.income === 8000, 'Dashboard reflects backend budget income');
        assert(dashRes.body.budget.expenses === 5200, 'Dashboard reflects backend budget expenses');
        assert(dashRes.body.budget.remaining === 2800, 'Dashboard reflects backend budget remaining balance');
        assert(dashRes.body.latestMood === 'great', 'Dashboard reflects latest mood');
        assert(dashRes.body.completedTasks >= 1, 'Dashboard reflects completed task count');

        // 8. Testing Security Hardening & Validations
        console.log('\n8. Testing Security Hardening & Validations:');

        // 8a. Google OAuth rejects unverified request without token
        const unverifiedGoogleRes = await request('/api/auth/google', {
            method: 'POST',
            body: { email: 'unverified@example.com', name: 'Attacker' }
        });
        assert(unverifiedGoogleRes.status === 401, 'POST /api/auth/google without token rejected with 401');

        // 8b. Forgot password does not leak email in response
        const forgotRes = await request('/api/auth/forgot-password', {
            method: 'POST',
            body: { email: uniqueEmail }
        });
        assert(forgotRes.status === 200, 'POST /api/auth/forgot-password returns 200');
        assert(forgotRes.body.email === undefined, 'Password reset response does not leak user email');

        // 8c. Model validation: Task rejects invalid status
        const invalidStatusRes = await request('/api/tasks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${userToken}` },
            body: { title: 'Invalid Status Task', status: 'HackedStatus' }
        });
        assert(invalidStatusRes.status === 400, 'Task creation rejects invalid status with 400');

        // 8d. Model validation: Task rejects invalid priority
        const invalidPriorityRes = await request('/api/tasks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${userToken}` },
            body: { title: 'Invalid Priority Task', priority: 'UltraHigh' }
        });
        assert(invalidPriorityRes.status === 400, 'Task creation rejects invalid priority with 400');

        console.log('\n🎉 ALL BACKEND API INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n');
    } finally {
        if (serverInstance) {
            serverInstance.close();
        }
    }
}

if (require.main === module) {
    runTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n❌ Test Suite Failed:', err);
            process.exit(1);
        });
}

module.exports = { runTests };
