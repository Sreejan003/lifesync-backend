/**
 * LifeSync Frontend REST API Client (js/api.js)
 * -------------------------------------------------------------
 * Communicates with backend endpoints (/api/*).
 * Manages JWT Bearer tokens and provides asynchronous API methods
 * for Auth, Tasks, Calendar, Budget, Wellness, and Dashboard.
 */

(function () {
    'use strict';

    const TOKEN_KEY = 'lifesync_token';

    function getBaseUrl() {
        if (typeof window !== 'undefined') {
            if (window.__LIFESYNC_API_URL__) return window.__LIFESYNC_API_URL__.replace(/\/+$/, '');
            if (window.LIFESYNC_API_URL) return window.LIFESYNC_API_URL.replace(/\/+$/, '');
            try {
                const custom = localStorage.getItem('lifesync_api_url');
                if (custom) return custom.replace(/\/+$/, '');
            } catch (e) {}

            if (window.location) {
                const hostname = window.location.hostname || 'localhost';
                const port = window.location.port;

                // When frontend is served from a static dev server (e.g. Live Server on 5500, Vite on 5173),
                // direct local API calls to backend dev server on port 5000.
                const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
                if (isLocal && port && port !== '5000') {
                    return `http://${hostname}:5000/api`;
                }

                if (window.location.origin && window.location.protocol && window.location.protocol.startsWith('http')) {
                    return window.location.origin + '/api';
                }
            }
        }
        return '/api';
    }

    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch (e) {
            return null;
        }
    }

    function setToken(token) {
        try {
            if (token) {
                localStorage.setItem(TOKEN_KEY, token);
            } else {
                localStorage.removeItem(TOKEN_KEY);
            }
        } catch (e) {}
    }

    async function request(endpoint, options = {}) {
        const base = getBaseUrl();
        const url = `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
        const token = getToken();

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (token && !headers['Authorization']) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method: options.method || 'GET',
            headers
        };

        if (options.body) {
            config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        }

        try {
            const res = await fetch(url, config);

            if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
                // Token expired or invalid
                console.warn('API Authentication session expired.');
                setToken(null);
                if (typeof window !== 'undefined' && window.sessionStorage) {
                    sessionStorage.removeItem('ls_session_active');
                }
            }

            let data;
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await res.json();
            } else {
                data = await res.text();
            }

            if (!res.ok) {
                const errorMsg = (data && data.error) ? data.error : `HTTP ${res.status}: ${res.statusText}`;
                throw new Error(errorMsg);
            }

            return data;
        } catch (err) {
            // If network fails (e.g. offline or running in mock file:/// protocol)
            console.warn(`[LifeSync API Warning] ${options.method || 'GET'} ${endpoint}:`, err.message);
            throw err;
        }
    }

    const LifeSyncAPI = {
        getToken,
        setToken,
        request,

        // --- Health ---
        health() {
            return request('/health');
        },

        // --- Auth Endpoints ---
        register(name, email, password) {
            return request('/auth/register', {
                method: 'POST',
                body: { name, email, password }
            });
        },

        login(email, password) {
            return request('/auth/login', {
                method: 'POST',
                body: { email, password }
            });
        },

        getMe() {
            return request('/auth/me');
        },

        googleAuth(nameOrData, email, credential) {
            let payload = {};
            if (typeof nameOrData === 'object' && nameOrData !== null) {
                payload = nameOrData;
            } else {
                payload = { name: nameOrData, email, credential };
            }
            return request('/auth/google', {
                method: 'POST',
                body: payload
            });
        },

        getGoogleClientId() {
            return request('/auth/google/client-id');
        },

        // --- Tasks Endpoints ---
        getTasks(params = {}) {
            const query = new URLSearchParams(params).toString();
            return request(`/tasks${query ? '?' + query : ''}`);
        },

        getPrioritizedTasks() {
            return request('/tasks/prioritized');
        },

        createTask(taskData) {
            return request('/tasks', {
                method: 'POST',
                body: taskData
            });
        },

        updateTask(id, updates) {
            return request(`/tasks/${id}`, {
                method: 'PUT',
                body: updates
            });
        },

        deleteTask(id) {
            return request(`/tasks/${id}`, {
                method: 'DELETE'
            });
        },

        // --- Calendar Events Endpoints ---
        getEvents(params = {}) {
            const query = new URLSearchParams(params).toString();
            return request(`/events${query ? '?' + query : ''}`);
        },

        createEvent(eventData) {
            return request('/events', {
                method: 'POST',
                body: eventData
            });
        },

        updateEvent(id, updates) {
            return request(`/events/${id}`, {
                method: 'PUT',
                body: updates
            });
        },

        deleteEvent(id) {
            return request(`/events/${id}`, {
                method: 'DELETE'
            });
        },

        // --- Budget Endpoints ---
        getBudgetSummary() {
            return request('/budget/summary');
        },

        getTransactions(params = {}) {
            const query = new URLSearchParams(params).toString();
            return request(`/budget${query ? '?' + query : ''}`);
        },

        createTransaction(txData) {
            return request('/budget', {
                method: 'POST',
                body: txData
            });
        },

        updateTransaction(id, updates) {
            return request(`/budget/${id}`, {
                method: 'PUT',
                body: updates
            });
        },

        deleteTransaction(id) {
            return request(`/budget/${id}`, {
                method: 'DELETE'
            });
        },

        getBudgetSettings() {
            return request('/budget/settings');
        },

        updateBudgetSettings(settings) {
            return request('/budget/settings', {
                method: 'PUT',
                body: settings
            });
        },

        // --- Mental Wellness Endpoints ---
        getWellnessSummary() {
            return request('/wellness/summary');
        },

        getWellnessRecords() {
            return request('/wellness');
        },

        createWellnessCheckIn(data) {
            return request('/wellness', {
                method: 'POST',
                body: data
            });
        },

        deleteWellnessRecord(id) {
            return request(`/wellness/${id}`, {
                method: 'DELETE'
            });
        },

        // --- Mindful Games & Break Endpoints ---
        getWellnessGamesSummary() {
            return request('/wellness/games/summary');
        },

        getSudokuProgress() {
            return request('/wellness/sudoku');
        },

        saveSudokuProgress(data) {
            return request('/wellness/sudoku/progress', {
                method: 'POST',
                body: data
            });
        },

        completeSudoku(data) {
            return request('/wellness/sudoku/complete', {
                method: 'POST',
                body: data
            });
        },

        getWordScrambleProgress() {
            return request('/wellness/word-scramble/progress');
        },

        saveWordScrambleProgress(data) {
            return request('/wellness/word-scramble/progress', {
                method: 'POST',
                body: data
            });
        },

        getRiddleProgress() {
            return request('/wellness/riddle/progress');
        },

        saveRiddleProgress(data) {
            return request('/wellness/riddle/progress', {
                method: 'POST',
                body: data
            });
        },

        getBreathingProgress() {
            return request('/wellness/breathing/progress');
        },

        saveBreathingProgress(data) {
            return request('/wellness/breathing/progress', {
                method: 'POST',
                body: data
            });
        },

        // --- Dashboard Aggregated Summary ---
        getDashboard() {
            return request('/dashboard');
        },

        // --- Profile Endpoints ---
        getProfile() {
            return request('/profile');
        },

        updateProfile(data) {
            return request('/profile', {
                method: 'PUT',
                body: data
            });
        }
    };

    if (typeof window !== 'undefined') {
        window.LifeSyncAPI = LifeSyncAPI;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LifeSyncAPI;
    }
})();
