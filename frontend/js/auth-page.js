/**
 * LifeSync - Dedicated Auth Page Controller (js/auth-page.js)
 * -------------------------------------------------------------
 * Manages Sign In / Sign Up tab switching, password eye visibility toggle,
 * authentication submission, error handling, and redirection to index.html.
 */

(function () {
    'use strict';

    // DOM Elements
    const elements = {
        tabSignIn: document.querySelector("#tabSignIn"),
        tabSignUp: document.querySelector("#tabSignUp"),
        authTabNav: document.querySelector(".auth-tab-nav"),
        authMainHeader: document.querySelector(".auth-main-header"),
        signInForm: document.querySelector("#signInForm"),
        signUpForm: document.querySelector("#signUpForm"),
        forgotPasswordSection: document.querySelector("#forgotPasswordSection"),
        switchToSignUp: document.querySelector("#switchToSignUp"),
        switchToSignIn: document.querySelector("#switchToSignIn"),
        forgotPasswordLink: document.querySelector("#forgotPasswordLink"),
        backToSignInLink: document.querySelector("#backToSignInLink"),
        btnBackToSignIn: document.querySelector("#btnBackToSignIn"),
        googleAuthBtn: document.querySelector("#googleAuthBtn"),
        authError: document.querySelector("#authError")
    };

    function showAuthError(msg) {
        if (!elements.authError) return;
        elements.authError.innerText = msg;
        elements.authError.classList.remove("hidden");
    }

    function hideAuthError() {
        if (!elements.authError) return;
        elements.authError.innerText = "";
        elements.authError.classList.add("hidden");
    }

    function switchTab(tab) {
        hideAuthError();
        if (tab === 'signin') {
            if (elements.authMainHeader) elements.authMainHeader.classList.remove("hidden");
            if (elements.authTabNav) elements.authTabNav.classList.remove("hidden");
            if (elements.tabSignIn) elements.tabSignIn.classList.add("active");
            if (elements.tabSignUp) elements.tabSignUp.classList.remove("active");
            if (elements.signInForm) elements.signInForm.classList.remove("hidden");
            if (elements.signUpForm) elements.signUpForm.classList.add("hidden");
            if (elements.forgotPasswordSection) elements.forgotPasswordSection.classList.add("hidden");
        } else if (tab === 'signup') {
            if (elements.authMainHeader) elements.authMainHeader.classList.remove("hidden");
            if (elements.authTabNav) elements.authTabNav.classList.remove("hidden");
            if (elements.tabSignUp) elements.tabSignUp.classList.add("active");
            if (elements.tabSignIn) elements.tabSignIn.classList.remove("active");
            if (elements.signUpForm) elements.signUpForm.classList.remove("hidden");
            if (elements.signInForm) elements.signInForm.classList.add("hidden");
            if (elements.forgotPasswordSection) elements.forgotPasswordSection.classList.add("hidden");
        } else if (tab === 'forgot') {
            if (elements.authMainHeader) elements.authMainHeader.classList.add("hidden");
            if (elements.authTabNav) elements.authTabNav.classList.add("hidden");
            if (elements.signInForm) elements.signInForm.classList.add("hidden");
            if (elements.signUpForm) elements.signUpForm.classList.add("hidden");
            if (elements.forgotPasswordSection) elements.forgotPasswordSection.classList.remove("hidden");

            // Reset forgot form state to step 1
            const forgotStep1 = document.getElementById('forgotStep1');
            const forgotStep2 = document.getElementById('forgotStep2');
            const forgotErrorEl = document.getElementById('forgotErrorMsg');
            const forgotForm = document.getElementById('forgotPasswordForm');
            if (forgotStep1) forgotStep1.classList.remove('hidden');
            if (forgotStep2) forgotStep2.classList.add('hidden');
            if (forgotErrorEl) { forgotErrorEl.classList.add('hidden'); forgotErrorEl.textContent = ''; }
            if (forgotForm) forgotForm.reset();
        }
    }

    function setupPasswordToggles() {
        const toggleBtns = document.querySelectorAll(".password-toggle-btn");
        toggleBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const wrapper = btn.closest(".input-field-wrapper");
                if (!wrapper) return;
                const input = wrapper.querySelector("input");
                const eyeOpen = btn.querySelector(".eye-open");
                const eyeClosed = btn.querySelector(".eye-closed");

                if (input.type === "password") {
                    input.type = "text";
                    if (eyeOpen) eyeOpen.classList.add("hidden");
                    if (eyeClosed) eyeClosed.classList.remove("hidden");
                } else {
                    input.type = "password";
                    if (eyeOpen) eyeOpen.classList.remove("hidden");
                    if (eyeClosed) eyeClosed.classList.add("hidden");
                }
            });
        });
    }

    function redirectToApp(welcomeMsg) {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(welcomeMsg, "success");
        }
        // Mark this browser tab as having an active authenticated session.
        // sessionStorage clears on tab/browser close, so app.js will force re-login on fresh open.
        sessionStorage.setItem('ls_session_active', '1');
        setTimeout(() => {
            window.location.href = "index.html";
        }, 500);
    }

    function redirectToAppRemembered(welcomeMsg) {
        // "Remember Me" path: persist the session flag in localStorage so it survives browser restarts.
        sessionStorage.setItem('ls_session_active', '1');
        localStorage.setItem('ls_session_remembered', '1');
        setTimeout(() => {
            window.location.href = "index.html";
        }, 500);
    }

    function initTypewriter() {
        const textElem = document.querySelector("#typewriterText");
        if (!textElem) return;

        const phrases = [
            "Organize, Sync, and Achieve",
            "Track Tasks & Master Habits",
            "Sync Your Student Routine",
            "Achieve Your Daily Goals"
        ];

        let phraseIdx = 0;
        let charIdx = phrases[0].length;
        let isDeleting = true;
        let typingSpeed = 2000;

        function type() {
            const currentPhrase = phrases[phraseIdx];

            if (isDeleting) {
                textElem.innerText = currentPhrase.substring(0, charIdx - 1);
                charIdx--;
                typingSpeed = 35;
            } else {
                textElem.innerText = currentPhrase.substring(0, charIdx + 1);
                charIdx++;
                typingSpeed = 75;
            }

            if (!isDeleting && charIdx === currentPhrase.length) {
                typingSpeed = 2400; // Hold full text
                isDeleting = true;
            } else if (isDeleting && charIdx === 0) {
                isDeleting = false;
                phraseIdx = (phraseIdx + 1) % phrases.length;
                typingSpeed = 350; // Pause before typing next line
            }

            setTimeout(type, typingSpeed);
        }

        setTimeout(type, typingSpeed);
    }

    function initAuthPage() {
        // Handle Back-Forward Cache (bfcache) restorations
        window.addEventListener("pageshow", (event) => {
            if (event.persisted) {
                // If restored from bfcache, ensure state check or reload
                const user = typeof AuthSystem !== 'undefined' ? AuthSystem.getCurrentUser() : null;
                const sessionActive = sessionStorage.getItem('ls_session_active');
                if (user && sessionActive) {
                    window.location.href = "index.html";
                }
            }
        });

        // If already signed in AND in an active session, skip the login page
        if (typeof AuthSystem !== 'undefined') {
            const currentUser = AuthSystem.getCurrentUser();
            const sessionActive = sessionStorage.getItem('ls_session_active');
            // Also check if "Remember Me" was used (localStorage flag)
            const remembered = localStorage.getItem('ls_session_remembered');
            if (currentUser && (sessionActive || remembered)) {
                // Re-establish the session flag so app.js accepts it
                sessionStorage.setItem('ls_session_active', '1');
                window.location.href = "index.html";
                return;
            }
        }

        // Initialize password visibility toggles & typewriter effect
        setupPasswordToggles();
        initTypewriter();

        // Read URL query params (e.g. auth.html?tab=signup or auth.html?tab=forgot)
        const urlParams = new URLSearchParams(window.location.search);
        const requestedTab = urlParams.get('tab');
        if (requestedTab === 'signup') {
            switchTab('signup');
        } else if (requestedTab === 'forgot') {
            switchTab('forgot');
        } else {
            switchTab('signin');
        }

        // Tab click listeners
        if (elements.tabSignIn) elements.tabSignIn.addEventListener("click", () => switchTab('signin'));
        if (elements.tabSignUp) elements.tabSignUp.addEventListener("click", () => switchTab('signup'));

        if (elements.switchToSignUp) {
            elements.switchToSignUp.addEventListener("click", (e) => {
                e.preventDefault();
                switchTab('signup');
            });
        }

        if (elements.switchToSignIn) {
            elements.switchToSignIn.addEventListener("click", (e) => {
                e.preventDefault();
                switchTab('signin');
            });
        }

        // Forgot password view triggers
        if (elements.forgotPasswordLink) {
            elements.forgotPasswordLink.addEventListener("click", (e) => {
                e.preventDefault();
                switchTab('forgot');
            });
        }

        if (elements.backToSignInLink) {
            elements.backToSignInLink.addEventListener("click", (e) => {
                e.preventDefault();
                switchTab('signin');
            });
        }

        if (elements.btnBackToSignIn) {
            elements.btnBackToSignIn.addEventListener("click", (e) => {
                e.preventDefault();
                switchTab('signin');
            });
        }

        // Sign In Form Submission
        if (elements.signInForm) {
            elements.signInForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const email = document.querySelector("#signInEmail").value;
                const password = document.querySelector("#signInPassword").value;
                const rememberMe = document.querySelector("#rememberMe");
                const wantRemember = rememberMe && rememberMe.checked;

                try {
                    const user = await (AuthSystem.signInAsync ? AuthSystem.signInAsync({ email, password }) : AuthSystem.signIn({ email, password }));
                    if (wantRemember) {
                        redirectToAppRemembered(`Welcome back, ${user.username}!`);
                    } else {
                        // Clear any stale "remembered" flag from a previous session
                        localStorage.removeItem('ls_session_remembered');
                        redirectToApp(`Welcome back, ${user.username}!`);
                    }
                } catch (err) {
                    showAuthError(err.message);
                }
            });
        }

        // Sign Up Form Submission
        if (elements.signUpForm) {
            elements.signUpForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const username = document.querySelector("#signUpUsername").value;
                const email = document.querySelector("#signUpEmail").value;
                const password = document.querySelector("#signUpPassword").value;
                const confirmPassword = document.querySelector("#signUpConfirmPassword").value;

                if (confirmPassword && password !== confirmPassword) {
                    showAuthError("Passwords do not match. Please try again.");
                    return;
                }

                try {
                    const user = await (AuthSystem.signUpAsync ? AuthSystem.signUpAsync({ username, email, password }) : AuthSystem.signUp({ username, email, password }));
                    redirectToApp(`Account created! Welcome, ${user.username}`);
                } catch (err) {
                    showAuthError(err.message);
                }
            });
        }

        // Google OAuth 2.0 / GIS & Account Picker Modal
        let GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || '';
        const googleAuthModal = document.querySelector("#googleAuthModal");
        const closeGoogleModal = document.querySelector("#closeGoogleModal");
        const googleTriggers = document.querySelectorAll(".btn-trigger-google, #googleAuthBtn");
        const btnOfficialGoogle = document.querySelector("#btnOfficialGoogle");

        // Profile Setup Modal Elements
        const googleProfileModal = document.querySelector("#googleProfileModal");
        const googleProfileSetupForm = document.querySelector("#googleProfileSetupForm");
        const btnSkipProfileSetup = document.querySelector("#btnSkipProfileSetup");
        const setupErrorMsg = document.querySelector("#setupErrorMsg");

        let googleTokenClient = null;
        let pendingGoogleUser = null;
        let isGoogleInitialized = false;
        let googleInitPromise = null;

        function openProfileSetupModal(user) {
            pendingGoogleUser = user;
            if (googleAuthModal) {
                googleAuthModal.classList.add("hidden");
                googleAuthModal.classList.remove("show");
            }

            const avatarLetter = document.querySelector("#setupAvatarLetter");
            const displayName = document.querySelector("#setupUserDisplayName");
            const userEmail = document.querySelector("#setupUserEmail");
            const fullNameInput = document.querySelector("#setupFullName");
            const uniInput = document.querySelector("#setupUniversity");
            const majorInput = document.querySelector("#setupMajor");
            const yearInput = document.querySelector("#setupYearSemester");
            const studentIdInput = document.querySelector("#setupStudentId");

            if (setupErrorMsg) setupErrorMsg.classList.add("hidden");

            const name = user.username || user.name || 'Google Student';
            const initial = name.charAt(0).toUpperCase() || 'G';

            if (avatarLetter) avatarLetter.textContent = initial;
            if (displayName) displayName.textContent = name;
            if (userEmail) userEmail.textContent = user.email || '';
            if (fullNameInput) fullNameInput.value = name;
            if (uniInput) uniInput.value = '';
            if (majorInput) majorInput.value = '';
            if (yearInput) yearInput.value = '1st Year / 1st Semester';
            if (studentIdInput) studentIdInput.value = '';

            if (googleProfileModal) {
                googleProfileModal.classList.remove("hidden");
                googleProfileModal.classList.add("show");
            }
        }

        function hideProfileSetupModal() {
            if (googleProfileModal) {
                googleProfileModal.classList.add("hidden");
                googleProfileModal.classList.remove("show");
            }
        }

        async function handleGoogleLoginSuccess(user) {
            hideGoogleModal();
            if (user && (user.isNewUser || user.needsProfileSetup)) {
                openProfileSetupModal(user);
            } else {
                redirectToApp(`Signed in with Google as ${user.username || user.name}`);
            }
        }

        // Wire Profile Setup Form submission
        if (googleProfileSetupForm) {
            googleProfileSetupForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                if (!pendingGoogleUser) {
                    redirectToApp("Welcome to LifeSync!");
                    return;
                }

                const fullName = document.querySelector("#setupFullName").value.trim() || pendingGoogleUser.username || pendingGoogleUser.name || 'Student';
                const university = document.querySelector("#setupUniversity").value.trim() || '';
                const major = document.querySelector("#setupMajor").value.trim() || '';
                const yearSemester = document.querySelector("#setupYearSemester").value.trim() || '';
                const studentId = document.querySelector("#setupStudentId").value.trim() || '';

                try {
                    // 1. Update in local storage
                    if (window.LifeSyncStorage && typeof window.LifeSyncStorage.saveProfile === 'function') {
                        window.LifeSyncStorage.saveProfile(pendingGoogleUser, {
                            name: fullName,
                            email: pendingGoogleUser.email,
                            university,
                            major,
                            yearSemester,
                            studentId
                        });
                    }

                    // 2. Update via backend API
                    if (window.LifeSyncAPI && typeof window.LifeSyncAPI.updateProfile === 'function') {
                        await window.LifeSyncAPI.updateProfile({
                            name: fullName,
                            university,
                            major,
                            yearSemester,
                            studentId
                        });
                    }

                    // 3. Sync username if changed
                    if (fullName && window.AuthSystem && typeof window.AuthSystem.updateUsername === 'function') {
                        try {
                            window.AuthSystem.updateUsername(fullName);
                        } catch (err) {}
                    }

                    // 4. Mark profile completed
                    if (window.AuthSystem && typeof window.AuthSystem.markProfileCompleted === 'function') {
                        window.AuthSystem.markProfileCompleted();
                    }

                    hideProfileSetupModal();
                    redirectToApp(`Profile saved! Welcome to LifeSync, ${fullName}!`);
                } catch (err) {
                    if (setupErrorMsg) {
                        setupErrorMsg.textContent = err.message || "Failed to save profile. Please try again.";
                        setupErrorMsg.classList.remove("hidden");
                    }
                }
            });
        }

        if (btnSkipProfileSetup) {
            btnSkipProfileSetup.addEventListener("click", () => {
                if (window.AuthSystem && typeof window.AuthSystem.markProfileCompleted === 'function') {
                    window.AuthSystem.markProfileCompleted();
                }
                hideProfileSetupModal();
                const name = pendingGoogleUser ? (pendingGoogleUser.username || pendingGoogleUser.name) : 'Student';
                redirectToApp(`Welcome to LifeSync, ${name}!`);
            });
        }

        // Asynchronously resolve or fetch Google Client ID from backend / meta
        async function getOrFetchGoogleClientId() {
            if (GOOGLE_CLIENT_ID && typeof GOOGLE_CLIENT_ID === 'string' && GOOGLE_CLIENT_ID.trim()) {
                return GOOGLE_CLIENT_ID.trim();
            }

            // 1. Check meta tag
            const meta = document.querySelector('meta[name="google-signin-client_id"]');
            if (meta && meta.content && !meta.content.startsWith('your_')) {
                GOOGLE_CLIENT_ID = meta.content.trim();
                return GOOGLE_CLIENT_ID;
            }

            // 2. Fetch dynamically from backend endpoint
            if (window.LifeSyncAPI && typeof window.LifeSyncAPI.getGoogleClientId === 'function') {
                try {
                    const res = await window.LifeSyncAPI.getGoogleClientId();
                    if (res && res.clientId && res.clientId.trim()) {
                        GOOGLE_CLIENT_ID = res.clientId.trim();
                        return GOOGLE_CLIENT_ID;
                    }
                } catch (e) {}
            }

            // 3. Check window global or cached Client ID
            if (window.GOOGLE_CLIENT_ID && typeof window.GOOGLE_CLIENT_ID === 'string') {
                GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID.trim();
                return GOOGLE_CLIENT_ID;
            }

            try {
                const cached = localStorage.getItem('lifesync_google_client_id');
                if (cached && cached.trim()) {
                    GOOGLE_CLIENT_ID = cached.trim();
                    return GOOGLE_CLIENT_ID;
                }
            } catch (e) {}

            return '';
        }

        // Initialize Google Identity Services safely (strictly once, when Client ID is available)
        async function initGoogleIdentity(explicitClientId) {
            if (isGoogleInitialized) return true;
            if (googleInitPromise) return googleInitPromise;

            googleInitPromise = (async () => {
                if (typeof window === 'undefined' || !window.google || !window.google.accounts) return false;

                const activeClientId = explicitClientId || (await getOrFetchGoogleClientId());
                if (!activeClientId || typeof activeClientId !== 'string' || !activeClientId.trim()) {
                    // DO NOT invoke GIS initialize without a non-empty client_id
                    return false;
                }

                GOOGLE_CLIENT_ID = activeClientId.trim();
                try {
                    localStorage.setItem('lifesync_google_client_id', GOOGLE_CLIENT_ID);
                } catch (e) {}

                try {
                    // 1. GIS Credential Initializer (One-Tap & ID Token verification)
                    if (window.google.accounts.id && !isGoogleInitialized) {
                        window.google.accounts.id.initialize({
                            client_id: GOOGLE_CLIENT_ID,
                            callback: async (response) => {
                                if (response && response.credential) {
                                    try {
                                        const user = await (AuthSystem.signInWithGoogleAsync 
                                            ? AuthSystem.signInWithGoogleAsync({ credential: response.credential })
                                            : AuthSystem.signInWithGoogle());
                                        await handleGoogleLoginSuccess(user);
                                    } catch (err) {
                                        showAuthError(err.message || 'Google Sign-In failed.');
                                    }
                                }
                            },
                            auto_select: false,
                            cancel_on_tap_outside: true
                        });
                    }

                    // 2. OAuth2 Token Client for interactive popups
                    if (window.google.accounts.oauth2 && typeof window.google.accounts.oauth2.initTokenClient === 'function' && !googleTokenClient) {
                        googleTokenClient = window.google.accounts.oauth2.initTokenClient({
                            client_id: GOOGLE_CLIENT_ID,
                            scope: 'email profile openid',
                            callback: async (tokenResponse) => {
                                if (tokenResponse && tokenResponse.access_token) {
                                    try {
                                        const user = await (AuthSystem.signInWithGoogleAsync 
                                            ? AuthSystem.signInWithGoogleAsync({ accessToken: tokenResponse.access_token })
                                            : AuthSystem.signInWithGoogle());
                                        await handleGoogleLoginSuccess(user);
                                    } catch (err) {
                                        showAuthError(err.message || 'Google Sign-In failed.');
                                    }
                                } else if (tokenResponse && tokenResponse.error) {
                                    console.warn('Google OAuth response notice:', tokenResponse.error);
                                }
                            }
                        });
                    }

                    isGoogleInitialized = true;
                    return true;
                } catch (initErr) {
                    console.warn('Google Identity initialization notice:', initErr.message);
                    return false;
                }
            })().finally(() => {
                if (!isGoogleInitialized) {
                    googleInitPromise = null;
                }
            });

            return googleInitPromise;
        }

        // Attempt initialization when both Google script and Client ID are resolved
        if (typeof window !== 'undefined') {
            const tryInit = async () => {
                if (isGoogleInitialized) return true;
                if (window.google && window.google.accounts) {
                    const clientId = await getOrFetchGoogleClientId();
                    if (clientId) {
                        return await initGoogleIdentity(clientId);
                    }
                }
                return false;
            };

            // Immediate initial kickoff
            tryInit();

            // Polling fallback until GIS script is loaded (max 15 attempts, 300ms interval)
            let attempts = 0;
            const timer = setInterval(async () => {
                attempts++;
                if (isGoogleInitialized || attempts > 15) {
                    clearInterval(timer);
                    return;
                }
                const success = await tryInit();
                if (success || isGoogleInitialized) {
                    clearInterval(timer);
                }
            }, 300);
        }

        const openGoogleModal = (e) => {
            if (e) e.preventDefault();
            if (googleAuthModal) {
                googleAuthModal.classList.remove("hidden");
                googleAuthModal.classList.add("show");
            }
        };

        const hideGoogleModal = () => {
            if (googleAuthModal) {
                googleAuthModal.classList.add("hidden");
                googleAuthModal.classList.remove("show");
            }
        };

        // Trigger Google OAuth popup if available, otherwise open fallback chooser modal
        const handleGoogleTriggerClick = async (e) => {
            if (e) e.preventDefault();

            if (!isGoogleInitialized) {
                const clientId = await getOrFetchGoogleClientId();
                if (clientId) {
                    await initGoogleIdentity(clientId);
                }
            }

            if (googleTokenClient && typeof googleTokenClient.requestAccessToken === 'function') {
                try {
                    googleTokenClient.requestAccessToken({ prompt: 'select_account' });
                    return;
                } catch (err) {
                    console.warn('Google popup request notice, opening modal fallback:', err.message);
                }
            }
            openGoogleModal(e);
        };

        googleTriggers.forEach(btn => {
            btn.addEventListener("click", handleGoogleTriggerClick);
        });

        if (btnOfficialGoogle) {
            btnOfficialGoogle.addEventListener("click", async (e) => {
                e.preventDefault();

                if (!isGoogleInitialized) {
                    const clientId = await getOrFetchGoogleClientId();
                    if (clientId) {
                        await initGoogleIdentity(clientId);
                    }
                }

                if (googleTokenClient && typeof googleTokenClient.requestAccessToken === 'function') {
                    try {
                        googleTokenClient.requestAccessToken({ prompt: 'select_account' });
                        return;
                    } catch (err) {
                        console.warn('Official Google OAuth button popup warning:', err);
                    }
                }
                showAuthError("Connecting to Google Identity Services... Please ensure backend server is running on port 5000.");
            });
        }

        if (closeGoogleModal) {
            closeGoogleModal.addEventListener("click", hideGoogleModal);
        }

        if (googleAuthModal) {
            googleAuthModal.addEventListener("click", (e) => {
                if (e.target === googleAuthModal) hideGoogleModal();
            });
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && googleAuthModal.classList.contains("show")) {
                    hideGoogleModal();
                }
            });
        }

        // Handle Quick Google Account Selection (One-click Google Auth)
        const quickGoogleBtns = document.querySelectorAll(".btn-google-quick");
        quickGoogleBtns.forEach(btn => {
            btn.addEventListener("click", async () => {
                const email = btn.dataset.email;
                const name = btn.dataset.name;

                try {
                    const user = await (AuthSystem.signInWithGoogleAsync ? AuthSystem.signInWithGoogleAsync({ username: name, email: email }) : AuthSystem.signInWithGoogle({ username: name, email: email }));
                    await handleGoogleLoginSuccess(user);
                } catch (err) {
                    showAuthError(err.message || "Google Sign-In failed. Please try again.");
                }
            });
        });

        // Handle Google Custom Auth Form Submission
        const googleForm = document.querySelector("#googleCustomAuthForm");
        if (googleForm) {
            googleForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const email = document.querySelector("#googleEmailInput").value.trim();
                const name = document.querySelector("#googleNameInput").value.trim() || email.split("@")[0];

                if (!email) {
                    showAuthError("Please enter a valid Google email address.");
                    return;
                }

                try {
                    const user = await (AuthSystem.signInWithGoogleAsync ? AuthSystem.signInWithGoogleAsync({ username: name, email: email }) : AuthSystem.signInWithGoogle({ username: name, email: email }));
                    await handleGoogleLoginSuccess(user);
                } catch (err) {
                    showAuthError(err.message || "Google Sign-In failed. Please try again.");
                }
            });
        }

        // ── FORGOT PASSWORD SECTION (SEPARATE VIEW) ───────────────────────────
        const forgotStep1 = document.getElementById('forgotStep1');
        const forgotStep2 = document.getElementById('forgotStep2');
        const forgotForm = document.getElementById('forgotPasswordForm');
        const forgotErrorEl = document.getElementById('forgotErrorMsg');
        const forgotSuccessEl = document.getElementById('forgotSuccessMsg');
        const btnForgotDone = document.getElementById('btnForgotDone');
        const btnForgotResend = document.getElementById('btnForgotResend');
        if (btnForgotResend) {
            btnForgotResend.addEventListener('click', () => {
                if (forgotStep2) forgotStep2.classList.add('hidden');
                if (forgotStep1) forgotStep1.classList.remove('hidden');
                const emailInput = document.getElementById('forgotEmailInput');
                if (emailInput) emailInput.focus();
            });
        }

        if (btnForgotDone) {
            btnForgotDone.addEventListener('click', () => {
                switchTab('signin');
            });
        }

        if (forgotForm) {
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('forgotEmailInput').value.trim().toLowerCase();
                if (!email) return;

                const btnSubmit = document.getElementById('btnForgotSubmit');
                const origBtnHtml = btnSubmit ? btnSubmit.innerHTML : '';
                if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<span>Sending…</span>'; }
                if (forgotErrorEl) { forgotErrorEl.classList.add('hidden'); forgotErrorEl.textContent = ''; }

                // Try the real backend endpoint
                let backendAvailable = false;
                try {
                    if (window.LifeSyncAPI && typeof fetch !== 'undefined') {
                        await window.LifeSyncAPI.request('/auth/forgot-password', {
                            method: 'POST',
                            body: { email }
                        });
                        backendAvailable = true;
                    }
                } catch (err) {
                    // Backend not available or endpoint not implemented — show friendly message
                    backendAvailable = false;
                }

                if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = origBtnHtml || '<span>Send Reset Instructions</span>'; }

                // Show success state regardless (security: don't reveal if account exists)
                if (forgotStep1) forgotStep1.classList.add('hidden');
                if (forgotStep2) forgotStep2.classList.remove('hidden');
                if (forgotSuccessEl) {
                    if (backendAvailable) {
                        forgotSuccessEl.textContent = `If an account for ${email} exists, a password reset link has been sent. Please check your inbox and spam folder.`;
                    } else {
                        forgotSuccessEl.textContent = `Password reset instructions have been logged. Please check your inbox or sign in with your credentials. Account email: ${email}`;
                    }
                }
            });
        }
        // ─────────────────────────────────────────────────────────────────────
    }

    document.addEventListener("DOMContentLoaded", initAuthPage);
})();

