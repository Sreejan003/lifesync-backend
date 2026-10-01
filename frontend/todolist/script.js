const addButton = document.querySelector("#addi");
const taskInput = document.querySelector("#task_list");

const prioritySelect = document.querySelector("#prioritySelect");

const taskContainer = document.querySelector("#taskContainer");
const emptyState = document.querySelector("#emptyState");

const deleteAll = document.querySelector("#deleteAll");

const pendingCount = document.querySelector("#pendingCount");
const completedCount = document.querySelector("#completedCount");
const totalCount = document.querySelector("#totalCount");

const progressCircle = document.querySelector("#progressCircle");
const progressPercent = document.querySelector("#progressPercent");


// =========================
// LOAD TASKS
// =========================

let tasks = JSON.parse(localStorage.getItem("lifesyncTasks")) || [];


// =========================
// SAVE TASKS
// =========================

function saveTasks() {

    localStorage.setItem(
        "lifesyncTasks",
        JSON.stringify(tasks)
    );
}


// =========================
// ADD TASK
// =========================

function addTask() {

    const text = taskInput.value.trim();

    const priority = prioritySelect.value;


    // Check task
    if (text === "") {

        alert("Please enter a task.");

        return;
    }


    // Check priority
    if (priority === "") {

        alert("Please select a priority.");

        return;
    }


    const task = {

        id: Date.now(),

        text: text,

        priority: priority,

        completed: false

    };


    tasks.push(task);

    saveTasks();

    taskInput.value = "";

    // Reset priority
    prioritySelect.value = "";

    renderTasks();
}


// =========================
// RENDER TASKS
// =========================

function renderTasks() {

    taskContainer.innerHTML = "";


    if (tasks.length === 0) {

        emptyState.style.display = "block";

    } else {

        emptyState.style.display = "none";

    }


    tasks.forEach(task => {

        const taskDiv = document.createElement("div");

        taskDiv.classList.add("task");


        if (task.completed) {

            taskDiv.classList.add("completed");

        }


        // =========================
        // CHECKBOX
        // =========================

        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";

        checkbox.classList.add("check");

        checkbox.checked = task.completed;


        // Hover tooltip
        if (task.completed) {

            checkbox.title = "Mark as pending";

        } else {

            checkbox.title = "Mark as completed";

        }


        // =========================
        // TASK TEXT
        // =========================

        const text = document.createElement("p");

        text.classList.add("text");

        text.innerText = task.text;


        // =========================
        // PRIORITY BADGE
        // =========================

        const priorityBadge = document.createElement("span");

        priorityBadge.classList.add("task-priority");


        if (task.priority === "high") {

            priorityBadge.classList.add("high-priority");

            priorityBadge.innerText = "High";

        } else {

            priorityBadge.classList.add("low-priority");

            priorityBadge.innerText = "Low";

        }


        // =========================
        // DELETE BUTTON
        // =========================

        const deleteButton = document.createElement("button");

        deleteButton.classList.add("deleteop");

        deleteButton.innerHTML = "➖";


        // =========================
        // CHECKBOX EVENT
        // =========================

        checkbox.addEventListener("change", () => {

            task.completed = checkbox.checked;

            saveTasks();

            renderTasks();

        });


        // =========================
        // DELETE EVENT
        // =========================

        deleteButton.addEventListener("click", () => {

            tasks = tasks.filter(
                t => String(t.id) !== String(task.id)
            );

            saveTasks();

            renderTasks();

        });


        // =========================
        // APPEND ELEMENTS
        // =========================

        taskDiv.appendChild(checkbox);

        taskDiv.appendChild(text);

        taskDiv.appendChild(priorityBadge);

        taskDiv.appendChild(deleteButton);

        taskContainer.appendChild(taskDiv);

    });


    updateStats();
}


// =========================
// UPDATE STATISTICS
// =========================

function updateStats() {

    const total = tasks.length;

    const completed = tasks.filter(
        task => task.completed
    ).length;

    const pending = total - completed;


    totalCount.innerText = total;
    completedCount.innerText = completed;
    pendingCount.innerText = pending;


    // =========================
    // OVERALL PROGRESS
    // =========================

    let percentage = 0;

    if (total > 0) {

        percentage = Math.round(
            (completed / total) * 100
        );

    }


    progressPercent.innerText = percentage + "%";


    // =========================
    // COUNT PRIORITY
    // =========================

    const highCompleted = tasks.filter(
        task =>
            task.completed &&
            task.priority === "high"
    ).length;


    const lowCompleted = tasks.filter(
        task =>
            task.completed &&
            task.priority === "low"
    ).length;


    const completedTotal =
        highCompleted + lowCompleted;


    // =========================
    // PROGRESS CIRCLE
    // =========================

    if (completedTotal === 0) {

        progressCircle.style.background =
            "#e7e2f9";

    } else {

        // Total degrees that should be coloured
        const totalDegree =
            percentage * 3.6;


        // Dark purple portion = high priority
        const highDegree =
            (highCompleted / completedTotal) *
            totalDegree;


        // Light purple portion = low priority
        const lowDegree =
            totalDegree - highDegree;


        progressCircle.style.background = `
            conic-gradient(
                #4b299a 0deg ${highDegree}deg,
                #9b82dc ${highDegree}deg ${highDegree + lowDegree}deg,
                #e7e2f9 ${highDegree + lowDegree}deg 360deg
            )
        `;
    }


    // =========================
    // HOVER INFORMATION
    // =========================

    progressCircle.title =
        `Total Task Completed: ${completed}`;
}


// =========================
// ADD BUTTON
// =========================

addButton.addEventListener(
    "click",
    addTask
);


// =========================
// ENTER KEY
// =========================

taskInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            addTask();

        }

    }
);


// =========================
// DELETE ALL
// =========================

deleteAll.addEventListener(
    "click",
    () => {

        if (tasks.length === 0) {

            return;

        }


        const confirmDelete =
            confirm("Delete all your tasks?");


        if (!confirmDelete) {

            return;

        }


        tasks = [];

        saveTasks();

        renderTasks();

    }
);


// =========================
// INITIAL DISPLAY
// =========================

renderTasks();


// =========================
// MOTIVATION QUOTES
// =========================

const quotes = [

    "Progress is better than perfection.",

    "Believe in yourself and keep moving forward.",

    "A little progress each day adds up to big results.",

    "Focus on what you can do today.",

    "Your future is created by what you do today.",

    "Stay consistent. Your efforts will pay off.",

    "One task at a time. One day at a time.",

    "You don't have to do everything at once.",

    "Make today count.",

    "Small steps every day lead to big changes tomorrow."

];


function setDailyMotivation() {

    const quoteElement =
        document.getElementById("dailyQuote");


    const today =
        new Date().toDateString();


    const savedDate =
        localStorage.getItem("motivationDate");


    let quoteIndex =
        localStorage.getItem("motivationIndex");


    // Change quote when a new day starts

    if (savedDate !== today) {

        quoteIndex =
            Math.floor(
                Math.random() * quotes.length
            );


        localStorage.setItem(
            "motivationDate",
            today
        );


        localStorage.setItem(
            "motivationIndex",
            quoteIndex
        );

    }


    quoteElement.textContent =
        `"${quotes[quoteIndex]}"`;

}


setDailyMotivation();