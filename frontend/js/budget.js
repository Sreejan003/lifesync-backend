/**
 * LifeSync - Budget Planner Module (js/budget.js)
 * -------------------------------------------------------------
 * INDEPENDENT MODULE: Tracks student finances, income, expenses,
 * runway, late-night safe, and bills.
 * Reports summary data directly to Dashboard.
 */

(function () {
    'use strict';

    let currentBudget = {
        monthlyBudget: 15000,
        runway: { sum: 20000, bufferPct: 15 },
        nightSafe: { limit: 500, spent: 0, locked: false, lastResetDate: new Date().toISOString().split('T')[0] },
        sharedGoal: { title: '', current: 0, target: 0, etaWeeks: 0 },
        transactions: [],
        bills: []
    };

    const budgetChangeListeners = [];

    function notifyChange() {
        budgetChangeListeners.forEach(fn => {
            try { fn(currentBudget); } catch (e) { console.error('Budget listener error:', e); }
        });
    }

    const BudgetModule = {
        init(user) {
            currentBudget = window.LifeSyncStorage.getBudget(user);

            // One-time migration: Import any existing standalone BudgetBuddy data into unified LifeSync storage
            try {
                const standaloneRaw = localStorage.getItem('budget_buddy_app_data');
                if (standaloneRaw) {
                    const standaloneData = JSON.parse(standaloneRaw);
                    let modified = false;

                    if (standaloneData.runway && (!currentBudget.runway || !currentBudget.runway.sum)) {
                        currentBudget.runway = { ...standaloneData.runway };
                        modified = true;
                    }
                    if (standaloneData.nightSafe && (!currentBudget.nightSafe || !currentBudget.nightSafe.limit)) {
                        currentBudget.nightSafe = { ...standaloneData.nightSafe };
                        modified = true;
                    }
                    if (standaloneData.sharedGoal && (!currentBudget.sharedGoal || !currentBudget.sharedGoal.target)) {
                        currentBudget.sharedGoal = { ...standaloneData.sharedGoal };
                        modified = true;
                    }
                    if (Array.isArray(standaloneData.bills) && standaloneData.bills.length > 0 && (!currentBudget.bills || currentBudget.bills.length === 0)) {
                        currentBudget.bills = standaloneData.bills;
                        modified = true;
                    }

                    if (modified) {
                        window.LifeSyncStorage.saveBudget(user, currentBudget);
                    }
                }
            } catch (e) {
                console.warn('Budget migration notice:', e);
            }

            return currentBudget;
        },

        getBudget() {
            return currentBudget;
        },

        onChange(callback) {
            if (typeof callback === 'function') {
                budgetChangeListeners.push(callback);
            }
        },

        addTransaction(user, txData) {
            const amount = Number(txData.amount);
            if (!amount || amount <= 0) throw new Error('Valid amount is required.');
            if (!txData.title || !txData.title.trim()) throw new Error('Title is required.');

            const newTx = {
                id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                title: txData.title.trim(),
                amount: amount,
                type: txData.type === 'income' ? 'income' : 'expense',
                category: txData.category || (txData.type === 'income' ? 'Allowance' : 'Food'),
                date: txData.date || new Date().toISOString().split('T')[0],
                description: (txData.description || '').trim()
            };

            currentBudget.transactions.unshift(newTx);
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
            return newTx;
        },

        deleteTransaction(user, txId) {
            currentBudget.transactions = currentBudget.transactions.filter(t => String(t.id) !== String(txId));
            if (window.LifeSyncStorage && window.LifeSyncStorage.deleteTransaction) {
                window.LifeSyncStorage.deleteTransaction(user, txId);
            } else {
                window.LifeSyncStorage.saveBudget(user, currentBudget);
            }
            notifyChange();
        },

        setMonthlyBudget(user, limit) {
            const num = Number(limit);
            if (num > 0) {
                currentBudget.monthlyBudget = num;
                window.LifeSyncStorage.saveBudget(user, currentBudget);
                this.syncWithBudgetBuddy();
                notifyChange();
            }
        },

        setNightSafeLimit(user, limit) {
            const num = Number(limit);
            if (num > 0) {
                if (!currentBudget.nightSafe) {
                    currentBudget.nightSafe = { limit: 500, spent: 0, locked: false, lastResetDate: new Date().toISOString().split('T')[0] };
                }
                currentBudget.nightSafe.limit = num;
                window.LifeSyncStorage.saveBudget(user, currentBudget);
                this.syncWithBudgetBuddy();
                notifyChange();
            }
        },

        setBudgetSettings(user, settings) {
            if (settings.monthlyBudget) {
                const mb = Number(settings.monthlyBudget);
                if (mb > 0) currentBudget.monthlyBudget = mb;
            }
            if (settings.nightSafeLimit) {
                const nsl = Number(settings.nightSafeLimit);
                if (nsl > 0) {
                    if (!currentBudget.nightSafe) {
                        currentBudget.nightSafe = { limit: 500, spent: 0, locked: false, lastResetDate: new Date().toISOString().split('T')[0] };
                    }
                    currentBudget.nightSafe.limit = nsl;
                }
            }
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            this.syncWithBudgetBuddy();
            notifyChange();
        },

        resetToDefault(user) {
            currentBudget = {
                monthlyBudget: 15000,
                runway: { sum: 20000, bufferPct: 15 },
                nightSafe: { limit: 500, spent: 0, locked: false, lastResetDate: new Date().toISOString().split('T')[0] },
                sharedGoal: { title: 'Emergency / Tech Fund', current: 4500, target: 8000, etaWeeks: 4 },
                transactions: [
                    {
                        id: 'tx_1',
                        title: 'Academic Scholarship Credit',
                        amount: 8000,
                        type: 'income',
                        category: 'Scholarship',
                        date: new Date().toISOString().split('T')[0],
                        description: 'Semester merit scholarship'
                    },
                    {
                        id: 'tx_2',
                        title: 'Campus Dining & Meal Plan',
                        amount: 2500,
                        type: 'expense',
                        category: 'Food',
                        date: new Date().toISOString().split('T')[0],
                        description: 'Monthly dining hall meal coupon bundle'
                    }
                ],
                bills: [
                    { id: 'b1', title: 'Wi-Fi Fiber Router', amount: 600, split: 3, date: 'Aug 22', paid: false },
                    { id: 'b2', title: 'Apartment Electricity', amount: 1200, split: 3, date: 'Aug 25', paid: false },
                    { id: 'b3', title: 'Cleaning & Maid Fund', amount: 300, split: 3, date: 'Sep 01', paid: false }
                ]
            };
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            this.syncWithBudgetBuddy();
            notifyChange();
            return currentBudget;
        },

        // --- BILLS ---
        addBill(user, billData) {
            const amount = Number(billData.amount);
            if (!amount || !billData.title) throw new Error('Valid bill title and amount are required.');

            const newBill = {
                id: 'b_' + Date.now(),
                title: billData.title.trim(),
                amount: amount,
                split: Math.max(1, Number(billData.split) || 1),
                date: billData.date || new Date().toISOString().split('T')[0],
                paid: false
            };

            currentBudget.bills.push(newBill);
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
            return newBill;
        },

        toggleBillPaid(user, billId) {
            const bill = currentBudget.bills.find(b => String(b.id) === String(billId));
            if (bill) {
                bill.paid = !bill.paid;
                window.LifeSyncStorage.saveBudget(user, currentBudget);
                notifyChange();
            }
        },

        deleteBill(user, billId) {
            currentBudget.bills = currentBudget.bills.filter(b => String(b.id) !== String(billId));
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
        },

        // --- NIGHT SAFE ---
        toggleNightSafeLock(user) {
            currentBudget.nightSafe.locked = !currentBudget.nightSafe.locked;
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
            return currentBudget.nightSafe.locked;
        },

        recordNightSpend(user, amount) {
            const val = Number(amount);
            if (!val || val <= 0) return false;
            if (currentBudget.nightSafe.locked) throw new Error('Wallet is locked! Protect your night budget 🌙');

            if (currentBudget.nightSafe.spent + val > currentBudget.nightSafe.limit) {
                throw new Error('This purchase would exceed tonight’s safety limit 🚫');
            }

            currentBudget.nightSafe.spent += val;
            // Also log as an expense transaction
            currentBudget.transactions.unshift({
                id: 'tx_ns_' + Date.now(),
                title: 'Late-Night Spend',
                amount: val,
                type: 'expense',
                category: 'Food',
                date: new Date().toISOString().split('T')[0],
                description: 'Late-night safe logged expenditure'
            });

            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
            return true;
        },

        // --- RUNWAY ---
        updateRunway(user, sum, bufferPct) {
            currentBudget.runway.sum = Math.max(0, Number(sum) || 0);
            currentBudget.runway.bufferPct = Math.max(0, Math.min(100, Number(bufferPct) || 15));
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            this.syncWithBudgetBuddy();
            notifyChange();
        },

        calculateRunwayValues(sum, bufferPct) {
            const total = Math.max(0, Number(sum) || 0);
            const buffer = Math.max(0, Math.min(100, Number(bufferPct) || 15));
            const usable = total * (1 - buffer / 100);
            const base = usable / 4;
            const weights = [1.08, 1.0, 0.92, 1.0];
            const raw = weights.map(w => base * w);
            const scale = usable / (raw.reduce((a, b) => a + b, 0) || 1);
            const values = raw.map(v => Math.round(v * scale));
            return { total, buffer, usable: Math.round(usable), base: Math.round(base), values };
        },

        // --- SHARED GOAL CONTRIBUTION ---
        addGoalContribution(user, amount, note) {
            const val = Number(amount);
            if (!val || val <= 0) throw new Error('Valid contribution amount is required.');
            if (!currentBudget.sharedGoal) {
                currentBudget.sharedGoal = { title: 'Emergency / Tech Fund', current: 0, target: 10000, etaWeeks: 6 };
            }
            currentBudget.sharedGoal.current = (currentBudget.sharedGoal.current || 0) + val;
            
            // Also log transaction
            currentBudget.transactions.unshift({
                id: 'tx_goal_' + Date.now(),
                title: `Goal Contribution: ${currentBudget.sharedGoal.title}`,
                amount: val,
                type: 'expense',
                category: 'Savings',
                date: new Date().toISOString().split('T')[0],
                description: (note || 'Added savings funds towards goal').trim()
            });

            window.LifeSyncStorage.saveBudget(user, currentBudget);
            this.syncWithBudgetBuddy();
            notifyChange();
            return currentBudget.sharedGoal;
        },

        // --- BUDGET REVIEW (Gamified streak & XP) ---
        reviewBudget(user) {
            const todayStr = new Date().toISOString().split('T')[0];
            let profile = window.ProfileModule ? window.ProfileModule.getProfile() : null;
            if (!profile) {
                profile = window.LifeSyncStorage.getProfile(user);
            }
            if (!profile.budgetStreak) profile.budgetStreak = 12;
            if (!profile.xp) profile.xp = 450;

            if (profile.lastBudgetReviewDate === todayStr) {
                return { reviewed: false, streak: profile.budgetStreak, xp: profile.xp, message: 'Already reviewed today! Keep it up 🔥' };
            }

            profile.budgetStreak += 1;
            profile.lastBudgetReviewDate = todayStr;
            profile.xp += 50;
            if (window.ProfileModule && window.ProfileModule.updateProfile) {
                window.ProfileModule.updateProfile(user, profile);
            } else {
                window.LifeSyncStorage.saveProfile(user, profile);
            }
            this.syncWithBudgetBuddy();
            notifyChange();
            return { reviewed: true, streak: profile.budgetStreak, xp: profile.xp, message: `Review completed! Streak: ${profile.budgetStreak} days 🔥 (+50 XP)` };
        },

        // --- PEER BENCHMARKS ---
        getBenchmarkData() {
            return [
                { name: 'Food & Dining', you: 1800, peer: 2200, category: 'Food' },
                { name: 'Transit & Commute', you: 700, peer: 950, category: 'Travel' },
                { name: 'Entertainment', you: 520, peer: 760, category: 'Entertainment' },
                { name: 'Study Materials', you: 900, peer: 800, category: 'Education' },
                { name: 'Shopping & Apparel', you: 640, peer: 980, category: 'Shopping' }
            ];
        },

        // --- TWO-WAY SYNC WITH STANDALONE BUDGETBUDDY ---
        syncWithBudgetBuddy() {
            try {
                const activeUser = window.AuthSystem && typeof window.AuthSystem.getCurrentUser === 'function' ? window.AuthSystem.getCurrentUser() : null;
                const activeName = (activeUser && (activeUser.username || activeUser.name)) || 'Student';
                const buddyData = {
                    profile: {
                        name: activeName,
                        streak: currentBudget.streak || 0,
                        lastReviewDate: null,
                        xp: (activeUser && activeUser.xp) || 0
                    },
                    runway: currentBudget.runway || { sum: 0, bufferPct: 15 },
                    nightSafe: currentBudget.nightSafe || { limit: 500, spent: 0, locked: false },
                    sharedGoal: currentBudget.sharedGoal || { title: '', current: 0, target: 0, etaWeeks: 0 },
                    bills: (currentBudget.bills || []).map(b => ({
                        id: b.id,
                        title: b.title,
                        amount: b.amount,
                        split: b.split || 1,
                        date: b.date,
                        paid: !!b.paid
                    }))
                };
                localStorage.setItem('budget_buddy_app_data', JSON.stringify(buddyData));
            } catch (e) {
                // ignore in constrained envs
            }
        },

        // --- SUMMARY REPORT (Exported directly to Dashboard) ---
        getSummary() {
            const now = new Date();
            const curMonth = String(now.getMonth() + 1).padStart(2, '0');
            const curYear = String(now.getFullYear());
            const curMonthPrefix = `${curYear}-${curMonth}`;

            let totalIncome = 0;
            let totalExpense = 0;
            let spentThisMonth = 0;
            const categorySpending = {};

            currentBudget.transactions.forEach(tx => {
                const amt = Number(tx.amount) || 0;
                if (tx.type === 'income') {
                    totalIncome += amt;
                } else {
                    totalExpense += amt;
                }
                if (tx.date && tx.date.startsWith(curMonthPrefix)) {
                    if (tx.type === 'expense') spentThisMonth += amt;
                }
                categorySpending[tx.category] = (categorySpending[tx.category] || 0) + amt;
            });

            const monthlyBudget = currentBudget.monthlyBudget || 15000;
            const remainingBudget = Math.max(0, monthlyBudget - spentThisMonth);
            const budgetUsagePct = Math.min(100, Math.round((spentThisMonth / monthlyBudget) * 100));
            const totalBalance = totalIncome - totalExpense;

            // Compute bills summary
            const bills = currentBudget.bills || [];
            const unpaidBills = bills.filter(b => !b.paid);
            const unpaidBillsTotalShare = unpaidBills.reduce((acc, b) => acc + Math.round(b.amount / (b.split || 1)), 0);
            const nextDueBill = unpaidBills.length > 0 ? unpaidBills[0] : null;

            return {
                totalIncome,
                totalExpense,
                totalBalance,
                monthlyBudget,
                spentThisMonth,
                remainingBudget,
                budgetUsagePct,
                isWarning: budgetUsagePct >= 80 && budgetUsagePct < 100,
                isExceeded: spentThisMonth > monthlyBudget,
                categorySpending,
                runway: currentBudget.runway || { sum: 20000, bufferPct: 15 },
                nightSafe: currentBudget.nightSafe || { limit: 500, spent: 0, locked: false },
                sharedGoal: currentBudget.sharedGoal || { title: '', current: 0, target: 0, etaWeeks: 0 },
                bills,
                unpaidBillsCount: unpaidBills.length,
                unpaidBillsTotalShare,
                nextDueBill,
                recentTransactions: currentBudget.transactions.slice(0, 5)
            };
        }
    };

    window.BudgetModule = BudgetModule;
})();
