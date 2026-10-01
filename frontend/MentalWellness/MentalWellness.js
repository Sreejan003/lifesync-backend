/* =========================================
   LIFESYNC - MENTAL WELLNESS
========================================= */


/* =========================================
   ELEMENTS
========================================= */

const moodOptions =
    document.querySelectorAll(".mood-option");

const moodDescription =
    document.querySelector("#moodDescription");

const saveMood =
    document.querySelector("#saveMood");

const saveMessage =
    document.querySelector("#saveMessage");

const characterCount =
    document.querySelector("#characterCount");

const todayDate =
    document.querySelector("#todayDate");

const todayStatusText =
    document.querySelector("#todayStatusText");

const daysCompleted =
    document.querySelector("#daysCompleted");

const averageMood =
    document.querySelector("#averageMood");

const commonMood =
    document.querySelector("#commonMood");

const bestDay =
    document.querySelector("#bestDay");

const weeklyStatus =
    document.querySelector("#weeklyStatus");

const weeklyMessage =
    document.querySelector("#weeklyMessage");

const moodChart =
    document.querySelector("#moodChart");

const historyContainer =
    document.querySelector("#historyContainer");


/* =========================================
   MOOD DATA
========================================= */

const moodData = {

    happy: {
        emoji: "😄",
        name: "Happy",
        score: 5
    },

    good: {
        emoji: "🙂",
        name: "Good",
        score: 4
    },

    okay: {
        emoji: "😐",
        name: "Okay",
        score: 3
    },

    sad: {
        emoji: "😔",
        name: "Sad",
        score: 2
    },

    stressed: {
        emoji: "😟",
        name: "Stressed",
        score: 1
    }

};


/* =========================================
   LOAD SAVED MOODS
========================================= */

let moodEntries =
    JSON.parse(
        localStorage.getItem("lifesyncMoodEntries")
    ) || [];


/* =========================================
   SELECTED MOOD
========================================= */

let selectedMood = null;


/* =========================================
   DATE HELPERS
========================================= */

function getDateKey(date = new Date()) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


/* =========================================
   FORMAT DATE
========================================= */

function formatDate(dateString) {

    const date =
        new Date(
            dateString + "T00:00:00"
        );

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================
   TODAY
========================================= */

const todayKey =
    getDateKey();

todayDate.innerText =
    formatDate(todayKey);


/* =========================================
   SAVE DATA
========================================= */

function saveEntries() {

    localStorage.setItem(
        "lifesyncMoodEntries",
        JSON.stringify(moodEntries)
    );

}


/* =========================================
   SELECT MOOD
========================================= */

moodOptions.forEach(option => {

    option.addEventListener(
        "click",
        () => {

            /* Remove previous selection */

            moodOptions.forEach(
                item => {
                    item.classList.remove(
                        "selected"
                    );
                }
            );


            /* Select current mood */

            option.classList.add(
                "selected"
            );


            selectedMood =
                option.dataset.mood;

        }
    );

});


/* =========================================
   CHARACTER COUNTER
========================================= */

moodDescription.addEventListener(
    "input",
    () => {

        characterCount.innerText =
            moodDescription.value.length;

    }
);


/* =========================================
   GET TODAY'S ENTRY
========================================= */

function getTodayEntry() {

    return moodEntries.find(
        entry =>
            entry.date === todayKey
    );

}


/* =========================================
   LOAD TODAY'S ENTRY
========================================= */

function loadTodayEntry() {

    const todayEntry =
        getTodayEntry();


    if (!todayEntry) {

        todayStatusText.innerText =
            "You haven't checked in today yet.";

        return;

    }


    selectedMood =
        todayEntry.mood;


    /* Highlight mood */

    moodOptions.forEach(option => {

        if (
            option.dataset.mood ===
            todayEntry.mood
        ) {

            option.classList.add(
                "selected"
            );

        }

    });


    /* Load description */

    moodDescription.value =
        todayEntry.description || "";


    characterCount.innerText =
        moodDescription.value.length;


    todayStatusText.innerText =
        `You selected ${todayEntry.emoji} ${todayEntry.name} today. Your check-in is saved.`;

}


/* =========================================
   SAVE TODAY'S MOOD
========================================= */

saveMood.addEventListener(
    "click",
    () => {

        /* Check mood */

        if (!selectedMood) {

            alert(
                "Please select your mood first."
            );

            return;

        }


        const description =
            moodDescription.value.trim();


        const mood =
            moodData[selectedMood];


        const existingIndex =
            moodEntries.findIndex(
                entry =>
                    entry.date === todayKey
            );


        const newEntry = {

            date: todayKey,

            mood: selectedMood,

            emoji: mood.emoji,

            name: mood.name,

            score: mood.score,

            description: description

        };


        /* Update existing entry */

        if (existingIndex !== -1) {

            moodEntries[existingIndex] =
                newEntry;

        }

        /* Create new entry */

        else {

            moodEntries.push(
                newEntry
            );

        }


        saveEntries();


        /* Message */

        saveMessage.innerText =
            "✓ Today's check-in has been saved.";


        todayStatusText.innerText =
            `You selected ${mood.emoji} ${mood.name} today. Your check-in is saved.`;


        /* Update page */

        updateDashboard();


        setTimeout(
            () => {

                saveMessage.innerText =
                    "";

            },
            3000
        );

    }
);


/* =========================================
   GET LAST 7 DAYS
========================================= */

function getLastSevenDays() {

    const days = [];


    for (
        let i = 6;
        i >= 0;
        i--
    ) {

        const date =
            new Date();


        date.setDate(
            date.getDate() - i
        );


        const key =
            getDateKey(date);


        const entry =
            moodEntries.find(
                item =>
                    item.date === key
            );


        days.push({

            date: key,

            entry: entry || null

        });

    }


    return days;

}


/* =========================================
   AVERAGE MOOD
========================================= */

function calculateAverage(entries) {

    if (entries.length === 0) {

        return 0;

    }


    const total =
        entries.reduce(
            (sum, entry) =>
                sum + entry.score,
            0
        );


    return total / entries.length;

}


/* =========================================
   MOST COMMON MOOD
========================================= */

function calculateCommonMood(entries) {

    if (entries.length === 0) {

        return "--";

    }


    const counts = {};


    entries.forEach(entry => {

        counts[entry.mood] =
            (counts[entry.mood] || 0) + 1;

    });


    const mostCommon =
        Object.keys(counts).sort(
            (a, b) =>
                counts[b] - counts[a]
        )[0];


    return moodData[
        mostCommon
    ].emoji;

}


/* =========================================
   BEST DAY
========================================= */

function calculateBestDay(entries) {

    if (entries.length === 0) {

        return "--";

    }


    const best =
        entries.reduce(
            (bestEntry, entry) =>
                entry.score >
                bestEntry.score
                    ? entry
                    : bestEntry
        );


    return formatShortDate(
        best.date
    );

}


/* =========================================
   SHORT DATE
========================================= */

function formatShortDate(dateString) {

    const date =
        new Date(
            dateString + "T00:00:00"
        );


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short"
        }
    );

}


/* =========================================
   WEEKLY REPORT
========================================= */

function generateWeeklyReport(
    entries
) {

    if (entries.length === 0) {

        weeklyStatus.innerText =
            "Start checking in";

        weeklyMessage.innerText =
            "Track your mood each day to receive your 7-day wellness summary.";

        return;

    }


    const average =
        calculateAverage(entries);


    /*
       4.0 - 5.0
       Positive

       3.0 - 3.9
       Balanced

       Below 3.0
       Needs attention
    */


    if (average >= 4) {

        weeklyStatus.innerText =
            "A positive week 🌱";

        weeklyMessage.innerText =
            "Your recorded moods were mostly positive this week. Keep making time for the things that help you feel good.";

    }

    else if (average >= 3) {

        weeklyStatus.innerText =
            "A balanced week 💜";

        weeklyMessage.innerText =
            "Your mood varied during the week. Continue checking in with yourself and notice what activities or situations affect your mood.";

    }

    else {

        weeklyStatus.innerText =
            "A challenging week 🤍";

        weeklyMessage.innerText =
            "Your recent entries show more difficult feelings. Consider taking some time to rest, talk with someone you trust, and notice what support helps you.";

    }

}


/* =========================================
   CREATE MOOD CHART
========================================= */

function createChart(days) {

    moodChart.innerHTML = "";


    days.forEach(day => {

        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.classList.add(
            "chart-day"
        );


        const barWrapper =
            document.createElement(
                "div"
            );


        barWrapper.classList.add(
            "chart-bar-wrapper"
        );


        const bar =
            document.createElement(
                "div"
            );


        bar.classList.add(
            "chart-bar"
        );


        const emoji =
            document.createElement(
                "span"
            );


        emoji.classList.add(
            "chart-emoji"
        );


        const label =
            document.createElement(
                "span"
            );


        label.classList.add(
            "chart-day-label"
        );


        const date =
            new Date(
                day.date +
                "T00:00:00"
            );


        label.innerText =
            date.toLocaleDateString(
                "en-IN",
                {
                    weekday: "short"
                }
            );


        if (day.entry) {

            const height =
                day.entry.score * 28;


            bar.style.height =
                `${height}px`;


            emoji.innerText =
                day.entry.emoji;

        }

        else {

            bar.classList.add(
                "empty"
            );

            emoji.innerText =
                "·";

        }


        barWrapper.appendChild(
            bar
        );


        wrapper.appendChild(
            barWrapper
        );


        wrapper.appendChild(
            emoji
        );


        wrapper.appendChild(
            label
        );


        moodChart.appendChild(
            wrapper
        );

    });

}


/* =========================================
   HISTORY
========================================= */

function createHistory(days) {

    historyContainer.innerHTML = "";


    const reversedDays =
        [...days].reverse();


    reversedDays.forEach(day => {

        if (!day.entry) {

            return;

        }


        const item =
            document.createElement(
                "div"
            );


        item.classList.add(
            "history-item"
        );


        const emoji =
            document.createElement(
                "div"
            );


        emoji.classList.add(
            "history-emoji"
        );


        emoji.innerText =
            day.entry.emoji;


        const info =
            document.createElement(
                "div"
            );


        info.classList.add(
            "history-info"
        );


        const name =
            document.createElement(
                "strong"
            );


        name.innerText =
            day.entry.name;


        const date =
            document.createElement(
                "small"
            );


        date.innerText =
            formatDate(
                day.entry.date
            );


        info.appendChild(
            name
        );

        info.appendChild(
            date
        );


        const description =
            document.createElement(
                "div"
            );


        description.classList.add(
            "history-description"
        );


        description.innerText =
            day.entry.description
                ? `"${day.entry.description}"`
                : "No reflection added";


        item.appendChild(
            emoji
        );


        item.appendChild(
            info
        );


        item.appendChild(
            description
        );


        historyContainer.appendChild(
            item
        );

    });


    /* Empty history */

    if (
        historyContainer.children.length ===
        0
    ) {

        historyContainer.innerHTML = `

            <div
                style="
                    text-align:center;
                    padding:25px;
                    color:#9994a3;
                    font-size:12px;
                "
            >

                No mood entries yet.
                Start today's check-in 💜

            </div>

        `;

    }

}


/* =========================================
   UPDATE DASHBOARD
========================================= */

function updateDashboard() {

    const days =
        getLastSevenDays();


    const entries =
        days
            .filter(
                day => day.entry
            )
            .map(
                day => day.entry
            );


    /* Number of days */

    daysCompleted.innerText =
        `${entries.length}/7`;


    /* Average */

    if (entries.length > 0) {

        const average =
            calculateAverage(
                entries
            );


        averageMood.innerText =
            average.toFixed(1) +
            "/5";

    }

    else {

        averageMood.innerText =
            "--";

    }


    /* Common mood */

    commonMood.innerText =
        calculateCommonMood(
            entries
        );


    /* Best day */

    bestDay.innerText =
        calculateBestDay(
            entries
        );


    /* Chart */

    createChart(
        days
    );


    /* History */

    createHistory(
        days
    );


    /* Report */

    generateWeeklyReport(
        entries
    );

}


/* =========================================
   INITIAL LOAD
========================================= */

loadTodayEntry();

updateDashboard();