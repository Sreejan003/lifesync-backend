/* ==========================================================================
   LIFESYNC STANDALONE CALENDAR & REMINDERS CONTROLLER
   ========================================================================== */

// ================= VARIABLES =================

let currentDate = new Date();
let selectedDate = new Date();

// Load reminders from localStorage so data persists across refreshes
let reminders = JSON.parse(localStorage.getItem("lifeSyncReminders")) || [];


// ================= HTML ELEMENTS =================

const monthYear =
    document.getElementById("monthYear");

const calendarDays =
    document.getElementById("calendarDays");

const selectedDateText =
    document.getElementById("selectedDateText") ||
    document.getElementById("selectedDate");

const reminderTitle =
    document.getElementById("reminderTitle");

const reminderDate =
    document.getElementById("reminderDate");

const reminderTime =
    document.getElementById("reminderTime");

const category =
    document.getElementById("category");

const prioritySelect =
    document.getElementById("priority");

const addReminderBtn =
    document.getElementById("addReminderBtn");

const prevBtn =
    document.getElementById("prevBtn");

const nextBtn =
    document.getElementById("nextBtn");


// ================= FORMAT DATE =================

function formatDate(date) {
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, "0");
    let day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}


// ================= AUTOMATIC PRIORITY =================

function getPriority(taskDate) {
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    let dueDate = new Date(taskDate);
    dueDate.setHours(0, 0, 0, 0);

    let difference = dueDate - today;

    let daysLeft = Math.ceil(
        difference / (1000 * 60 * 60 * 24)
    );

    // Date passed
    if (daysLeft < 0) {
        return "remove";
    }

    // 0 - 3 days = High
    if (daysLeft <= 3) {
        return "High";
    }

    // 4 - 7 days = Medium
    if (daysLeft <= 7) {
        return "Medium";
    }

    // 8+ days = Low
    return "Low";
}


// ================= REMOVE OLD TASKS =================

function removeOldReminders() {
    let today = formatDate(new Date());

    reminders = reminders.filter(function (reminder) {
        return reminder.date >= today;
    });

    try {
        localStorage.setItem("lifeSyncReminders", JSON.stringify(reminders));
    } catch (e) {
        console.warn("Storage save error:", e);
    }
}


// ================= RENDER CALENDAR =================

function renderCalendar() {
    // Remove expired tasks
    removeOldReminders();

    // Clear calendar
    calendarDays.innerHTML = "";

    let year = currentDate.getFullYear();
    let month = currentDate.getMonth();

    // ================= MONTH NAME =================
    let monthName = currentDate.toLocaleString("default", {
        month: "long"
    });

    monthYear.textContent = `${monthName} ${year}`;

    // ================= FIRST DAY =================
    let firstDay = new Date(year, month, 1).getDay();

    // ================= TOTAL DAYS =================
    let totalDays = new Date(year, month + 1, 0).getDate();

    // ================= EMPTY BOXES =================
    for (let i = 0; i < firstDay; i++) {
        let empty = document.createElement("div");
        empty.classList.add("day", "empty");
        calendarDays.appendChild(empty);
    }

    // ================= CREATE DATES =================
    for (let day = 1; day <= totalDays; day++) {
        let date = new Date(year, month, day);

        let div = document.createElement("div");
        div.classList.add("day");

        // ================= DATE NUMBER =================
        let number = document.createElement("span");
        number.classList.add("day-number");
        number.textContent = day;
        div.appendChild(number);

        // ================= TODAY =================
        let today = new Date();
        if (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {
            div.classList.add("today");
        }

        // ================= SELECTED DATE =================
        if (
            day === selectedDate.getDate() &&
            month === selectedDate.getMonth() &&
            year === selectedDate.getFullYear()
        ) {
            div.classList.add("selected");
        }

        // ================= TASKS FOR THIS DATE =================
        let dateString = formatDate(date);

        let tasksForDate = reminders.filter(function (reminder) {
            return reminder.date === dateString;
        });

        // ================= SHOW TASKS =================
        tasksForDate.forEach(function (reminder) {
            // Automatic priority
            let priority = getPriority(reminder.date);
            reminder.priority = priority;

            let task = document.createElement("div");
            task.classList.add("calendar-task", "event");

            // Priority color
            if (priority === "High") {
                task.classList.add("task-high");
            } else if (priority === "Medium") {
                task.classList.add("task-medium");
            } else {
                task.classList.add("task-low");
            }

            // Task title
            task.textContent = reminder.title;

            // Add task under date
            div.appendChild(task);
        });

        // ================= CLICK DATE =================
        div.addEventListener("click", function () {
            selectedDate = new Date(year, month, day);
            reminderDate.value = formatDate(selectedDate);
            updateSelectedDate();
            renderCalendar();
        });

        calendarDays.appendChild(div);
    }
}


// ================= SELECTED DATE =================

function updateSelectedDate() {
    if (!selectedDateText) return;

    selectedDateText.textContent = selectedDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}


// ================= PREVIOUS MONTH =================

if (prevBtn) {
    prevBtn.addEventListener("click", function () {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
}


// ================= NEXT MONTH =================

if (nextBtn) {
    nextBtn.addEventListener("click", function () {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
}


// ================= ADD REMINDER =================

if (addReminderBtn) {
    addReminderBtn.addEventListener("click", function () {
        // ================= TITLE =================
        let title = reminderTitle ? reminderTitle.value.trim() : "";

        // ================= DATE =================
        let date = reminderDate ? reminderDate.value : "";

        // ================= TIME =================
        let time = reminderTime ? reminderTime.value : "";

        // ================= CATEGORY =================
        let cat = category ? category.value : "Study";

        // ================= CHECK TITLE =================
        if (title === "") {
            alert("Please enter reminder title.");
            return;
        }

        // ================= CHECK DATE =================
        if (date === "") {
            alert("Please select date.");
            return;
        }

        // ================= AUTOMATIC PRIORITY =================
        let priority = getPriority(date);

        // Past date
        if (priority === "remove") {
            alert("Please select today's or a future date.");
            return;
        }

        // ================= CREATE TASK =================
        let reminder = {
            id: Date.now(),
            title: title,
            date: date,
            time: time,
            category: cat,
            priority: priority
        };

        // Add task
        reminders.push(reminder);

        // Persist
        try {
            localStorage.setItem("lifeSyncReminders", JSON.stringify(reminders));
        } catch (e) {
            console.warn("Storage save error:", e);
        }

        // ================= CLEAR INPUTS =================
        if (reminderTitle) reminderTitle.value = "";
        if (reminderTime) reminderTime.value = "";

        // ================= UPDATE =================
        showReminders();
        renderCalendar();
        updateSummary();

        alert("Reminder added successfully!");
    });
}


// ================= SHOW REMINDERS =================

function showReminders() {
    let list = document.getElementById("reminderList");
    if (!list) return;

    list.innerHTML = "";

    if (reminders.length === 0) {
        list.innerHTML = `<div style="text-align: center; color: #887c96; font-size: 12px; padding: 12px;">No active reminders scheduled.</div>`;
        return;
    }

    reminders.forEach(function (reminder) {
        // Automatic priority
        let priority = getPriority(reminder.date);

        // Skip expired
        if (priority === "remove") {
            return;
        }

        // Update priority
        reminder.priority = priority;

        let div = document.createElement("div");
        div.classList.add("reminder");

        // Priority class
        let priorityClass = "";
        if (priority === "High") {
            priorityClass = "high";
        } else if (priority === "Medium") {
            priorityClass = "medium";
        } else {
            priorityClass = "low";
        }

        // Reminder HTML
        div.innerHTML = `
            <div class="reminder-title">
                ${reminder.title}
            </div>
            📅 ${reminder.date}
            <br>
            ⏰ ${reminder.time || "No time"}
            <br>
            📂 ${reminder.category}
            <br>
            <span class="${priorityClass}">
                Priority: ${reminder.priority}
            </span>
        `;

        list.appendChild(div);
    });
}


// ================= TODAY SUMMARY =================

function updateSummary() {
    let today = formatDate(new Date());

    let study = 0;
    let assignment = 0;
    let exam = 0;

    reminders.forEach(function (reminder) {
        if (reminder.date === today) {
            if (reminder.category === "Study") {
                study++;
            } else if (reminder.category === "Assignment") {
                assignment++;
            } else if (reminder.category === "Exam") {
                exam++;
            }
        }
    });

    const studyCountEl = document.getElementById("studyCount");
    const assignmentCountEl = document.getElementById("assignmentCount");
    const examCountEl = document.getElementById("examCount");

    if (studyCountEl) studyCountEl.textContent = study;
    if (assignmentCountEl) assignmentCountEl.textContent = assignment;
    if (examCountEl) examCountEl.textContent = exam;
}


// ================= AUTOMATIC NEW DAY CHECK =================

function checkNewDay() {
    // Remove expired tasks
    removeOldReminders();

    // Update priority
    reminders.forEach(function (reminder) {
        reminder.priority = getPriority(reminder.date);
    });

    // Update screen
    showReminders();
    renderCalendar();
    updateSummary();

    // Check again after 1 minute
    setTimeout(checkNewDay, 60000);
}


// ================= INITIAL SETUP =================

// Set today's date in picker
if (reminderDate) {
    reminderDate.value = formatDate(selectedDate);
}

// Show selected date
updateSelectedDate();

// Show calendar
renderCalendar();

// Show reminders
showReminders();

// Show summary
updateSummary();

// Start automatic checking
setTimeout(checkNewDay, 60000);
