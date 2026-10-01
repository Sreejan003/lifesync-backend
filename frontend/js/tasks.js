/**
 * LifeSync - Tasks Module (js/tasks.js)
 * -------------------------------------------------------------
 * Manages task list data, filtering, sorting, status changes,
 * and notifies listeners when tasks change.
 */

(function () {
    'use strict';

    let currentTasks = [];
    let filterStatus = 'all';
    let filterCategory = 'all';
    let filterPriority = 'all';
    let searchQuery = '';
    let sortCriteria = 'deadline'; // 'deadline', 'priority', 'newest'

    const taskChangeListeners = [];

    function notifyChange() {
        taskChangeListeners.forEach(fn => {
            try { fn(currentTasks); } catch (e) { console.error('Task listener error:', e); }
        });
    }

    const TasksModule = {
        init(user) {
            currentTasks = window.LifeSyncStorage.getTasks(user);
            return currentTasks;
        },

        getTasks() {
            return currentTasks;
        },

        onChange(callback) {
            if (typeof callback === 'function') {
                taskChangeListeners.push(callback);
            }
        },

        addTask(user, taskData) {
            if (!taskData.title || !taskData.title.trim()) {
                throw new Error('Task title is required.');
            }

            const newTask = {
                id: 'tsk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                title: taskData.title.trim(),
                description: (taskData.description || '').trim(),
                dueDate: taskData.dueDate || '',
                priority: taskData.priority || 'Medium',
                category: taskData.category || 'Study',
                status: taskData.status || 'Pending',
                createdAt: new Date().toISOString(),
                completedAt: taskData.status === 'Completed' ? new Date().toISOString() : null
            };

            currentTasks.unshift(newTask);
            window.LifeSyncStorage.saveTasks(user, currentTasks);
            notifyChange();
            return newTask;
        },

        updateTask(user, taskId, updates) {
            const task = currentTasks.find(t => String(t.id) === String(taskId));
            if (!task) throw new Error('Task not found.');

            if (updates.title !== undefined) task.title = updates.title.trim();
            if (updates.description !== undefined) task.description = updates.description.trim();
            if (updates.dueDate !== undefined) task.dueDate = updates.dueDate;
            if (updates.priority !== undefined) task.priority = updates.priority;
            if (updates.category !== undefined) task.category = updates.category;
            if (updates.status !== undefined) {
                task.status = updates.status;
                if (updates.status === 'Completed' && !task.completedAt) {
                    task.completedAt = new Date().toISOString();
                } else if (updates.status !== 'Completed') {
                    task.completedAt = null;
                }
            }

            window.LifeSyncStorage.saveTasks(user, currentTasks);
            if (window.LifeSyncStorage && window.LifeSyncStorage.saveTask) {
                window.LifeSyncStorage.saveTask(user, task);
            }
            notifyChange();
            return task;
        },

        toggleComplete(user, taskId) {
            const task = currentTasks.find(t => String(t.id) === String(taskId));
            if (!task) return null;

            if (task.status === 'Completed') {
                task.status = 'Pending';
                task.completedAt = null;
            } else {
                task.status = 'Completed';
                task.completedAt = new Date().toISOString();
            }

            window.LifeSyncStorage.saveTasks(user, currentTasks);
            if (window.LifeSyncStorage && window.LifeSyncStorage.saveTask) {
                window.LifeSyncStorage.saveTask(user, task);
            }
            notifyChange();
            return task;
        },

        deleteTask(user, taskId) {
            currentTasks = currentTasks.filter(t => String(t.id) !== String(taskId));
            window.LifeSyncStorage.saveTasks(user, currentTasks);
            if (window.LifeSyncStorage && window.LifeSyncStorage.deleteTask) {
                window.LifeSyncStorage.deleteTask(user, taskId);
            }
            notifyChange();
        },

        deleteAllTasks(user) {
            currentTasks = [];
            window.LifeSyncStorage.saveTasks(user, currentTasks);
            notifyChange();
        },

        getFilteredAndSortedTasks() {
            let list = [...currentTasks];

            // Filter by search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                list = list.filter(t => 
                    (t.title || '').toLowerCase().includes(q) ||
                    (t.description || '').toLowerCase().includes(q) ||
                    (t.category || '').toLowerCase().includes(q) ||
                    (t.priority || '').toLowerCase().includes(q) ||
                    (t.status || '').toLowerCase().includes(q)
                );
            }

            // Filter by Status
            if (filterStatus !== 'all') {
                if (filterStatus === 'overdue') {
                    const todayStr = new Date().toISOString().split('T')[0];
                    list = list.filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate < todayStr);
                } else {
                    list = list.filter(t => t.status.toLowerCase() === filterStatus.toLowerCase());
                }
            }

            // Filter by Category
            if (filterCategory !== 'all') {
                list = list.filter(t => t.category.toLowerCase() === filterCategory.toLowerCase());
            }

            // Filter by Priority
            if (filterPriority !== 'all') {
                list = list.filter(t => t.priority.toLowerCase() === filterPriority.toLowerCase());
            }

            // Sort
            const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
            list.sort((a, b) => {
                if (sortCriteria === 'priority') {
                    return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
                } else if (sortCriteria === 'newest') {
                    return new Date(b.createdAt) - new Date(a.createdAt);
                } else {
                    // Deadline
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return a.dueDate.localeCompare(b.dueDate);
                }
            });

            return list;
        },

        setFilters({ status, category, priority, query, sort }) {
            if (status !== undefined) filterStatus = status;
            if (category !== undefined) filterCategory = category;
            if (priority !== undefined) filterPriority = priority;
            if (query !== undefined) searchQuery = query;
            if (sort !== undefined) sortCriteria = sort;
        },

        getStats() {
            const todayStr = new Date().toISOString().split('T')[0];
            const total = currentTasks.length;
            const completed = currentTasks.filter(t => t.status === 'Completed').length;
            const inProgress = currentTasks.filter(t => t.status === 'In Progress').length;
            const pending = currentTasks.filter(t => t.status === 'Pending').length;
            const overdue = currentTasks.filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate < todayStr).length;
            const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

            return {
                total,
                completed,
                inProgress,
                pending,
                overdue,
                completionRate
            };
        }
    };

    window.TasksModule = TasksModule;
})();
