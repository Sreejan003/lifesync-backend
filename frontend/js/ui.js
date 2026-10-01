/**
 * LifeSync - UI Renderer Module (js/ui.js)
 * -------------------------------------------------------------
 * Encapsulates DOM element caching, UI rendering, Toast notifications,
 * Modal toggling, and task item creation.
 */

(function () {
    'use strict';

    // Cache DOM Elements
    const elements = {
        taskInput: document.querySelector("#task_list"),
        taskContainer: document.querySelector("#taskContainer"),
        emptyState: document.querySelector("#emptyState"),
        pendingCount: document.querySelector("#pendingCount"),
        completedCount: document.querySelector("#completedCount"),
        totalCount: document.querySelector("#totalCount"),
        progressCircle: document.querySelector("#progressCircle"),
        progressPercent: document.querySelector("#progressPercent"),
        userNavArea: document.querySelector("#userNavArea"),
        tasksHeadingTitle: document.querySelector("#tasksHeadingTitle"),

        // Modals
        authModal: document.querySelector("#authModal"),
        tabSignIn: document.querySelector("#tabSignIn"),
        tabSignUp: document.querySelector("#tabSignUp"),
        signInForm: document.querySelector("#signInForm"),
        signUpForm: document.querySelector("#signUpForm"),
        authModalTitle: document.querySelector("#authModalTitle"),
        authModalSubtitle: document.querySelector("#authModalSubtitle"),
        authError: document.querySelector("#authError"),

        editUserModal: document.querySelector("#editUserModal"),
        editUserForm: document.querySelector("#editUserForm"),
        newUsernameInput: document.querySelector("#newUsernameInput"),
        editUserError: document.querySelector("#editUserError")
    };

    /**
     * Escapes HTML string to prevent XSS.
     */
    function escapeHtml(str) {
        return (str || '').replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // ==========================================
    // 1. TOAST NOTIFICATION SYSTEM
    // ==========================================

    function showToast(message, type = 'info') {
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;

        toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ==========================================
    // 2. HEADER & USER PROFILE RENDERER
    // ==========================================

    function renderUserHeader(user, callbacks = {}) {
        if (!elements.userNavArea) return;

        if (user) {
            const avatarDisplay = user.avatarLetter || user.username.charAt(0).toUpperCase();

            elements.userNavArea.innerHTML = `
                <div class="user-pill">
                    <div class="user-avatar">${avatarDisplay}</div>
                    <div class="user-details">
                        <span class="user-greeting">Signed in as</span>
                        <div class="user-name-wrapper">
                            <span class="user-name">${escapeHtml(user.username)}</span>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button id="btnEditUsername" class="btn-icon-action" title="Edit Username">✏️</button>
                        <button id="btnSignOut" class="btn-icon-action btn-icon-danger" title="Sign Out">🚪</button>
                    </div>
                </div>
            `;

            if (elements.tasksHeadingTitle) {
                elements.tasksHeadingTitle.innerText = `${user.username}'s Tasks`;
            }

            // Bind events for header buttons
            const btnEdit = document.querySelector("#btnEditUsername");
            const btnSignOut = document.querySelector("#btnSignOut");

            if (btnEdit && callbacks.onEditUsername) btnEdit.addEventListener("click", callbacks.onEditUsername);
            if (btnSignOut && callbacks.onSignOut) btnSignOut.addEventListener("click", callbacks.onSignOut);

        } else {
            elements.userNavArea.innerHTML = `
                <div class="auth-buttons-group">
                    <a href="auth.html" class="btn-auth-signin">
                        <span class="auth-icon">🔑</span> Sign In
                    </a>
                    <a href="auth.html?tab=signup" class="btn-auth-signup">
                        <span class="auth-icon">✨</span> Sign Up
                    </a>
                </div>
            `;

            if (elements.tasksHeadingTitle) {
                elements.tasksHeadingTitle.innerText = "Today's Tasks";
            }
        }
    }

    // ==========================================
    // 3. TASKS & STATISTICS RENDERER
    // ==========================================

    function renderTasks(tasks, callbacks = {}) {
        elements.taskContainer.innerHTML = "";

        if (!tasks || tasks.length === 0) {
            elements.emptyState.style.display = "block";
        } else {
            elements.emptyState.style.display = "none";
        }

        tasks.forEach(task => {
            const taskDiv = document.createElement("div");
            taskDiv.classList.add("task");
            if (task.completed) taskDiv.classList.add("completed");

            // Checkbox
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.classList.add("check");
            checkbox.checked = task.completed;

            // Task text
            const text = document.createElement("p");
            text.classList.add("text");
            text.innerText = task.text;

            // Delete button
            const deleteButton = document.createElement("button");
            deleteButton.classList.add("deleteop");
            deleteButton.innerHTML = "➖";

            // Event bindings
            checkbox.addEventListener("change", () => {
                if (callbacks.onToggleTask) callbacks.onToggleTask(task.id, checkbox.checked);
            });

            deleteButton.addEventListener("click", () => {
                if (callbacks.onDeleteTask) callbacks.onDeleteTask(task.id);
            });

            taskDiv.appendChild(checkbox);
            taskDiv.appendChild(text);
            taskDiv.appendChild(deleteButton);

            elements.taskContainer.appendChild(taskDiv);
        });

        updateStats(tasks);
    }

    function updateStats(tasks = []) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const pending = total - completed;

        elements.totalCount.innerText = total;
        elements.completedCount.innerText = completed;
        elements.pendingCount.innerText = pending;

        let percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        elements.progressPercent.innerText = percentage + "%";

        const degree = percentage * 3.6;
        elements.progressCircle.style.background = `conic-gradient(
            #7048e8 ${degree}deg,
            #e7e2f9 ${degree}deg
        )`;
    }

    // ==========================================
    // 4. MODAL MANAGEMENT
    // ==========================================

    function openAuthModal(tab = 'signin') {
        elements.authModal.classList.remove("hidden");
        hideAuthError();
        switchAuthTab(tab);
    }

    function closeAuthModal() {
        elements.authModal.classList.add("hidden");
        elements.signInForm.reset();
        elements.signUpForm.reset();
        hideAuthError();
    }

    function switchAuthTab(tab) {
        hideAuthError();
        if (tab === 'signin') {
            elements.tabSignIn.classList.add("active");
            elements.tabSignUp.classList.remove("active");
            elements.signInForm.classList.remove("hidden");
            elements.signUpForm.classList.add("hidden");
            elements.authModalTitle.innerText = "Welcome Back";
            elements.authModalSubtitle.innerText = "Sign in with your JWT credentials";
        } else {
            elements.tabSignUp.classList.add("active");
            elements.tabSignIn.classList.remove("active");
            elements.signUpForm.classList.remove("hidden");
            elements.signInForm.classList.add("hidden");
            elements.authModalTitle.innerText = "Create Account";
            elements.authModalSubtitle.innerText = "Get started with LifeSync task management";
        }
    }

    function showAuthError(msg) {
        elements.authError.innerText = msg;
        elements.authError.classList.remove("hidden");
    }

    function hideAuthError() {
        elements.authError.innerText = "";
        elements.authError.classList.add("hidden");
    }

    function openEditUserModal(currentUsername) {
        elements.newUsernameInput.value = currentUsername || "";
        hideEditUserError();
        elements.editUserModal.classList.remove("hidden");
    }

    function closeEditUserModal() {
        elements.editUserModal.classList.add("hidden");
        elements.editUserForm.reset();
        hideEditUserError();
    }

    function showEditUserError(msg) {
        elements.editUserError.innerText = msg;
        elements.editUserError.classList.remove("hidden");
    }

    function hideEditUserError() {
        elements.editUserError.innerText = "";
        elements.editUserError.classList.add("hidden");
    }

    // Expose UI Module globally
    window.UI = {
        elements,
        showToast,
        renderUserHeader,
        renderTasks,
        openAuthModal,
        closeAuthModal,
        switchAuthTab,
        showAuthError,
        hideAuthError,
        openEditUserModal,
        closeEditUserModal,
        showEditUserError,
        hideEditUserError
    };
})();
