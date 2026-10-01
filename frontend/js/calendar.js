/**
 * LifeSync - Calendar & Reminders Module (js/calendar.js)
 * -------------------------------------------------------------
 * Displays schedule, events, exams, and merges tasks with due dates.
 */

(function () {
    'use strict';

    let currentEvents = [];
    let activeDate = new Date();
    let selectedDate = new Date();

    const eventChangeListeners = [];

    function notifyChange() {
        eventChangeListeners.forEach(fn => {
            try { fn(currentEvents); } catch (e) { console.error('Calendar listener error:', e); }
        });
    }

    function formatDateStr(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const CalendarModule = {
        init(user) {
            currentEvents = window.LifeSyncStorage.getEvents(user);
            return currentEvents;
        },

        getEvents() {
            return currentEvents;
        },

        onChange(callback) {
            if (typeof callback === 'function') {
                eventChangeListeners.push(callback);
            }
        },

        addEvent(user, eventData) {
            if (!eventData.title || !eventData.date) {
                throw new Error('Event title and date are required.');
            }

            const newEvent = {
                id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                title: eventData.title.trim(),
                date: eventData.date,
                time: eventData.time || '09:00',
                category: eventData.category || 'Study',
                priority: eventData.priority || 'Medium',
                description: (eventData.description || '').trim(),
                hasReminder: Boolean(eventData.hasReminder)
            };

            currentEvents.push(newEvent);
            window.LifeSyncStorage.saveEvents(user, currentEvents);
            notifyChange();
            return newEvent;
        },

        updateEvent(user, eventId, updates) {
            const ev = currentEvents.find(e => String(e.id) === String(eventId));
            if (!ev) throw new Error('Event not found.');

            if (updates.title !== undefined) ev.title = updates.title.trim();
            if (updates.date !== undefined) ev.date = updates.date;
            if (updates.time !== undefined) ev.time = updates.time;
            if (updates.category !== undefined) ev.category = updates.category;
            if (updates.priority !== undefined) ev.priority = updates.priority;
            if (updates.description !== undefined) ev.description = updates.description.trim();
            if (updates.hasReminder !== undefined) ev.hasReminder = Boolean(updates.hasReminder);

            window.LifeSyncStorage.saveEvents(user, currentEvents);
            notifyChange();
            return ev;
        },

        deleteEvent(user, eventId) {
            currentEvents = currentEvents.filter(e => String(e.id) !== String(eventId));
            if (window.LifeSyncStorage && window.LifeSyncStorage.deleteEvent) {
                window.LifeSyncStorage.deleteEvent(user, eventId);
            } else {
                window.LifeSyncStorage.saveEvents(user, currentEvents);
            }
            notifyChange();
        },

        getActiveDate() {
            return activeDate;
        },

        getSelectedDate() {
            return selectedDate;
        },

        setSelectedDate(date) {
            selectedDate = new Date(date);
        },

        nextMonth() {
            activeDate.setMonth(activeDate.getMonth() + 1);
        },

        prevMonth() {
            activeDate.setMonth(activeDate.getMonth() - 1);
        },

        resetToToday() {
            activeDate = new Date();
            selectedDate = new Date();
        },

        // Gets all scheduled items (calendar events + task deadlines) for a specific date YYYY-MM-DD
        getItemsForDate(dateStr) {
            const events = currentEvents.filter(e => e.date === dateStr).map(e => ({
                ...e,
                itemType: 'event'
            }));

            const allTasks = window.TasksModule ? window.TasksModule.getTasks() : [];
            const taskDeadlines = allTasks.filter(t => t.dueDate === dateStr).map(t => ({
                id: t.id,
                title: t.title,
                date: t.dueDate,
                time: 'Due 23:59',
                category: t.category,
                priority: t.priority,
                description: t.description,
                status: t.status,
                itemType: 'task'
            }));

            return [...events, ...taskDeadlines];
        },

        // Gets upcoming events & deadlines for the next N days
        getUpcomingSchedule(daysAhead = 7) {
            const today = new Date();
            const todayStr = formatDateStr(today);
            const future = new Date();
            future.setDate(today.getDate() + daysAhead);
            const futureStr = formatDateStr(future);

            const events = currentEvents.filter(e => e.date >= todayStr && e.date <= futureStr).map(e => ({
                ...e,
                itemType: 'event'
            }));

            const allTasks = window.TasksModule ? window.TasksModule.getTasks() : [];
            const tasks = allTasks.filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= futureStr).map(t => ({
                id: t.id,
                title: t.title,
                date: t.dueDate,
                time: 'Deadline',
                category: t.category,
                priority: t.priority,
                status: t.status,
                itemType: 'task'
            }));

            const merged = [...events, ...tasks];
            merged.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
            return merged;
        },

        // Category breakdown of upcoming commitments
        getTodaySummary() {
            const todayStr = formatDateStr(new Date());
            const items = this.getItemsForDate(todayStr);

            let study = 0;
            let assignment = 0;
            let exam = 0;
            let other = 0;

            items.forEach(item => {
                const cat = (item.category || '').toLowerCase();
                if (cat === 'study' || cat === 'class') study++;
                else if (cat === 'assignment') assignment++;
                else if (cat === 'exam') exam++;
                else other++;
            });

            return {
                total: items.length,
                study,
                assignment,
                exam,
                other,
                items
            };
        }
    };

    window.CalendarModule = CalendarModule;
})();
