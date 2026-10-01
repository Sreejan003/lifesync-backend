/**
 * LifeSync - Mental Wellness Module (js/wellness.js)
 * -------------------------------------------------------------
 * INDEPENDENT MODULE: Tracks daily mood check-ins, stress,
 * energy levels, and personal reflection journals.
 *
 * NOTE: Non-clinical, reflective self-care tool.
 * Reports summary data directly to Dashboard.
 */

(function () {
    'use strict';

    const MOOD_MAP = {
        happy: { emoji: '😄', name: 'Happy', score: 5, color: '#20b879' },
        good: { emoji: '🙂', name: 'Good', score: 4, color: '#7048e8' },
        okay: { emoji: '😐', name: 'Okay', score: 3, color: '#f5a623' },
        sad: { emoji: '😔', name: 'Sad', score: 2, color: '#6e6a7d' },
        stressed: { emoji: '😟', name: 'Stressed', score: 1, color: '#db4665' }
    };

    let wellnessState = {
        streak: 0,
        entries: []
    };

    const wellnessChangeListeners = [];

    function notifyChange() {
        wellnessChangeListeners.forEach(fn => {
            try { fn(wellnessState); } catch (e) { console.error('Wellness listener error:', e); }
        });
    }

    function getTodayString() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    const WellnessModule = {
        init(user) {
            wellnessState = window.LifeSyncStorage.getWellness(user);
            return wellnessState;
        },

        getWellness() {
            return wellnessState;
        },

        getMoodMap() {
            return MOOD_MAP;
        },

        onChange(callback) {
            if (typeof callback === 'function') {
                wellnessChangeListeners.push(callback);
            }
        },

        getTodayEntry() {
            const todayStr = getTodayString();
            return wellnessState.entries.find(e => e.date === todayStr) || null;
        },

        saveCheckIn(user, { mood, stress = 2, energy = 3, notes = '' }) {
            const moodInfo = MOOD_MAP[mood];
            if (!moodInfo) throw new Error('Please select a valid mood.');

            const todayStr = getTodayString();
            const existingIdx = wellnessState.entries.findIndex(e => e.date === todayStr);

            const entry = {
                date: todayStr,
                mood: mood,
                emoji: moodInfo.emoji,
                name: moodInfo.name,
                score: moodInfo.score,
                stress: Number(stress) || 2,
                energy: Number(energy) || 3,
                description: (notes || '').trim()
            };

            if (existingIdx !== -1) {
                wellnessState.entries[existingIdx] = entry;
            } else {
                wellnessState.entries.push(entry);
                wellnessState.streak = (wellnessState.streak || 0) + 1;
            }

            window.LifeSyncStorage.saveWellness(user, wellnessState);
            notifyChange();
            return entry;
        },

        getLast7Days() {
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const key = `${y}-${m}-${day}`;
                const entry = wellnessState.entries.find(e => e.date === key);
                days.push({
                    date: key,
                    dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                    entry: entry || null
                });
            }
            return days;
        },

        // --- SUMMARY REPORT (Exported directly to Dashboard) ---
        getSummary() {
            const today = this.getTodayEntry();
            const last7 = this.getLast7Days();
            const validEntries = last7.filter(d => d.entry).map(d => d.entry);

            let averageScore = 0;
            if (validEntries.length > 0) {
                const total = validEntries.reduce((sum, e) => sum + e.score, 0);
                averageScore = (total / validEntries.length).toFixed(1);
            }

            let reportMessage = 'Take a moment to check in with yourself today.';
            if (today) {
                if (today.score >= 4) {
                    reportMessage = 'Feeling positive today! Keep that momentum going 🌱';
                } else if (today.score === 3) {
                    reportMessage = 'Balanced day. Remember to take short mindful breaks.';
                } else {
                    reportMessage = 'Be kind to yourself today. Take rest when you need it 💜';
                }
            }

            return {
                todayEntry: today,
                todayMoodText: today ? `${today.emoji} ${today.name}` : 'Not logged yet',
                todayEmoji: today ? today.emoji : '💜',
                todayNotes: today ? today.description : '',
                streak: wellnessState.streak || 0,
                daysTracked: `${validEntries.length}/7`,
                averageScore: averageScore || '--',
                weeklyDays: last7,
                reportMessage
            };
        }
    };

    window.WellnessModule = WellnessModule;
})();
