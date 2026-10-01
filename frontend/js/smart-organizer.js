/**
 * LifeSync - Smart Task Organizer (js/smart-organizer.js)
 * -------------------------------------------------------------
 * INTEGRATION ENGINE:
 * To-Do List (Tasks, Deadlines, Priority)
 * + Calendar & Reminders (Events, Exams, Classes)
 * = Smart Prioritized Task List -> Feeds Dashboard & Tasks View
 *
 * Correlates task deadlines, priority levels, and academic calendar
 * events (exams, classes, project reviews) into an intelligent urgency rank.
 */

(function () {
    'use strict';

    function getDaysDiff(dateStr) {
        if (!dateStr) return 999;
        const clean = String(dateStr).split('T')[0].trim();
        if (!clean) return 999;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const parts = clean.split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            const target = new Date(y, m, d);
            if (!isNaN(target.getTime())) {
                const diffMs = target.getTime() - today.getTime();
                return Math.round(diffMs / (1000 * 60 * 60 * 24));
            }
        }
        const target = new Date(clean + 'T00:00:00');
        if (isNaN(target.getTime())) return 999;
        const diffMs = target.getTime() - today.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    const SmartTaskOrganizer = {
        /**
         * Analyzes pending tasks alongside calendar events and returns
         * a smart prioritized task list ordered by real-world academic urgency.
         */
        getPrioritizedTasks() {
            const allTasks = window.TasksModule ? window.TasksModule.getTasks() : [];
            const activeTasks = allTasks.filter(t => t.status !== 'Completed');
            const allEvents = window.CalendarModule ? window.CalendarModule.getEvents() : [];

            // Find upcoming exams/classes within the next 4 days
            const upcomingAcademicEvents = allEvents.filter(e => {
                const diff = getDaysDiff(e.date);
                const isAcademic = ['exam', 'study', 'class', 'assignment'].includes((e.category || '').toLowerCase());
                return isAcademic && diff >= 0 && diff <= 4;
            });

            const scoredTasks = activeTasks.map(task => {
                let score = 0;
                let reasonTag = 'Normal Priority';
                let reasonType = 'info'; // 'danger', 'warning', 'exam', 'info'

                const daysDiff = getDaysDiff(task.dueDate);

                // 1. Deadline urgency scoring
                if (task.dueDate) {
                    if (daysDiff < 0) {
                        score += 120;
                        reasonTag = `🚨 Overdue (${Math.abs(daysDiff)}d ago)`;
                        reasonType = 'danger';
                    } else if (daysDiff === 0) {
                        score += 90;
                        reasonTag = '⚡ Due Today';
                        reasonType = 'danger';
                    } else if (daysDiff === 1) {
                        score += 70;
                        reasonTag = '⏰ Due Tomorrow';
                        reasonType = 'warning';
                    } else if (daysDiff <= 3) {
                        score += 45;
                        reasonTag = `📅 Due in ${daysDiff} days`;
                        reasonType = 'warning';
                    } else {
                        score += 20;
                        reasonTag = `Due in ${daysDiff} days`;
                        reasonType = 'info';
                    }
                } else {
                    score += 5;
                    reasonTag = 'No deadline set';
                    reasonType = 'info';
                }

                // 2. Base priority weighting
                if (task.priority === 'High') {
                    score += 35;
                } else if (task.priority === 'Medium') {
                    score += 20;
                } else {
                    score += 10;
                }

                // 3. Momentum bonus
                if (task.status === 'In Progress') {
                    score += 15;
                    if (reasonType === 'info') {
                        reasonTag = '⏳ In Progress';
                        reasonType = 'warning';
                    }
                }

                // 4. Calendar Integration: Boost tasks correlated with upcoming exams/classes
                const taskTitle = (task.title || '').toLowerCase();
                const taskDesc = (task.description || '').toLowerCase();
                const taskCat = (task.category || '').toLowerCase();

                // Find best matching academic event based on subject/keywords or exam relevance
                const matchedEvent = upcomingAcademicEvents.find(e => {
                    const eTitle = (e.title || '').toLowerCase();
                    const eCat = (e.category || '').toLowerCase();

                    // Extract subject keywords from event title (ignoring generic words)
                    const keywords = eTitle
                        .replace(/\b(exam|midterm|final|lecture|session|class|test|lab|review)\b/gi, '')
                        .split(/[\s,–—\-]+/)
                        .map(w => w.trim())
                        .filter(w => w.length >= 3);

                    // Check if task title or description matches any subject keyword
                    const subjectMatch = keywords.some(kw => taskTitle.includes(kw) || taskDesc.includes(kw));
                    if (subjectMatch) return true;

                    // Direct acronym match (e.g., CN -> Computer Networks, OS -> Operating Systems, DBMS -> Database)
                    if (taskTitle.includes('dbms') && eTitle.includes('dbms')) return true;
                    if (taskTitle.includes('os ') && (eTitle.includes('operating systems') || eTitle.includes('os'))) return true;
                    if (taskTitle.includes('cn ') && (eTitle.includes('computer networks') || eTitle.includes('cn'))) return true;

                    // If event is an Exam and task explicitly mentions exam/prep
                    if (eCat === 'exam' && (taskTitle.includes('exam') || taskTitle.includes('test') || taskTitle.includes('quiz') || taskTitle.includes('midterm'))) {
                        return true;
                    }

                    // For study/assignment tasks, match if due before or on the exam date
                    if (eCat === 'exam' && (taskCat === 'study' || taskCat === 'assignment')) {
                        const eventDiff = getDaysDiff(e.date);
                        if (daysDiff <= eventDiff && daysDiff >= 0) {
                            return true;
                        }
                    }

                    return false;
                });

                if (matchedEvent) {
                    score += 40;
                    const eventDays = getDaysDiff(matchedEvent.date);
                    const eventWhen = eventDays === 0 ? 'Today' : eventDays === 1 ? 'Tomorrow' : `in ${eventDays}d`;
                    const boostLabel = `🎯 Boost: ${matchedEvent.title} (${eventWhen})`;

                    if (daysDiff < 0) {
                        // Preserve overdue urgency
                        reasonTag = `🚨 Overdue (${Math.abs(daysDiff)}d) • ${boostLabel}`;
                        reasonType = 'danger';
                    } else if (daysDiff === 0) {
                        // Preserve due today urgency
                        reasonTag = `⚡ Due Today • ${boostLabel}`;
                        reasonType = 'danger';
                    } else {
                        reasonTag = boostLabel;
                        reasonType = 'exam';
                    }
                }

                return {
                    ...task,
                    smartScore: score,
                    reasonTag,
                    reasonType,
                    daysDiff
                };
            });

            // Sort descending by smartScore
            scoredTasks.sort((a, b) => b.smartScore - a.smartScore);
            return scoredTasks;
        },

        /**
         * Returns top N prioritized tasks specifically tailored for the Dashboard widget.
         */
        getTopPrioritizedTasks(limit = 4) {
            return this.getPrioritizedTasks().slice(0, limit);
        }
    };

    window.SmartTaskOrganizer = SmartTaskOrganizer;
})();
