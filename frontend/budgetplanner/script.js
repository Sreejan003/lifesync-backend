// ==========================================
// BUDGETBUDDY LOCALSTORAGE BACKEND SERVICE
// ==========================================

const BACKEND_KEY = "budget_buddy_app_data";

const DEFAULT_STATE = {
  profile: {
    name: "Student",
    streak: 12,
    lastReviewDate: null,
    xp: 450
  },
  runway: {
    sum: 18000,
    bufferPct: 15
  },
  nightSafe: {
    limit: 350,
    spent: 112,
    locked: false,
    lastResetDate: new Date().toISOString().split("T")[0],
    score: 92
  },
  sharedGoal: {
    title: "Emergency deposit",
    current: 6400,
    target: 10000,
    etaWeeks: 6
  },
  bills: [
    { id: "b1", title: "Wi-Fi", amount: 600, split: 3, date: "Aug 22", paid: false },
    { id: "b2", title: "Electricity", amount: 1200, split: 3, date: "Aug 25", paid: false },
    { id: "b3", title: "Cleaning fund", amount: 300, split: 3, date: "Sep 01", paid: false }
  ]
};

class BudgetBackend {
  static get() {
    try {
      const stored = localStorage.getItem(BACKEND_KEY);
      if (!stored) {
        this.save(DEFAULT_STATE);
        return DEFAULT_STATE;
      }
      const data = JSON.parse(stored);
      // Fallback keys if schema updated
      return {
        profile: { ...DEFAULT_STATE.profile, ...(data.profile || {}) },
        runway: { ...DEFAULT_STATE.runway, ...(data.runway || {}) },
        nightSafe: { ...DEFAULT_STATE.nightSafe, ...(data.nightSafe || {}) },
        sharedGoal: { ...DEFAULT_STATE.sharedGoal, ...(data.sharedGoal || {}) },
        bills: Array.isArray(data.bills) ? data.bills : DEFAULT_STATE.bills
      };
    } catch (e) {
      console.error("Backend load error, using default state", e);
      return DEFAULT_STATE;
    }
  }

  static save(data) {
    try {
      localStorage.setItem(BACKEND_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Backend save error", e);
    }
  }

  static reset() {
    localStorage.removeItem(BACKEND_KEY);
    this.save(DEFAULT_STATE);
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function money(number) {
  return "₹" + Math.round(Number(number) || 0).toLocaleString("en-IN");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// ==========================================
// TAB NAVIGATION
// ==========================================

const navButtons = document.querySelectorAll(".nav-btn");
const panels = document.querySelectorAll(".tab-panel");

function activateTab(tab) {
  panels.forEach(panel => {
    panel.classList.toggle("active", panel.id === tab);
  });

  navButtons.forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("nav-active", active);

    if (!active) {
      button.classList.add("text-slate-600", "dark:text-slate-300");
    } else {
      button.classList.remove("text-slate-600", "dark:text-slate-300");
    }
  });

  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop");
  if (sidebar) sidebar.classList.add("-translate-x-full");
  if (backdrop) backdrop.classList.add("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

navButtons.forEach(button => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

document.querySelectorAll(".nav-jump").forEach(button => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

// ==========================================
// MOBILE SIDEBAR & DARK MODE
// ==========================================

const menuBtn = document.getElementById("menuBtn");
const backdrop = document.getElementById("backdrop");
const sidebar = document.getElementById("sidebar");

if (menuBtn) {
  menuBtn.onclick = () => {
    if (sidebar) sidebar.classList.remove("-translate-x-full");
    if (backdrop) backdrop.classList.remove("hidden");
  };
}

if (backdrop) {
  backdrop.onclick = () => {
    if (sidebar) sidebar.classList.add("-translate-x-full");
    if (backdrop) backdrop.classList.add("hidden");
  };
}

const savedTheme = localStorage.getItem("budget-theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

const darkToggle = document.getElementById("darkToggle");
if (darkToggle) {
  darkToggle.onclick = () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
      "budget-theme",
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  };
}

// ==========================================
// CORE RENDERERS & DATA BINDING
// ==========================================

function renderProfile() {
  const state = BudgetBackend.get();
  const profile = state.profile;

  const greetingName = document.getElementById("greetingName");
  if (greetingName) greetingName.textContent = profile.name;

  const profileNameInput = document.getElementById("profileNameInput");
  if (profileNameInput) profileNameInput.value = profile.name;

  const dashStreakVal = document.getElementById("dashStreakVal");
  if (dashStreakVal) dashStreakVal.textContent = `${profile.streak} 🔥`;

  const sidebarStreakVal = document.getElementById("sidebarStreakVal");
  if (sidebarStreakVal) {
    sidebarStreakVal.innerHTML = `${profile.streak} <span class="text-base">days</span>`;
  }

  const sidebarStreakProgress = document.getElementById("sidebarStreakProgress");
  if (sidebarStreakProgress) {
    const pct = Math.min(100, Math.round((profile.streak / 30) * 100));
    sidebarStreakProgress.style.width = pct + "%";
  }

  const currentDateStr = document.getElementById("currentDateStr");
  if (currentDateStr) {
    const now = new Date();
    const options = { weekday: "long", day: "numeric", month: "long" };
    currentDateStr.textContent = now.toLocaleDateString("en-IN", options);
  }
}

function calculateRunwayValues(sum, buffer) {
  const usable = Math.max(0, sum) * (1 - buffer / 100);
  const base = usable / 4;
  const weights = [1.08, 1.0, 0.92, 1.0];
  const raw = weights.map(w => base * w);
  const scale = usable / (raw.reduce((a, b) => a + b, 0) || 1);
  const values = raw.map(v => v * scale);

  return { usable, base, values };
}

function renderRunwayUI(saveToBackend = false) {
  const sumInput = document.getElementById("sumInput");
  const bufferRange = document.getElementById("bufferRange");

  if (!sumInput || !bufferRange) return;

  const sum = Math.max(0, Number(sumInput.value) || 0);
  const buffer = Number(bufferRange.value) || 0;

  const { base, values } = calculateRunwayValues(sum, buffer);

  const bufferLabel = document.getElementById("bufferLabel");
  const monthlyCap = document.getElementById("monthlyCap");
  const runwayTotal = document.getElementById("runwayTotal");
  const dashRunwayTotalVal = document.getElementById("dashRunwayTotalVal");
  const monthBars = document.getElementById("monthBars");
  const dashMonthBars = document.getElementById("dashMonthBars");

  if (bufferLabel) bufferLabel.textContent = buffer + "%";
  if (monthlyCap) monthlyCap.textContent = money(base);
  if (runwayTotal) runwayTotal.textContent = money(sum);
  if (dashRunwayTotalVal) {
    dashRunwayTotalVal.innerHTML = `${money(sum)} <span class="text-sm font-medium text-emerald-300">secured</span>`;
  }

  const months = ["Sep", "Oct", "Nov", "Dec"];
  const maxVal = Math.max(...values, 1);

  const barsHTML = values.map((val, idx) => {
    const heightPct = Math.max(18, Math.round((val / maxVal) * 100));
    return `
      <div class="flex flex-col justify-end h-full">
        <div class="text-center text-xs text-slate-400 mb-2">
          ${money(val)}
        </div>
        <div
          class="rounded-t-xl bg-gradient-to-t from-violet-600 to-fuchsia-400"
          style="height:${heightPct}%">
        </div>
        <div class="text-xs mt-2 text-center text-slate-400">
          ${months[idx]}
        </div>
      </div>
    `;
  }).join("");

  if (monthBars) monthBars.innerHTML = barsHTML;

  const dashBarsHTML = values.map((val, idx) => {
    const heightPct = Math.max(25, Math.round((val / maxVal) * 100));
    return `
      <div>
        <div class="h-28 rounded-xl bg-violet-500/30 border border-violet-300/20 relative overflow-hidden">
          <div class="absolute bottom-0 w-full bg-violet-500 transition-all duration-300" style="height:${heightPct}%"></div>
        </div>
        <div class="text-xs mt-2 text-slate-300 text-center">${months[idx]}</div>
      </div>
    `;
  }).join("");

  if (dashMonthBars) dashMonthBars.innerHTML = dashBarsHTML;

  if (saveToBackend) {
    const state = BudgetBackend.get();
    state.runway.sum = sum;
    state.runway.bufferPct = buffer;
    BudgetBackend.save(state);
    renderDashboard();
  }
}

function initRunwayInputs() {
  const state = BudgetBackend.get();
  const sumInput = document.getElementById("sumInput");
  const bufferRange = document.getElementById("bufferRange");

  if (sumInput) sumInput.value = state.runway.sum;
  if (bufferRange) bufferRange.value = state.runway.bufferPct;

  if (sumInput) {
    sumInput.addEventListener("input", () => renderRunwayUI(true));
  }
  if (bufferRange) {
    bufferRange.addEventListener("input", () => renderRunwayUI(true));
  }

  renderRunwayUI(false);
}

function renderNightSafe() {
  const state = BudgetBackend.get();
  const night = state.nightSafe;

  const nightAmount = document.getElementById("nightAmount");
  const nightBar = document.getElementById("nightBar");
  const lockIcon = document.getElementById("lockIcon");
  const lockBtn = document.getElementById("lockBtn");
  const nightLimitInput = document.getElementById("nightLimitInput");

  const remaining = Math.max(0, night.limit - night.spent);
  const spentPct = Math.min(100, (night.spent / night.limit) * 100);

  if (nightAmount) nightAmount.textContent = money(remaining);
  if (nightBar) nightBar.style.width = spentPct + "%";
  if (lockIcon) lockIcon.textContent = night.locked ? "🔒" : "🔓";
  if (lockBtn) {
    lockBtn.textContent = night.locked ? "🔓 Unlock wallet" : "🔒 Lock wallet";
  }
  if (nightLimitInput) nightLimitInput.value = night.limit;
}

function toggleLock() {
  const state = BudgetBackend.get();
  state.nightSafe.locked = !state.nightSafe.locked;
  BudgetBackend.save(state);

  showToast(
    state.nightSafe.locked
      ? "Wallet locked 🔒 No more late-night spending."
      : "Wallet unlocked 🔓"
  );

  renderNightSafe();
}

function nightSpend(amount) {
  const state = BudgetBackend.get();
  const night = state.nightSafe;

  if (night.locked) {
    showToast("Wallet is locked. Tomorrow-you says thanks! 🌙");
    return;
  }

  if (night.spent + amount > night.limit) {
    showToast("That would break tonight's limit 🚫");
    return;
  }

  night.spent += amount;
  BudgetBackend.save(state);

  renderNightSafe();
  renderDashboard();

  showToast(`₹${amount} spent. ${money(night.limit - night.spent)} left.`);
}

function splitBill() {
  const bill = Number(document.getElementById("bill").value) || 0;
  const people = Math.max(1, Number(document.getElementById("people").value) || 1);

  const splitResult = document.getElementById("splitResult");
  if (splitResult) splitResult.textContent = money(bill / people);

  showToast("Bill split updated ✓");
}

function renderSharedGoal() {
  const state = BudgetBackend.get();
  const goal = state.sharedGoal;

  const current = Number(goal.current) || 0;
  const target = Number(goal.target) || 10000;
  const pct = Math.min(100, Math.round((current / target) * 100));
  const remaining = Math.max(0, target - current);

  const goalText = document.getElementById("goalText");
  const goalProgressBar = document.getElementById("goalProgressBar");
  const goalPctText = document.getElementById("goalPctText");
  const goalRemainingText = document.getElementById("goalRemainingText");
  const goalEtaText = document.getElementById("goalEtaText");

  if (goalText) goalText.textContent = `${money(current)} / ${money(target)}`;
  if (goalProgressBar) goalProgressBar.style.width = pct + "%";
  if (goalPctText) goalPctText.textContent = pct + "%";
  if (goalRemainingText) {
    goalRemainingText.textContent = remaining >= 1000 ? `₹${(remaining/1000).toFixed(1)}k` : money(remaining);
  }
  if (goalEtaText) goalEtaText.textContent = `${goal.etaWeeks || 6} weeks`;
}

function renderBills() {
  const state = BudgetBackend.get();
  const bills = state.bills || [];
  const listContainer = document.getElementById("upcomingBillsList");

  if (!listContainer) return;

  if (bills.length === 0) {
    listContainer.innerHTML = `
      <div class="col-span-3 p-6 text-center text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        No upcoming bills. Click "+ Add bill" to create one!
      </div>
    `;
    return;
  }

  listContainer.innerHTML = bills.map(bill => {
    const userShare = Math.round(bill.amount / (bill.split || 1));
    const paidClass = bill.paid ? "line-through text-slate-400 opacity-60" : "";
    const badgeColor = bill.paid
      ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/10"
      : "text-amber-600 bg-amber-100 dark:bg-amber-500/10";

    return `
      <div class="p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col justify-between ${paidClass}">
        <div>
          <div class="flex justify-between items-center text-xs text-slate-400">
            <span>${bill.date}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}">
              ${bill.paid ? "PAID" : "PENDING"}
            </span>
          </div>
          <b class="block mt-1 text-base">${bill.title}</b>
          <span class="text-sm font-semibold text-violet-600 dark:text-violet-400">
            ₹${userShare} share <span class="text-xs text-slate-400">(${money(bill.amount)} split ${bill.split} ways)</span>
          </span>
        </div>
        <div class="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
          <button onclick="toggleBillPaid('${bill.id}')" class="text-xs font-bold ${bill.paid ? 'text-slate-500 hover:text-slate-700 dark:hover:text-white' : 'text-emerald-600 hover:text-emerald-700'} transition">
            ${bill.paid ? '↩ Mark Pending' : '✓ Mark Paid'}
          </button>
          <button onclick="deleteBill('${bill.id}')" class="text-xs font-bold text-red-500 hover:text-red-700 transition">
            ✕ Delete
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function toggleBillPaid(id) {
  const state = BudgetBackend.get();
  const bill = state.bills.find(b => b.id === id);
  if (bill) {
    bill.paid = !bill.paid;
    BudgetBackend.save(state);
    renderBills();
    renderDashboard();
    showToast(bill.paid ? `Marked "${bill.title}" as paid! ✓` : `Marked "${bill.title}" as pending.`);
  }
}

function deleteBill(id) {
  const state = BudgetBackend.get();
  state.bills = state.bills.filter(b => b.id !== id);
  BudgetBackend.save(state);
  renderBills();
  renderDashboard();
  showToast("Bill removed.");
}

function renderDashboard() {
  const state = BudgetBackend.get();
  const { base } = calculateRunwayValues(state.runway.sum, state.runway.bufferPct);

  // Spent this month = nightSafe.spent + user's paid bill shares
  const paidBillsShare = state.bills
    .filter(b => b.paid)
    .reduce((sum, b) => sum + Math.round(b.amount / b.split), 0);

  const spentThisMonth = state.nightSafe.spent + paidBillsShare;

  // Unpaid bills due user share
  const billsDueShare = state.bills
    .filter(b => !b.paid)
    .reduce((sum, b) => sum + Math.round(b.amount / b.split), 0);

  const availableBalance = Math.max(0, base - spentThisMonth);

  const dashBalanceVal = document.getElementById("dashBalanceVal");
  const dashSpentVal = document.getElementById("dashSpentVal");
  const dashBillsDueVal = document.getElementById("dashBillsDueVal");

  if (dashBalanceVal) dashBalanceVal.textContent = money(availableBalance);
  if (dashSpentVal) dashSpentVal.textContent = money(spentThisMonth);
  if (dashBillsDueVal) dashBillsDueVal.textContent = money(billsDueShare);
}

function reviewBudget() {
  const state = BudgetBackend.get();
  const todayStr = new Date().toISOString().split("T")[0];

  if (state.profile.lastReviewDate === todayStr) {
    showToast("Already reviewed today! Keep up the great work 🔥");
    return;
  }

  state.profile.streak += 1;
  state.profile.lastReviewDate = todayStr;
  state.profile.xp += 50;
  BudgetBackend.save(state);

  renderProfile();
  showToast(`Budget review completed! Streak is now ${state.profile.streak} days 🔥 (+50 XP)`);
}

// ==========================================
// MODAL CONTROLLERS & FORM HANDLERS
// ==========================================

function setupModals() {
  // Add Bill Modal
  const billModal = document.getElementById("billModal");
  const addBillBtn = document.getElementById("addBillBtn");
  const closeBillModal = document.getElementById("closeBillModal");
  const cancelBillBtn = document.getElementById("cancelBillBtn");
  const addBillForm = document.getElementById("addBillForm");

  const openBillModal = () => billModal && billModal.classList.remove("hidden");
  const hideBillModal = () => billModal && billModal.classList.add("hidden");

  if (addBillBtn) addBillBtn.onclick = openBillModal;
  if (closeBillModal) closeBillModal.onclick = hideBillModal;
  if (cancelBillBtn) cancelBillBtn.onclick = hideBillModal;

  if (addBillForm) {
    addBillForm.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById("billTitleInput").value.trim();
      const amount = Number(document.getElementById("billAmountInput").value);
      const split = Number(document.getElementById("billSplitInput").value) || 1;
      const date = document.getElementById("billDateInput").value.trim();

      if (!title || !amount || !date) return;

      const state = BudgetBackend.get();
      state.bills.unshift({
        id: "b_" + Date.now(),
        title,
        amount,
        split,
        date,
        paid: false
      });
      BudgetBackend.save(state);

      renderBills();
      renderDashboard();
      hideBillModal();
      addBillForm.reset();
      showToast(`Added new bill: "${title}" ✨`);
    };
  }

  // Add Contribution Modal
  const contributionModal = document.getElementById("contributionModal");
  const addContributionBtn = document.getElementById("addContributionBtn");
  const closeContributionModal = document.getElementById("closeContributionModal");
  const cancelContributionBtn = document.getElementById("cancelContributionBtn");
  const addContributionForm = document.getElementById("addContributionForm");

  const openContributionModal = () => contributionModal && contributionModal.classList.remove("hidden");
  const hideContributionModal = () => contributionModal && contributionModal.classList.add("hidden");

  if (addContributionBtn) addContributionBtn.onclick = openContributionModal;
  if (closeContributionModal) closeContributionModal.onclick = hideContributionModal;
  if (cancelContributionBtn) cancelContributionBtn.onclick = hideContributionModal;

  if (addContributionForm) {
    addContributionForm.onsubmit = (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById("contributionAmountInput").value);
      if (!amount || amount <= 0) return;

      const state = BudgetBackend.get();
      state.sharedGoal.current = (state.sharedGoal.current || 0) + amount;
      state.profile.xp += 80;
      BudgetBackend.save(state);

      renderSharedGoal();
      hideContributionModal();
      addContributionForm.reset();
      showToast(`Added ₹${amount} contribution! Goal progress updated 🎉 (+80 XP)`);
    };
  }

  // Settings Modal
  const settingsModal = document.getElementById("settingsModal");
  const settingsBtn = document.getElementById("settingsBtn");
  const closeSettingsModal = document.getElementById("closeSettingsModal");
  const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
  const settingsForm = document.getElementById("settingsForm");
  const resetDataBtn = document.getElementById("resetDataBtn");

  const openSettingsModal = () => {
    const state = BudgetBackend.get();
    const nameInput = document.getElementById("profileNameInput");
    const limitInput = document.getElementById("nightLimitInput");
    if (nameInput) nameInput.value = state.profile.name;
    if (limitInput) limitInput.value = state.nightSafe.limit;
    if (settingsModal) settingsModal.classList.remove("hidden");
  };

  const hideSettingsModal = () => settingsModal && settingsModal.classList.add("hidden");

  if (settingsBtn) settingsBtn.onclick = openSettingsModal;
  if (closeSettingsModal) closeSettingsModal.onclick = hideSettingsModal;
  if (cancelSettingsBtn) cancelSettingsBtn.onclick = hideSettingsModal;

  if (settingsForm) {
    settingsForm.onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById("profileNameInput").value.trim();
      const limit = Number(document.getElementById("nightLimitInput").value);

      if (!name || !limit) return;

      const state = BudgetBackend.get();
      state.profile.name = name;
      state.nightSafe.limit = limit;
      BudgetBackend.save(state);

      renderProfile();
      renderNightSafe();
      hideSettingsModal();
      showToast("Settings updated successfully ✓");
    };
  }

  if (resetDataBtn) {
    resetDataBtn.onclick = () => {
      if (confirm("Are you sure you want to reset all app data to default state?")) {
        BudgetBackend.reset();
        initAll();
        hideSettingsModal();
        showToast("App data reset to default.");
      }
    };
  }

  // Review budget button listener
  const reviewBudgetBtn = document.getElementById("reviewBudgetBtn");
  if (reviewBudgetBtn) {
    reviewBudgetBtn.onclick = reviewBudget;
  }
}

// Peer Benchmark Data
const benchmarkData = [
  ["Food", 1800, 2200],
  ["Transport", 700, 950],
  ["Entertainment", 520, 760],
  ["Study", 900, 800],
  ["Shopping", 640, 980]
];

function renderBenchmark() {
  const benchmarkList = document.getElementById("benchmarkList");
  if (!benchmarkList) return;

  benchmarkList.innerHTML = benchmarkData.map(([name, you, peer]) => {
    const max = Math.max(you, peer);
    const pctYou = (you / max) * 100;
    const pctPeer = (peer / max) * 100;
    const lower = you < peer;

    return `
      <div>
        <div class="flex justify-between text-sm mb-2">
          <b>${name}</b>
          <span class="${lower ? "text-emerald-600" : "text-orange-600"} font-semibold">
            ${lower ? "₹" + (peer - you) + " below" : "₹" + (you - peer) + " above"} average
          </span>
        </div>
        <div class="space-y-2">
          <div class="flex items-center gap-3">
            <span class="w-12 text-xs text-slate-400">You</span>
            <div class="flex-1 h-3 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
              <div class="h-full rounded-full bg-violet-500" style="width:${pctYou}%"></div>
            </div>
            <b class="w-14 text-right text-sm">₹${you}</b>
          </div>
          <div class="flex items-center gap-3">
            <span class="w-12 text-xs text-slate-400">Peers</span>
            <div class="flex-1 h-3 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
              <div class="h-full rounded-full bg-slate-300 dark:bg-slate-600" style="width:${pctPeer}%"></div>
            </div>
            <b class="w-14 text-right text-sm text-slate-400">₹${peer}</b>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// INITIALIZATION
// ==========================================

function initAll() {
  renderProfile();
  initRunwayInputs();
  renderNightSafe();
  renderSharedGoal();
  renderBills();
  renderBenchmark();
  renderDashboard();
  setupModals();
}

document.addEventListener("DOMContentLoaded", initAll);
// Immediate init in case script loaded after DOM ready
if (document.readyState !== "loading") {
  initAll();
}