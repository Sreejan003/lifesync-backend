/**
 * LifeSync - Derived Notification & Reminder System (js/notifications.js)
 * -------------------------------------------------------------
 * Automatically derives real notifications from active application state:
 * - Overdue tasks & tasks due today
 * - Upcoming exams & events
 * - Monthly budget alerts
 * - Daily wellness check-in prompts
 */

(function () {
    'use strict';

    function getTodayString() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    const NotificationsModule = {
        getNotifications() {
            const notifications = [];
            const todayStr = getTodayString();

            // 1. Task Reminders
            if (window.TasksModule) {
                const tasks = window.TasksModule.getTasks();
                tasks.forEach(t => {
                    if (t.status !== 'Completed' && t.dueDate) {
                        if (t.dueDate < todayStr) {
                            notifications.push({
                                id: 'notif_overdue_' + t.id,
                                type: 'danger',
                                icon: '🚨',
                                title: 'Overdue Task',
                                message: `"${t.title}" is overdue. Take action!`,
                                targetTab: 'tasks',
                                time: 'Overdue'
                            });
                        } else if (t.dueDate === todayStr) {
                            notifications.push({
                                id: 'notif_duetoday_' + t.id,
                                type: 'warning',
                                icon: '⚡',
                                title: 'Task Due Today',
                                message: `"${t.title}" is due before midnight.`,
                                targetTab: 'tasks',
                                time: 'Today'
                            });
                        }
                    }
                });
            }

            // 2. Calendar Event Reminders
            if (window.CalendarModule) {
                const schedule = window.CalendarModule.getUpcomingSchedule(2);
                schedule.forEach(item => {
                    if (item.itemType === 'event') {
                        const isExam = (item.category || '').toLowerCase() === 'exam';
                        notifications.push({
                            id: 'notif_evt_' + item.id,
                            type: isExam ? 'danger' : 'info',
                            icon: isExam ? '🎯' : '📅',
                            title: isExam ? 'Upcoming Exam' : 'Scheduled Event',
                            message: `${item.title} at ${item.time || 'scheduled time'}.`,
                            targetTab: 'calendar',
                            time: item.date === todayStr ? 'Today' : 'Tomorrow'
                        });
                    }
                });
            }

            // 3. Budget Alerts
            if (window.BudgetModule) {
                const summary = window.BudgetModule.getSummary();
                if (summary.isExceeded) {
                    notifications.push({
                        id: 'notif_budget_exceeded',
                        type: 'danger',
                        icon: '⚠️',
                        title: 'Budget Limit Exceeded',
                        message: `Monthly spending is ₹${summary.spentThisMonth.toLocaleString()} exceeding limit of ₹${summary.monthlyBudget.toLocaleString()}.`,
                        targetTab: 'budget',
                        time: 'Finance Alert'
                    });
                } else if (summary.isWarning) {
                    notifications.push({
                        id: 'notif_budget_warning',
                        type: 'warning',
                        icon: '💳',
                        title: 'Budget Alert (80%+)',
                        message: `You have utilized ${summary.budgetUsagePct}% of your monthly budget.`,
                        targetTab: 'budget',
                        time: 'Finance Alert'
                    });
                }
            }

            // 4. Wellness Check-in Reminder
            if (window.WellnessModule) {
                const todayEntry = window.WellnessModule.getTodayEntry();
                if (!todayEntry) {
                    notifications.push({
                        id: 'notif_wellness_prompt',
                        type: 'info',
                        icon: '💜',
                        title: 'Mindful Moment',
                        message: 'How are you feeling today? Complete your 30-second wellness check-in.',
                        targetTab: 'wellness',
                        time: 'Daily Self-Care'
                    });
                }
            }

            return notifications;
        }
    };

    window.NotificationsModule = NotificationsModule;
})();
