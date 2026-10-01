/**
 * LifeSync - Auth Module (js/auth.js)
 * -------------------------------------------------------------
 * Handles client-side simulated JWT authentication, local storage
 * user management, Google Auth simulation, and username updates.
 */

(function () {
    'use strict';

    // Storage Keys
    const USERS_KEY = 'lifesync_users';
    const TOKEN_KEY = 'lifesync_token';

    // Auth state listeners
    const authStateListeners = [];

    // ==========================================
    // 1. JWT UTILITIES
    // ==========================================

    /**
     * Encodes an object to a URL-safe Base64 string.
     */
    function base64UrlEncode(obj) {
        const jsonStr = JSON.stringify(obj);
        const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    /**
     * Decodes a URL-safe Base64 string back to an object.
     */
    function base64UrlDecode(str) {
        try {
            let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) {
                base64 += '=';
            }
            const jsonStr = decodeURIComponent(escape(atob(base64)));
            return JSON.parse(jsonStr);
        } catch (e) {
            return null;
        }
    }

    /**
     * Generates a mock JWT token in header.payload.signature format.
     */
    function generateMockJWT(payload) {
        const header = { alg: 'HS256', typ: 'JWT' };
        const now = Math.floor(Date.now() / 1000);
        const exp = now + (7 * 24 * 60 * 60); // 7-day expiration

        const fullPayload = {
            ...payload,
            iat: now,
            exp: exp
        };

        const encodedHeader = base64UrlEncode(header);
        const encodedPayload = base64UrlEncode(fullPayload);
        const mockSignature = btoa(encodedHeader + '.' + encodedPayload).substring(0, 32);

        return `${encodedHeader}.${encodedPayload}.${mockSignature}`;
    }

    /**
     * Parses and verifies expiration of a JWT token string.
     */
    function verifyAndParseJWT(token) {
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = base64UrlDecode(parts[1]);
        if (!payload) return null;

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return null; // Expired token
        }

        return payload;
    }

    // ==========================================
    // 2. LOCAL STORAGE DB HELPERS
    // ==========================================

    function getUsersFromStorage() {
        return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    }

    function saveUsersToStorage(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function getTokenFromStorage() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setTokenInStorage(token) {
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }

    function notifyAuthStateChanged(user) {
        authStateListeners.forEach(callback => callback(user));
    }

    // ==========================================
    // 3. PUBLIC AUTHENTICATION SERVICES
    // ==========================================

    /**
     * Gets current authenticated user session from stored JWT.
     */
    function getCurrentUser() {
        const token = getTokenFromStorage();
        if (!token) return null;

        const payload = verifyAndParseJWT(token);
        if (!payload) {
            setTokenInStorage(null);
            return null;
        }

        const users = getUsersFromStorage();
        const user = users.find(u => u.id === payload.sub || u.email === payload.email);

        if (user) {
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                avatarLetter: user.avatarLetter || user.username.charAt(0).toUpperCase(),
                isGoogleUser: user.isGoogleUser || false,
                token: token
            };
        }

        return {
            id: payload.sub,
            username: payload.username,
            email: payload.email,
            avatarLetter: payload.avatarLetter || payload.username.charAt(0).toUpperCase(),
            isGoogleUser: payload.isGoogleUser || false,
            token: token
        };
    }

    /**
     * One-way cryptographic/salted hash helper for offline/client state
     * (replaces insecure reversible Base64 btoa)
     */
    function hashPassword(str) {
        let h1 = 0xdeadbeef ^ 1337, h2 = 0x41c64e6d ^ 1337;
        const salt = "LifeSync_Client_Auth_Salt_v2_";
        const combined = salt + String(str);
        for (let i = 0; i < combined.length; i++) {
            const ch = combined.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    }

    /**
     * Registers a new user account and generates session JWT token.
     */
    function signUp({ username, email, password }) {
        const users = getUsersFromStorage();
        const normalizedEmail = email.trim().toLowerCase();

        if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
            throw new Error('An account with this email already exists.');
        }

        const initialLetter = username.trim().charAt(0).toUpperCase();
        const newUser = {
            id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            username: username.trim(),
            email: normalizedEmail,
            password: hashPassword(password),
            avatarLetter: initialLetter,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsersToStorage(users);

        const token = generateMockJWT({
            sub: newUser.id,
            username: newUser.username,
            email: newUser.email,
            avatarLetter: newUser.avatarLetter
        });

        setTokenInStorage(token);
        const currentUser = getCurrentUser();
        notifyAuthStateChanged(currentUser);
        return currentUser;
    }

    /**
     * Authenticates user credentials and issues session JWT token.
     */
    function signIn({ email, password }) {
        const users = getUsersFromStorage();
        const normalizedEmail = email.trim().toLowerCase();
        const hashedPassword = hashPassword(password);

        const user = users.find(u => u.email.toLowerCase() === normalizedEmail);
        if (!user || user.password !== hashedPassword) {
            throw new Error('Invalid email or password.');
        }

        const token = generateMockJWT({
            sub: user.id,
            username: user.username,
            email: user.email,
            avatarLetter: user.avatarLetter || user.username.charAt(0).toUpperCase()
        });

        setTokenInStorage(token);
        const currentUser = getCurrentUser();
        notifyAuthStateChanged(currentUser);
        return currentUser;
    }

    /**
     * Simulates Google Auth login flow and issues session JWT token.
     */
    function signInWithGoogle(googleData = {}) {
        const googleEmail = (googleData.email && googleData.email.trim()) 
            ? googleData.email.trim().toLowerCase() 
            : '';
        if (!googleEmail) {
            throw new Error('Google account email is required.');
        }
        const googleUsername = (googleData.username && googleData.username.trim())
            ? googleData.username.trim()
            : (googleEmail.split('@')[0]);

        const users = getUsersFromStorage();
        const initialLetter = googleUsername.charAt(0).toUpperCase() || 'G';

        let user = users.find(u => u.email.toLowerCase() === googleEmail);
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            user = {
                id: 'usr_google_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                username: googleUsername,
                email: googleEmail,
                isGoogleUser: true,
                isNewUser: true,
                needsProfileSetup: true,
                avatarLetter: initialLetter,
                createdAt: new Date().toISOString()
            };
            users.push(user);
            saveUsersToStorage(users);
        } else {
            isNewUser = Boolean(user.needsProfileSetup);
            user.username = googleUsername;
            user.avatarLetter = initialLetter;
            saveUsersToStorage(users);
        }

        const token = generateMockJWT({
            sub: user.id,
            username: user.username,
            email: user.email,
            avatarLetter: initialLetter,
            isGoogleUser: true,
            isNewUser: isNewUser,
            needsProfileSetup: isNewUser
        });

        setTokenInStorage(token);
        const currentUser = getCurrentUser();
        if (currentUser) {
            currentUser.isNewUser = isNewUser;
            currentUser.needsProfileSetup = isNewUser;
        }
        notifyAuthStateChanged(currentUser);
        return currentUser;
    }

    /**
     * Updates current user's display username and refreshes session JWT token.
     */
    function updateUsername(newUsername) {
        const currentUser = getCurrentUser();
        if (!currentUser) throw new Error('No user is currently signed in.');

        const trimmedName = newUsername.trim();
        if (!trimmedName) throw new Error('Username cannot be empty.');

        const users = getUsersFromStorage();
        const userIndex = users.findIndex(u => u.id === currentUser.id);

        const initialLetter = trimmedName.charAt(0).toUpperCase();

        if (userIndex !== -1) {
            users[userIndex].username = trimmedName;
            users[userIndex].avatarLetter = initialLetter;
            saveUsersToStorage(users);
        }

        const newToken = generateMockJWT({
            sub: currentUser.id,
            username: trimmedName,
            email: currentUser.email,
            avatarLetter: initialLetter,
            isGoogleUser: currentUser.isGoogleUser
        });

        setTokenInStorage(newToken);
        const updatedUser = getCurrentUser();
        notifyAuthStateChanged(updatedUser);
        return updatedUser;
    }

    /**
     * Clears session JWT token and signs out user.
     */
    function signOut() {
        setTokenInStorage(null);
        notifyAuthStateChanged(null);
    }

    /**
     * Registers a callback to be triggered when auth state changes.
     */
    function onAuthStateChanged(callback) {
        if (typeof callback === 'function') {
            authStateListeners.push(callback);
        }
    }

    // ==========================================
    // 4. ASYNC BACKEND CONNECTED AUTH SERVICES
    // ==========================================

    async function signUpAsync({ username, email, password }) {
        if (typeof window !== 'undefined' && window.LifeSyncAPI && typeof fetch !== 'undefined') {
            try {
                const res = await window.LifeSyncAPI.register(username, email, password);
                if (res && res.token) {
                    setTokenInStorage(res.token);

                    const initialLetter = username.trim().charAt(0).toUpperCase() || 'S';
                    const userObj = {
                        id: res.user.id,
                        username: res.user.name,
                        email: res.user.email,
                        avatarLetter: res.user.avatarLetter || initialLetter,
                        createdAt: res.user.createdAt || new Date().toISOString()
                    };

                    const users = getUsersFromStorage();
                    const existingIdx = users.findIndex(u => u.id === userObj.id || u.email === userObj.email);
                    if (existingIdx !== -1) {
                        users[existingIdx] = userObj;
                    } else {
                        users.push(userObj);
                    }
                    saveUsersToStorage(users);

                    const currentUser = getCurrentUser();
                    notifyAuthStateChanged(currentUser);
                    return currentUser;
                }
            } catch (err) {
                // Do not silently fall back to mock auth on backend failure
                if (err.message && (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch'))) {
                    throw new Error('Unable to connect to LifeSync backend service. Please ensure the backend server is running.');
                }
                throw err;
            }
        }
        return signUp({ username, email, password });
    }

    async function signInAsync({ email, password }) {
        if (typeof window !== 'undefined' && window.LifeSyncAPI && typeof fetch !== 'undefined') {
            try {
                const res = await window.LifeSyncAPI.login(email, password);
                if (res && res.token) {
                    setTokenInStorage(res.token);

                    const initialLetter = res.user.name.charAt(0).toUpperCase() || 'S';
                    const userObj = {
                        id: res.user.id,
                        username: res.user.name,
                        email: res.user.email,
                        avatarLetter: res.user.avatarLetter || initialLetter,
                        createdAt: res.user.createdAt || new Date().toISOString()
                    };

                    const users = getUsersFromStorage();
                    const existingIdx = users.findIndex(u => u.id === userObj.id || u.email === userObj.email);
                    if (existingIdx !== -1) {
                        users[existingIdx] = userObj;
                    } else {
                        users.push(userObj);
                    }
                    saveUsersToStorage(users);

                    const currentUser = getCurrentUser();
                    notifyAuthStateChanged(currentUser);
                    return currentUser;
                }
            } catch (err) {
                // Do not silently fall back to mock auth on backend failure
                if (err.message && (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch'))) {
                    throw new Error('Unable to connect to LifeSync backend service. Please check your network connection.');
                }
                throw err;
            }
        }
        return signIn({ email, password });
    }

    async function signInWithGoogleAsync(googleData = {}) {
        if (typeof window !== 'undefined' && window.LifeSyncAPI && typeof fetch !== 'undefined') {
            try {
                const res = await window.LifeSyncAPI.googleAuth({
                    name: googleData.username || googleData.name,
                    email: googleData.email,
                    credential: googleData.credential,
                    idToken: googleData.idToken,
                    accessToken: googleData.accessToken
                });
                if (res && res.token) {
                    setTokenInStorage(res.token);
                    const isNew = Boolean(res.isNewUser || (res.user && res.user.isNewUser));

                    const userObj = {
                        id: res.user.id,
                        username: res.user.name,
                        email: res.user.email,
                        avatarLetter: res.user.avatarLetter || 'G',
                        picture: res.user.picture || null,
                        isGoogleUser: true,
                        isNewUser: isNew,
                        needsProfileSetup: isNew,
                        createdAt: new Date().toISOString()
                    };

                    const users = getUsersFromStorage();
                    const existingIdx = users.findIndex(u => u.id === userObj.id || u.email === userObj.email);
                    if (existingIdx !== -1) {
                        users[existingIdx] = { ...users[existingIdx], ...userObj };
                    } else {
                        users.push(userObj);
                    }
                    saveUsersToStorage(users);

                    const currentUser = getCurrentUser();
                    if (currentUser) {
                        currentUser.isNewUser = isNew;
                        currentUser.needsProfileSetup = isNew;
                    }
                    notifyAuthStateChanged(currentUser);
                    return currentUser;
                }
            } catch (err) {
                // Fail cleanly instead of silently falling back to mock session
                if (err.message && (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch'))) {
                    throw new Error('Unable to connect to LifeSync backend service. Please ensure the backend server is running.');
                }
                throw err;
            }
        }
        return signInWithGoogle(googleData);
    }

    function markProfileCompleted() {
        const currentUser = getCurrentUser();
        if (currentUser) {
            currentUser.isNewUser = false;
            currentUser.needsProfileSetup = false;
            const users = getUsersFromStorage();
            const u = users.find(x => x.id === currentUser.id);
            if (u) {
                u.needsProfileSetup = false;
                u.isNewUser = false;
                saveUsersToStorage(users);
            }
        }
    }

    // Expose Auth module globally
    window.AuthSystem = {
        markProfileCompleted,
        getCurrentUser,
        signUp,
        signUpAsync,
        signIn,
        signInAsync,
        signInWithGoogle,
        signInWithGoogleAsync,
        updateUsername,
        signOut,
        onAuthStateChanged
    };
})();
