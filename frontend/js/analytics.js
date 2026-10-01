/**
 * LifeSync - Analytics Engine (js/analytics.js)
 * -------------------------------------------------------------
 * Compiles real-time metrics across:
 * - Productivity & Task Performance
 * - Time Management & Deadlines
 * - Financial Health & Spending Breakdown
 * - Wellness Consistency & Mood Trends
 */

(function () {
    'use strict';

    const AnalyticsModule = {
        getComprehensiveMetrics() {
            // 1. Productivity Stats
            const taskStats = window.TasksModule ? window.TasksModule.getStats() : {
                total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0, completionRate: 0
            };

            const allTasks = window.TasksModule ? window.TasksModule.getTasks() : [];
            // Weekly completion breakdown (last 7 days)
            const weeklyProductivity = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayStr = d.toISOString().split('T')[0];
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

                const completedOnDay = allTasks.filter(t => 
                    t.status === 'Completed' && t.completedAt && t.completedAt.startsWith(dayStr)
                ).length;

                weeklyProductivity.push({
                    day: dayName,
                    date: dayStr,
                    count: completedOnDay
                });
            }

            // 2. Time Management Stats
            const upcomingSchedule = window.CalendarModule ? window.CalendarModule.getUpcomingSchedule(7) : [];
            const upcomingExams = upcomingSchedule.filter(i => (i.category || '').toLowerCase() === 'exam').length;
            const upcomingAssignments = upcomingSchedule.filter(i => (i.category || '').toLowerCase() === 'assignment').length;

            // 3. Finance Stats
            const budgetSummary = window.BudgetModule ? window.BudgetModule.getSummary() : {
                totalIncome: 0, totalExpense: 0, totalBalance: 0, monthlyBudget: 15000,
                spentThisMonth: 0, remainingBudget: 15000, budgetUsagePct: 0, categorySpending: {}
            };

            // 4. Wellness Stats
            const wellnessSummary = window.WellnessModule ? window.WellnessModule.getSummary() : {
                averageScore: '--', streak: 0, daysTracked: '0/7', weeklyDays: []
            };

            return {
                productivity: {
                    ...taskStats,
                    weeklyTrend: weeklyProductivity
                },
                timeManagement: {
                    upcomingCount: upcomingSchedule.length,
                    upcomingExams,
                    upcomingAssignments,
                    overdueDeadlines: taskStats.overdue,
                    schedule: upcomingSchedule
                },
                finance: budgetSummary,
                wellness: wellnessSummary
            };
        }
    };

    window.AnalyticsModule = AnalyticsModule;
})();
