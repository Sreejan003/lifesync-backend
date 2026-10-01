/**
 * LifeSync - Student Profile & Preferences Module (js/profile.js)
 * -------------------------------------------------------------
 * Manages student academic details, identity, and app preferences.
 */

(function () {
    'use strict';

    let currentProfile = null;

    const profileChangeListeners = [];

    function notifyChange() {
        profileChangeListeners.forEach(fn => {
            try { fn(currentProfile); } catch (e) { console.error('Profile listener error:', e); }
        });
    }

    const ProfileModule = {
        init(user) {
            currentProfile = window.LifeSyncStorage.getProfile(user);
            // Ensure username matches current AuthSystem user
            if (user && user.username) {
                currentProfile.name = user.username;
                currentProfile.email = user.email;
            }
            return currentProfile;
        },

        getProfile() {
            return currentProfile;
        },

        onChange(callback) {
            if (typeof callback === 'function') {
                profileChangeListeners.push(callback);
            }
        },

        updateProfile(user, data) {
            if (!currentProfile) currentProfile = window.LifeSyncStorage.getProfile(user);

            if (data.name && data.name.trim()) {
                currentProfile.name = data.name.trim();
                // Sync display name with AuthSystem
                if (window.AuthSystem && window.AuthSystem.updateUsername) {
                    try {
                        window.AuthSystem.updateUsername(currentProfile.name);
                    } catch (e) {
                        console.warn('AuthSystem username sync note:', e);
                    }
                }
            }

            if (data.university !== undefined) currentProfile.university = data.university.trim();
            if (data.major !== undefined) currentProfile.major = data.major.trim();
            if (data.yearSemester !== undefined) currentProfile.yearSemester = data.yearSemester.trim();
            if (data.studentId !== undefined) currentProfile.studentId = data.studentId.trim();
            if (data.currency !== undefined) currentProfile.currency = data.currency;
            if (data.defaultView !== undefined) currentProfile.defaultView = data.defaultView;
            if (data.notificationsEnabled !== undefined) currentProfile.notificationsEnabled = Boolean(data.notificationsEnabled);
            if (data.budgetStreak !== undefined) currentProfile.budgetStreak = data.budgetStreak;
            if (data.lastBudgetReviewDate !== undefined) currentProfile.lastBudgetReviewDate = data.lastBudgetReviewDate;
            if (data.xp !== undefined) currentProfile.xp = data.xp;

            window.LifeSyncStorage.saveProfile(user, currentProfile);
            notifyChange();
            return currentProfile;
        }
    };

    window.ProfileModule = ProfileModule;
})();
