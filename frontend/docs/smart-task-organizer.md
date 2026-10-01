# LifeSync - Smart Task Organizer Documentation

## 1. Overview & System Purpose

The **Smart Task Organizer** is an integrated prioritization engine inside LifeSync designed specifically for university students. 

Traditional to-do apps display tasks in static lists or simple chronological sort orders, which fail to reflect real student workloads where deadlines, course exams, and class schedules interact dynamically. 

The Smart Task Organizer addresses this by acting as an **intelligent bridge** between:
1. **To-Do Management (`TasksModule`)**: Task status, stated priority (High/Medium/Low), categories, and due dates.
2. **Academic Schedule (`CalendarModule`)**: Class schedules, exam dates, lab sessions, and assignment milestones.

It calculates a real-time **Academic Urgency Score (`smartScore`)** for every pending task, ranks them descending by urgency, highlights the `#1 Top Priority Right Now`, and feeds synchronized priority views across the Dashboard, Tasks view, and dedicated Task Organizer view.

---

## 2. Architecture & Data Flow

```
   ┌───────────────────────┐         ┌──────────────────────────┐
   │      TasksModule      │         │      CalendarModule      │
   │  (Pending Tasks, Due  │         │   (Exams, Classes, Labs  │
   │   Dates, Priorities)  │         │   within 4-Day Horizon)  │
   └───────────┬───────────┘         └────────────┬─────────────┘
               │                                  │
               └─────────────────┬────────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │    SmartTaskOrganizer Core    │
                 │   (js/smart-organizer.js)     │
                 │                               │
                 │ • Robust ISO Date Parsing     │
                 │ • Multi-Factor Scoring (0-200)│
                 │ • Course Keyword Matching     │
                 │ • Urgency Reason Tagging      │
                 └───────────────┬───────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  View 2b: Smart  │    │ View 1: Unified  │    │  View 2: Tasks   │
│  Task Organizer  │    │    Dashboard     │    │  Priority Banner │
│  (#view-smart)   │    │ (Priority Tasks) │    │ (#tasksSmart... )│
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

### Module Responsibilities

| Component | File Location | Responsibility |
| :--- | :--- | :--- |
| **Engine** | [`LifeSync/js/smart-organizer.js`](file:///d:/Practice/lifesync/LifeSync/js/smart-organizer.js) | Pure calculation engine. Inspects active tasks and upcoming academic events, scores tasks, and orders them descending. |
| **Full View** | [`LifeSync/index.html`](file:///d:/Practice/lifesync/LifeSync/index.html) (`#view-smart`) | Complete ranked queue interface with top-priority banner, score circular meters, urgency bars, edit/delete actions, and quick checkbox completion. |
| **App Controller** | [`LifeSync/js/app.js`](file:///d:/Practice/lifesync/LifeSync/js/app.js) | Handles DOM rendering (`renderSmartOrganizerView()`), modal events, cross-tab synchronization, and theme changes. |
| **Dashboard Card** | [`LifeSync/js/dashboard.js`](file:///d:/Practice/lifesync/LifeSync/js/dashboard.js) | Displays top 4 prioritized tasks in Column 2 of the Dashboard with quick checkbox toggling and direct routing to `#smart`. |
| **Styles & Theme** | [`LifeSync/style.css`](file:///d:/Practice/lifesync/LifeSync/style.css) | Defines layout, responsive cards, color-coded badges, urgency gradients, and Obsidian Dark Mode rules. |

---

## 3. Prioritization Algorithm & Scoring Formula

Each active task is assigned an integer `smartScore` (typically 10 to 200+) calculated across four additive weighted components:

$$\text{smartScore} = \text{Score}_{\text{deadline}} + \text{Score}_{\text{priority}} + \text{Score}_{\text{momentum}} + \text{Score}_{\text{calendar}}$$

### Factor 1: Deadline Urgency ($\text{Score}_{\text{deadline}}$)

Calculated via day difference between `today` (midnight local time) and `task.dueDate`:

| Condition | Points | Reason Tag | Tag Type (`reasonType`) |
| :--- | :---: | :--- | :--- |
| **Overdue** ($\Delta < 0$) | **+120** | `🚨 Overdue (X d ago)` | `danger` |
| **Due Today** ($\Delta = 0$) | **+90** | `⚡ Due Today` | `danger` |
| **Due Tomorrow** ($\Delta = 1$) | **+70** | `⏰ Due Tomorrow` | `warning` |
| **Due Soon** ($2 \le \Delta \le 3$) | **+45** | `📅 Due in X days` | `warning` |
| **Later Deadline** ($\Delta > 3$) | **+20** | `Due in X days` | `info` |
| **No Deadline Set** | **+5** | `No deadline set` | `info` |

> [!NOTE]
> `getDaysDiff()` parses both standard `YYYY-MM-DD` inputs and full ISO timestamps (`YYYY-MM-DDTHH:mm:ss.sssZ`) without producing `NaN`.

### Factor 2: Stated Priority Level ($\text{Score}_{\text{priority}}$)

| Priority | Points | Description |
| :--- | :---: | :--- |
| **High** | **+35** | High student priority flag |
| **Medium** | **+20** | Standard baseline |
| **Low** | **+10** | Nice-to-have or flexible task |

### Factor 3: Momentum Bonus ($\text{Score}_{\text{momentum}}$)

| Status | Points | Tag Update |
| :--- | :---: | :--- |
| **In Progress** | **+15** | Appends `⏳ In Progress` tag if no higher urgency is active |
| **Pending** | **0** | Not yet started |

### Factor 4: Academic Calendar Correlation ($\text{Score}_{\text{calendar}}$)

The engine searches `CalendarModule.getEvents()` for upcoming events in the next 4 days categorized as `exam`, `study`, `class`, or `assignment`.

When a task correlates with an upcoming academic event:
- It receives an **automatic boost of +40 points**.
- A descriptive badge is attached: `🎯 Boost: [Event Title] (in Xd / Tomorrow / Today)`.

#### Subject & Keyword Matching Rules:
1. **Course Keywords**: Extracts non-generic words ($\ge 3$ characters) from the event title and matches them against the task title and description.
2. **Subject Acronyms**: Matches common university course acronyms:
   - `OS` $\leftrightarrow$ `Operating Systems`
   - `CN` $\leftrightarrow$ `Computer Networks`
   - `DBMS` $\leftrightarrow$ `Database Management Systems`
3. **Explicit Exam Preparation**: If an event is an `exam` and the task title explicitly mentions `exam`, `midterm`, `test`, `quiz`, or `viva`.
4. **Time Horizon Match**: For study/assignment tasks, if the task is due on or before the exam date.

#### Urgency Preservation:
If a task is **Overdue** or **Due Today**, the danger tag is **never replaced**. Instead, the boost is concatenated:
- `🚨 Overdue (2d) • 🎯 Boost: Software Engineering Midterm Exam (in 2d)`
- Tag type remains `danger` (red) to prevent students from missing past-due work.

---

## 4. UI Components & User Experience

### 1. Top Priority Banner (`.smart-top-banner`)
Renders above the queue, featuring:
- Highlighting the `#1` highest-ranked task.
- Bold visual urgency styling (`urgency-danger`, `urgency-warning`, `urgency-exam`, `urgency-info`).
- "✓ Mark Done" action button that completes the task and immediately re-ranks the queue with toast notification.

### 2. Prioritized Task Queue (`.smart-task-row`)
Each row displays:
- **Rank Indicator**: Gradient numbered badge (`#1`, `#2`, `#3`...).
- **Completion Checkbox**: Accessible custom checkbox (`.custom-checkbox-wrap`) with tick animation.
- **Title & Badges**: Priority pill (`High`/`Med`/`Low`), Category pill, Deadline, and the Explanatory Reason Tag (`.reason-tag`).
- **Urgency Progress Meter**: Visual bar (`.smart-urgency-bar`) reflecting percentage of urgency (0% to 100%).
- **Score Dial**: Circular badge (`.smart-score-circle`) showing the numerical `smartScore`.
- **Row Actions**: Quick Edit (✏️) and Delete (🗑️) buttons.

### 3. "How It Works" Card (`.smart-how-it-works`)
Educational header explaining the scoring criteria and providing a color-coded legend:
- 🔴 Overdue / Due Today
- 🟡 Due Soon
- 🟣 Exam Boost
- 🔵 Normal / Scheduled

### 4. Empty State (`.smart-empty-state`)
Clean celebration card shown when all pending tasks are finished (`🎯 All tasks completed!`), with a direct button to add new tasks.

---

## 5. Dark Mode (Obsidian Theme) Support

All Smart Task Organizer components adhere to the LifeSync Obsidian Dark Mode design:

| Component | Light Mode | Dark Mode (`.dark-theme`) |
| :--- | :--- | :--- |
| **Card Row (`.smart-task-row`)** | Pure White (`#ffffff`), border `#e5e7eb` | Deep Slate Glass (`rgba(24, 30, 56, 0.78)`), border `rgba(255, 255, 255, 0.08)` |
| **Row Hover** | Purple shadow (`rgba(91, 54, 245, 0.10)`) | Violet border glow (`rgba(139, 92, 246, 0.40)`), dark drop shadow |
| **Task Titles** | Dark Charcoal (`var(--text-main)`) | Bright Off-White (`#f8fafc`) |
| **Explanation Card** | Light Lavender gradient | Subtle Purple Tint (`rgba(99, 59, 245, 0.15)`), border `rgba(139, 92, 246, 0.35)` |
| **Danger Banner** | Light red gradient, red border | Midnight Red overlay (`rgba(239, 68, 68, 0.18)`), `#ef4444` border |
| **Exam Banner** | Light violet gradient, purple border | Midnight Purple overlay (`rgba(139, 92, 246, 0.22)`), `#8b5cf6` border |
| **Score Circle** | White fill, `#5b36f5` outline | Translucent fill, bright white score text (`#ffffff`) |

---

## 6. JavaScript API Reference

### `window.SmartTaskOrganizer`

#### `getPrioritizedTasks()`
Analyzes current state of `TasksModule` and `CalendarModule`, returning an array of enriched, scored task objects sorted descending by `smartScore`.

**Return Object Structure:**
```javascript
{
    id: "tsk_1725960000000_a1b2",
    title: "Operating Systems Lab Assignment",
    description: "Implement CPU scheduling algorithm in C++",
    dueDate: "2026-09-11",
    priority: "High",          // 'High' | 'Medium' | 'Low'
    category: "Assignment",    // 'Study' | 'Assignment' | 'Project' | 'Exam' | 'Personal'
    status: "Pending",         // 'Pending' | 'In Progress' | 'Completed'
    smartScore: 145,           // Calculated urgency score
    reasonTag: "🎯 Boost: Operating Systems Midterm Exam (in 2d)",
    reasonType: "exam",        // 'danger' | 'warning' | 'exam' | 'info'
    daysDiff: 1                // Days until deadline
}
```

#### `getTopPrioritizedTasks(limit = 4)`
Returns the top `limit` tasks from `getPrioritizedTasks()`. Used primarily by the Dashboard widget.

---

### `window.LifeSyncApp` Integration Methods

| Method | Parameters | Description |
| :--- | :--- | :--- |
| `switchTab(tabId)` | `'smart'` | Navigates to the Task Organizer view, activates sidebar nav button, and calls `renderSmartOrganizerView()`. |
| `toggleTaskAndRefreshSmart(taskId)` | `string` | Toggles completion on `TasksModule`, triggers celebratory toast, and re-renders both Smart and To-Do views. |
| `handleQuickTaskToggle(taskId)` | `string` | Used by top-priority banners on Dashboard and Task Organizer. Completes task and re-renders active view. |
| `deleteTask(taskId)` | `string` | Prompts confirmation, removes task, and synchronously re-renders active view. |
| `openAddTaskModal()` | none | Resets task form modal, sets default today deadline, and displays overlay. |
| `openEditTaskModal(taskId)` | `string` | Populates form with existing task details for quick editing. |

---

## 7. Verification & Automated Tests

Automated testing is maintained in [`LifeSync/test-lifesync.js`](file:///d:/Practice/lifesync/LifeSync/test-lifesync.js).

Run test suite:
```bash
node LifeSync/test-lifesync.js
```

### Test Coverage Checklist:
- [x] Initial seed tasks prioritized correctly.
- [x] Tasks ordered in strictly descending order by `smartScore`.
- [x] Top task contains valid explanatory `reasonTag` and positive urgency score.
- [x] ISO timestamp deadline strings parsed without `NaN`.
- [x] Overdue tasks retain `danger` urgency even when academic exam boosts apply.
- [x] Dark mode CSS selectors `.dark-theme .smart-task-row` and `.dark-theme .smart-top-banner` present.
- [x] Interactive action handlers (`toggleTaskAndRefreshSmart`, `deleteTask`, `handleQuickTaskToggle`) correctly exported on `window.LifeSyncApp`.
- [x] DOM element `#smartOrganizerTaskList` bound in [`index.html`](file:///d:/Practice/lifesync/LifeSync/index.html).
