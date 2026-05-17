// --- DOM Elements ---
const display = document.getElementById("display");
const status = document.getElementById("status");
const prepTimeInput = document.getElementById("prepTime");
const voiceStartInput = document.getElementById("voiceStart");
const restTimeInput = document.getElementById("restTime");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const enableSoundBtn = document.getElementById("enableSoundBtn");

const exercisePickerLabel = document.getElementById("exercisePickerLabel");
const exercisePickerContent = document.getElementById("exercisePickerContent");
const exerciseSelect = document.getElementById("exerciseSelect");
const addExerciseBtn = document.getElementById("addExerciseBtn");
const timerExerciseSelect = document.getElementById("timerExerciseSelect");
const timerExerciseSelectWrapper = document.getElementById("timerExerciseSelectWrapper");
const addTimerExerciseBtn = document.getElementById("addTimerExerciseBtn");
const stretchDurationInput = document.getElementById("stretchDurationInput");
const stretchRestInput = document.getElementById("stretchRestInput");
const addStretchExerciseBtn = document.getElementById("addStretchExerciseBtn");
const clearStretchRoutineBtn = document.getElementById("clearStretchRoutineBtn");
const runStretchRoutineBtn = document.getElementById("runStretchRoutineBtn");
const stretchRoutineList = document.getElementById("stretchRoutineList");
const stretchSetsInput = document.getElementById("stretchSetsInput");
const stretchTotalTimeEl = document.getElementById("stretchTotalTime");
const stretchForm = document.querySelector(".stretch-form");
const stretchRunCard = document.getElementById("stretchRunCard");
const stretchRunStatus = document.getElementById("stretchRunStatus");
const stretchRunDisplay = document.getElementById("stretchRunDisplay");
const stretchRunCurrent = document.getElementById("stretchRunCurrent");
const pauseStretchBtn = document.getElementById("pauseStretchBtn");
const stopStretchBtn = document.getElementById("stopStretchBtn");

// --- Stretch Run State ---
let stretchRunIndex = 0;
let stretchRunPhase = null;
let stretchRunEndTime = 0;
let stretchRunTimerId = null;
let stretchRunRemainingMs = 0;
let isStretchPaused = false;
let stretchRunTotalSets = 1;
let stretchRunCurrentSet = 1;

// Setting Edit Modal Elements
const settingEditModal = document.getElementById("settingEditModal");
const settingEditTitle = document.getElementById("settingEditTitle");
const settingEditInput = document.getElementById("settingEditInput");
const confirmSettingEditBtn = document.getElementById("confirmSettingEditBtn");
const cancelSettingEditBtn = document.getElementById("cancelSettingEditBtn");
const restPresets = document.getElementById("restPresets");
const presetBtns = restPresets ? restPresets.querySelectorAll(".preset-btn") : [];

// Modal Elements
const saveModal = document.getElementById("saveModal");
const confirmSaveBtn = document.getElementById("confirmSaveBtn");
const cancelSaveBtn = document.getElementById("cancelSaveBtn");
const editMinutes = document.getElementById("editMinutes");
const editSeconds = document.getElementById("editSeconds");
const modalExerciseName = document.getElementById("modalExerciseName");

// History Elements
const recentList = document.getElementById("recentList");
const bestList = document.getElementById("bestList");
const allHistoryList = document.getElementById("allHistoryList");
const performanceChartCanvas = document.getElementById("performanceChart");

// Chart instance
let performanceChart = null;

// Settings Elements
const saveDefaultBtn = document.getElementById("saveDefaultBtn");
const saveExerciseBtn = document.getElementById("saveExerciseBtn");
const saveExerciseLabel = document.getElementById("saveExerciseLabel");
const settingsPill = document.getElementById("settingsPill");
const exerciseGoal = document.getElementById("exerciseGoal");

// Navigation Elements
const navBtns = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");
const openHistoryBtn = document.getElementById("openHistoryBtn");

// --- Timer State ---
let startTime, animationFrameId, prepEndTime;
let isRunning = false;
let isPrep = false;
let elapsedTime = 0;
let lastBeepSecond = 0;
let isResting = false;
let restEndTime = 0;
let restAnimFrameId = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioUnlocked = false;
let voicesPrimed = false;

async function unlockAudio() {
    try {
        if (audioCtx.state !== "running") await audioCtx.resume();

        // iOS sometimes needs a real graph start/stop from a user gesture.
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.02);

        audioUnlocked = true;
        if (enableSoundBtn) {
            enableSoundBtn.textContent = "ON";
            enableSoundBtn.title = "Sound Enabled";
            enableSoundBtn.disabled = true;
        }
        return true;
    } catch (err) {
        console.warn("Audio unlock failed:", err);
        return false;
    }
}

function primeSpeechSynthesis() {
    if (!("speechSynthesis" in window) || voicesPrimed) return;
    window.speechSynthesis.getVoices();
    voicesPrimed = true;
}

// --- Wake Lock / NoSleep Integration ---
let wakeLock = null;
let noSleep = null;

async function requestWakeLock() {
    try {
        if ("wakeLock" in navigator) {
            wakeLock = await navigator.wakeLock.request("screen");
            wakeLock.addEventListener("release", () => {
                wakeLock = null;
            });
            return true;
        }
    } catch (err) {
        console.warn("Wake Lock request failed:", err);
    }
    return false;
}

async function releaseWakeLock() {
    try {
        if (wakeLock) await wakeLock.release();
        wakeLock = null;
    } catch (err) {
        console.warn("Wake Lock release failed:", err);
    }
}

function enableNoSleep() {
    try {
        if (!noSleep && typeof NoSleep !== "undefined") noSleep = new NoSleep();
        if (noSleep) noSleep.enable();
    } catch (err) {
        console.warn("NoSleep enable failed:", err);
    }
}

function disableNoSleep() {
    try {
        if (noSleep) noSleep.disable();
    } catch (err) {
        console.warn("NoSleep disable failed:", err);
    }
}

// --- 1. Navigation Logic ---
let activeView = "view-timer";

function showView(target) {
    activeView = target;
    views.forEach((v) => v.classList.remove("active-view"));
    const view = document.getElementById(target);
    if (view) view.classList.add("active-view");

    navBtns.forEach((b) => b.classList.toggle("active", b.dataset.target === target));
    updateExerciseDropdown();
    if (target === "view-history") updateHistoryUI();
    if (target === "view-stretch") renderStretchRoutine();
}

navBtns.forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.target));
});

if (openHistoryBtn) {
    openHistoryBtn.addEventListener("click", () => showView("view-history"));
}

// --- 2. Exercise & Storage Logic ---
let timerExercises = JSON.parse(localStorage.getItem("timerExercises")) || [
    "Hamstring Stretch",
    "Quad Stretch",
    "Shoulder Stretch",
];
let holdExercises = JSON.parse(localStorage.getItem("holdExercises")) || [
    "Dead Hang",
];
let stretchRoutine = JSON.parse(localStorage.getItem("stretchRoutine")) || [];

function updateExerciseDropdown() {
    if (!exerciseSelect || !timerExerciseSelect || !timerExerciseSelectWrapper) return;

    const headerPicker = exercisePickerContent;
    if (activeView === "view-stretch") {
        if (headerPicker) headerPicker.style.display = "none";
        if (addExerciseBtn) addExerciseBtn.style.display = "none";
        if (timerExerciseSelectWrapper) timerExerciseSelectWrapper.style.display = "flex";
        if (addTimerExerciseBtn) addTimerExerciseBtn.style.display = "inline-flex";

        if (timerExerciseSelect) {
            timerExerciseSelect.innerHTML = timerExercises
                .map((ex) => `<option value="${ex}">${ex}</option>`)
                .join("");

            if (timerExercises.length > 0 && !timerExercises.includes(timerExerciseSelect.value)) {
                timerExerciseSelect.selectedIndex = 0;
            }
        }
    } else {
        if (headerPicker) headerPicker.style.display = "flex";
        if (addExerciseBtn) addExerciseBtn.style.display = "inline-flex";
        if (timerExerciseSelectWrapper) timerExerciseSelectWrapper.style.display = "none";
        if (addTimerExerciseBtn) addTimerExerciseBtn.style.display = "none";

        if (exerciseSelect) {
            exerciseSelect.innerHTML = holdExercises
                .map((ex) => `<option value="${ex}">${ex}</option>`)
                .join("");

            if (holdExercises.length > 0 && !holdExercises.includes(exerciseSelect.value)) {
                exerciseSelect.selectedIndex = 0;
            }

            if (exercisePickerLabel) {
                exercisePickerLabel.textContent = "Hold Exercises";
            }
            if (exerciseSelect.value) {
                loadSettings(exerciseSelect.value);
                updateSaveExerciseLabel();
            }
        }
    }
}

if (exerciseSelect) {
    exerciseSelect.addEventListener("change", () => {
        if (activeView !== "view-stretch") {
            loadSettings(exerciseSelect.value);
            updateSaveExerciseLabel();
            updateHistoryUI();
        }
    });
}

if (timerExerciseSelect) {
    timerExerciseSelect.addEventListener("change", () => {
        // Timer exercise selection only affects the stretch tab.
    });
}

if (addTimerExerciseBtn) {
    addTimerExerciseBtn.addEventListener("click", () => {
        const name = prompt("Enter new timer exercise name:");
        if (name && name.trim() !== "") {
            const trimmed = name.trim();
            timerExercises.push(trimmed);
            localStorage.setItem("timerExercises", JSON.stringify(timerExercises));
            updateExerciseDropdown();
            if (timerExerciseSelect) timerExerciseSelect.value = trimmed;
        }
    });
}

if (exerciseGoal) {
    exerciseGoal.addEventListener("change", () => {
        saveGoal(exerciseSelect.value, parseInt(exerciseGoal.value) || 0);
    });
}

addExerciseBtn.addEventListener("click", () => {
    const setLabel = activeView === "view-stretch" ? "timer exercise" : "hold exercise";
    const name = prompt(`Enter new ${setLabel} name:`);
    if (name && name.trim() !== "") {
        const trimmed = name.trim();
        const targetList = activeView === "view-stretch" ? timerExercises : holdExercises;
        const storageKey = activeView === "view-stretch" ? "timerExercises" : "holdExercises";

        targetList.push(trimmed);
        localStorage.setItem(storageKey, JSON.stringify(targetList));
        updateExerciseDropdown();

        if (activeView === "view-stretch") {
            timerExerciseSelect.value = trimmed;
        } else {
            exerciseSelect.value = trimmed;
            loadSettings(trimmed);
            updateSaveExerciseLabel();
            updateHistoryUI();
        }
    }
});

if (addStretchExerciseBtn) {
    addStretchExerciseBtn.addEventListener("click", () => {
        if (!timerExerciseSelect || !timerExerciseSelect.value) return;

        const name = timerExerciseSelect.value;
        const duration = parseInt(stretchDurationInput.value, 10) || 30;
        const rest = parseInt(stretchRestInput.value, 10) || 10;

        stretchRoutine.push({ name, duration, rest });
        localStorage.setItem("stretchRoutine", JSON.stringify(stretchRoutine));
        renderStretchRoutine();

        stretchDurationInput.value = "30";
        stretchRestInput.value = "10";
        updateStretchTotalTimeDisplay();
    });
}

if (runStretchRoutineBtn) {
    runStretchRoutineBtn.addEventListener("click", startStretchRun);
}

if (stretchSetsInput) {
    stretchSetsInput.addEventListener("change", () => {
        // clamp to min 1
        stretchSetsInput.value = Math.max(1, parseInt(stretchSetsInput.value, 10) || 1);
        updateStretchTotalTimeDisplay();
    });
}

if (pauseStretchBtn) {
    pauseStretchBtn.addEventListener("click", () => {
        if (isStretchPaused) {
            resumeStretchRun();
        } else {
            pauseStretchRun();
        }
    });
}

if (stopStretchBtn) {
    stopStretchBtn.addEventListener("click", stopStretchRun);
}

function showStretchRunCard(show) {
    if (stretchForm) stretchForm.classList.toggle("hidden", show);
    if (stretchRunCard) stretchRunCard.classList.toggle("hidden", !show);
}

function updateStretchRunControls() {
    if (pauseStretchBtn) {
        pauseStretchBtn.textContent = isStretchPaused ? "Resume" : "Pause";
        pauseStretchBtn.disabled = !stretchRunPhase || stretchRunPhase === "complete";
    }
    if (stopStretchBtn) {
        stopStretchBtn.disabled = !stretchRunPhase || stretchRunPhase === "complete";
    }
}

function updateStretchRunDisplay() {
    if (!stretchRunStatus || !stretchRunDisplay || !stretchRunCurrent) return;

    const timeText = formatCountdown(Math.max(0, stretchRunRemainingMs));
    stretchRunDisplay.textContent = timeText;

    // Show set info if available
    const setEl = document.getElementById("stretchRunSet");
    if (setEl) setEl.textContent = `Set ${stretchRunCurrentSet}/${stretchRunTotalSets}`;

    if (stretchRunPhase === "prep") {
        stretchRunStatus.textContent = "GET READY";
        stretchRunStatus.style.color = "var(--accent-blue)";
        stretchRunCurrent.textContent = stretchRoutine[0]
            ? `Next: ${stretchRoutine[0].name}`
            : "";
    } else if (stretchRunPhase === "exercise") {
        stretchRunStatus.textContent = "HOLD";
        stretchRunStatus.style.color = "var(--accent-green)";
        stretchRunCurrent.textContent = stretchRoutine[stretchRunIndex]
            ? `Exercise: ${stretchRoutine[stretchRunIndex].name}`
            : "";
    } else if (stretchRunPhase === "rest") {
        stretchRunStatus.textContent = "REST";
        stretchRunStatus.style.color = "var(--accent-red)";
        const nextIndex = stretchRunIndex + 1;
        stretchRunCurrent.textContent = stretchRoutine[nextIndex]
            ? `Next: ${stretchRoutine[nextIndex].name}`
            : "Routine Complete Soon";
    } else if (stretchRunPhase === "complete") {
        stretchRunStatus.textContent = "COMPLETE";
        stretchRunStatus.style.color = "var(--accent-blue)";
        stretchRunCurrent.textContent = "Great job!";
        stretchRunDisplay.textContent = "00:00";
    }
}

function setStretchRunRemaining(ms) {
    stretchRunRemainingMs = Math.max(0, ms);
}

function scheduleStretchRunTick() {
    cancelAnimationFrame(stretchRunTimerId);
    stretchRunTimerId = requestAnimationFrame(stretchRunTick);
}

function stretchRunTick() {
    if (isStretchPaused || !stretchRunPhase || stretchRunPhase === "complete") return;

    const remaining = stretchRunEndTime - Date.now();
    if (remaining <= 0) {
        advanceStretchRun();
        return;
    }

    setStretchRunRemaining(remaining);
    updateStretchRunDisplay();
    stretchRunTimerId = requestAnimationFrame(stretchRunTick);
}

function startStretchRun() {
    if (stretchRoutine.length === 0) {
        alert("Add a stretch before starting the routine.");
        return;
    }

    unlockAudio();
    primeSpeechSynthesis();

    // initialize sets and indexes
    stretchRunIndex = 0;
    stretchRunPhase = "prep";
    isStretchPaused = false;
    stretchRunTotalSets = stretchSetsInput ? Math.max(1, parseInt(stretchSetsInput.value, 10) || 1) : 1;
    stretchRunCurrentSet = 1;
    setStretchRunRemaining(5000);
    stretchRunEndTime = Date.now() + 5000;

    showStretchRunCard(true);
    updateStretchRunDisplay();
    updateStretchRunControls();
    updateStretchRoutineHighlights();
    scheduleStretchRunTick();
}

function advanceStretchRun() {
    if (stretchRunPhase === "prep") {
        stretchRunPhase = "exercise";
        playSound("start");
    } else if (stretchRunPhase === "exercise") {
        const current = stretchRoutine[stretchRunIndex];
        const isLastExerciseInRoutine = stretchRunIndex === stretchRoutine.length - 1;
        const isFinalOverall = isLastExerciseInRoutine && stretchRunCurrentSet === stretchRunTotalSets;

        // If not the last exercise in the routine and rest exists, go to rest
        if (current && current.rest > 0 && !isLastExerciseInRoutine) {
            stretchRunPhase = "rest";
            playSound("start");
        } else if (isLastExerciseInRoutine) {
            // End of circuit: if more sets remain, start next set at index 0; otherwise finish
            if (stretchRunCurrentSet < stretchRunTotalSets) {
                stretchRunCurrentSet += 1;
                stretchRunIndex = 0;
                stretchRunPhase = "exercise";
                playSound("start");
            } else {
                // final exercise of final set -> complete
                completeStretchRun();
                return;
            }
        } else {
            // move to next exercise in same set
            stretchRunIndex += 1;
            stretchRunPhase = "exercise";
            playSound("start");
        }
    } else if (stretchRunPhase === "rest") {
        // After rest, advance to next exercise; if that goes past end, handle sets
        stretchRunIndex += 1;
        if (stretchRunIndex >= stretchRoutine.length) {
            if (stretchRunCurrentSet < stretchRunTotalSets) {
                stretchRunCurrentSet += 1;
                stretchRunIndex = 0;
                stretchRunPhase = "exercise";
                playSound("start");
            } else {
                completeStretchRun();
                return;
            }
        } else {
            stretchRunPhase = "exercise";
            playSound("start");
        }
    }

    const current = stretchRoutine[stretchRunIndex];
    if (!current) {
        completeStretchRun();
        return;
    }

    const nextDuration = stretchRunPhase === "exercise" ? current.duration * 1000 : current.rest * 1000;
    setStretchRunRemaining(nextDuration);
    stretchRunEndTime = Date.now() + nextDuration;

    updateStretchRunDisplay();
    updateStretchRunControls();
    updateStretchRoutineHighlights();
    scheduleStretchRunTick();
}

function pauseStretchRun() {
    if (stretchRunPhase === "complete" || !stretchRunPhase) return;
    isStretchPaused = true;
    stretchRunRemainingMs = Math.max(0, stretchRunEndTime - Date.now());
    cancelAnimationFrame(stretchRunTimerId);
    updateStretchRunControls();
    if (stretchRunStatus) {
        stretchRunStatus.textContent = "PAUSED";
        stretchRunStatus.style.color = "var(--text-muted)";
    }
}

function resumeStretchRun() {
    if (!stretchRunPhase || stretchRunPhase === "complete") return;
    isStretchPaused = false;
    stretchRunEndTime = Date.now() + stretchRunRemainingMs;
    updateStretchRunControls();
    scheduleStretchRunTick();
}

function stopStretchRun() {
    cancelAnimationFrame(stretchRunTimerId);
    resetStretchRunState();
    showStretchRunCard(false);
    renderStretchRoutine();
}

function completeStretchRun() {
    stretchRunPhase = "complete";
    isStretchPaused = false;
    setStretchRunRemaining(0);
    playSound("start");
    updateStretchRunDisplay();
    updateStretchRunControls();
    renderStretchRoutine();
}

function resetStretchRunState() {
    stretchRunIndex = 0;
    stretchRunPhase = null;
    stretchRunEndTime = 0;
    isStretchPaused = false;
    setStretchRunRemaining(0);
    if (pauseStretchBtn) {
        pauseStretchBtn.textContent = "Pause";
        pauseStretchBtn.disabled = true;
    }
    if (stopStretchBtn) {
        stopStretchBtn.disabled = true;
    }
}

if (stretchRoutineList) {
    stretchRoutineList.addEventListener("click", (event) => {
        const button = event.target.closest(".remove-stretch-btn");
        if (!button) return;
        const index = Number(button.dataset.index);
        if (Number.isInteger(index)) {
            stretchRoutine.splice(index, 1);
            localStorage.setItem("stretchRoutine", JSON.stringify(stretchRoutine));
            renderStretchRoutine();
        }
    });
}

function renderStretchRoutine() {
    if (!stretchRoutineList) return;

    if (stretchRoutine.length === 0) {
        stretchRoutineList.innerHTML = `<li><span class="text-muted">No stretches added yet.</span></li>`;
        return;
    }

    stretchRoutineList.innerHTML = stretchRoutine
        .map((item, index) => {
            const isActive = stretchRunPhase && index === stretchRunIndex && stretchRunPhase !== "prep";
            const phaseClass = isActive && stretchRunPhase === "rest" ? "resting" : "active";
            const itemClass = isActive ? phaseClass : "";
            return `
                <li class="${itemClass}">
                    <div>
                        <strong>${item.name}</strong>
                        <div class="datetime">${item.duration}s · Rest ${item.rest}s</div>
                    </div>
                    <button class="remove-stretch-btn" data-index="${index}" title="Remove">×</button>
                </li>
            `;
        })
        .join("");
    updateStretchTotalTimeDisplay();
}

function computeStretchTotalSeconds(sets) {
    if (!stretchRoutine || stretchRoutine.length === 0) return 0;
    const n = stretchRoutine.length;
    // per-set durations sum
    const perSetDur = stretchRoutine.reduce((s, item) => s + (parseInt(item.duration, 10) || 0), 0);
    // per-set rests: include rest for all exercises except the last one in the set
    const perSetRests = stretchRoutine.slice(0, Math.max(0, n - 1)).reduce((s, item) => s + (parseInt(item.rest, 10) || 0), 0);

    const totalSeconds = sets * (perSetDur + perSetRests);
    return totalSeconds;
}

function formatSecondsToHuman(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    if (totalSeconds >= 3600) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
        const s = (totalSeconds % 60).toString().padStart(2, "0");
        return `${h}:${m}:${s}`;
    }
    const m = Math.floor(totalSeconds / 60);
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function updateStretchTotalTimeDisplay() {
    if (!stretchTotalTimeEl) return;
    const sets = stretchSetsInput ? Math.max(1, parseInt(stretchSetsInput.value, 10) || 1) : 1;
    const totalSec = computeStretchTotalSeconds(sets);
    if (totalSec === 0) {
        stretchTotalTimeEl.textContent = "";
    } else {
        stretchTotalTimeEl.textContent = ` — Total ${formatSecondsToHuman(totalSec)}`;
    }
}

function updateStretchRoutineHighlights() {
    if (!stretchRoutineList || !stretchRoutine.length) return;

    const items = stretchRoutineList.querySelectorAll("li");
    items.forEach((item, index) => {
        item.classList.remove("active", "resting");
        if (stretchRunPhase === "exercise" && index === stretchRunIndex) {
            item.classList.add("active");
        } else if (stretchRunPhase === "rest" && index === stretchRunIndex) {
            item.classList.add("resting");
        }
    });
}

function formatHistoryDate(isoString) {
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
    const timeStr = d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });
    return { dateStr, timeStr };
}

function createLogListItem(log) {
    const { dateStr, timeStr } = formatHistoryDate(log.timestamp);
    return `<li>
                <span class="dur">${log.durationSeconds}s</span>
                <div class="datetime">
                    <span>${dateStr}</span>
                    <span>${timeStr}</span>
                </div>
            </li>`;
}

function generateDummyData(exerciseName) {
    const dummyTemplates = {
        "Dead Hang": [
            { duration: 45, daysAgo: 14 },
            { duration: 52, daysAgo: 12 },
            { duration: 48, daysAgo: 10 },
            { duration: 58, daysAgo: 8 },
            { duration: 55, daysAgo: 6 },
            { duration: 62, daysAgo: 4 },
            { duration: 68, daysAgo: 2 },
            { duration: 72, daysAgo: 1 },
        ],
    };

    const template = dummyTemplates[exerciseName] || [
        { duration: 30, daysAgo: 10 },
        { duration: 35, daysAgo: 7 },
        { duration: 40, daysAgo: 5 },
        { duration: 42, daysAgo: 3 },
        { duration: 45, daysAgo: 1 },
    ];

    const now = new Date();
    return template.map((item) => {
        const date = new Date(now);
        date.setDate(date.getDate() - item.daysAgo);
        date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
        return {
            exercise: exerciseName,
            durationSeconds: item.duration,
            timestamp: date.toISOString(),
        };
    });
}

function updateHistoryUI() {
    const selectedEx = exerciseSelect.value;
    let allLogs = JSON.parse(localStorage.getItem("workoutLogs")) || [];

    let filtered = allLogs.filter((log) => log.exercise === selectedEx);

    // Generate dummy data if no data exists for this exercise
    if (filtered.length === 0) {
        filtered = generateDummyData(selectedEx);
    }

    const recent = [...filtered].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
    );
    const best = [...filtered].sort(
        (a, b) => b.durationSeconds - a.durationSeconds,
    );

    const emptyMsg = `<li><span class="text-muted">No data yet</span></li>`;

    recentList.innerHTML =
        recent.slice(0, 3).map(createLogListItem).join("") || emptyMsg;
    bestList.innerHTML =
        best.slice(0, 3).map(createLogListItem).join("") || emptyMsg;
    allHistoryList.innerHTML =
        recent.map(createLogListItem).join("") || emptyMsg;

    // Update chart
    renderPerformanceChart(filtered, selectedEx);
}

function renderPerformanceChart(logs, exerciseName) {
    if (!performanceChartCanvas) return;

    // Sort logs by timestamp (oldest first)
    let sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (sorted.length === 0) {
        // Destroy existing chart if no data
        if (performanceChart) {
            performanceChart.destroy();
            performanceChart = null;
        }
        return;
    }

    // Aggregate data to keep only the best time per day
    const dailyBest = {};
    sorted.forEach((log) => {
        const d = new Date(log.timestamp);
        const dateKey = d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });

        if (!dailyBest[dateKey] || log.durationSeconds > dailyBest[dateKey].durationSeconds) {
            dailyBest[dateKey] = log;
        }
    });

    // Convert back to sorted array
    sorted = Object.values(dailyBest).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Prepare data
    const labels = sorted.map((log) => {
        const d = new Date(log.timestamp);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    });

    const data = sorted.map((log) => log.durationSeconds);

    // Get goal and prepare goal line
    const goal = getGoal(exerciseName);
    const goalData = goal > 0 ? labels.map(() => goal) : null;

    // Calculate y-axis max (slightly above max value and goal)
    const maxData = Math.max(...data);
    const maxValue = Math.max(maxData, goal);
    const yAxisMax = Math.ceil(maxValue * 1.1); // 10% padding above max

    const ctx = performanceChartCanvas.getContext("2d");

    // Destroy existing chart to avoid memory leaks
    if (performanceChart) {
        performanceChart.destroy();
    }

    // Build datasets array
    const datasets = [
        {
            label: "Best Hold Duration (s)",
            data: data,
            borderColor: "#30d158",
            backgroundColor: "rgba(48, 209, 88, 0.35)",
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: "#30d158",
            pointBorderColor: "#30d158",
            pointBorderWidth: 2,
            tension: 0.3,
            fill: true,
        },
    ];

    // Add goal line if goal is set
    if (goalData) {
        datasets.push({
            label: "Goal",
            data: goalData,
            borderColor: "#0a84ff",
            borderWidth: 2,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
            tension: 0,
        });
    }

    performanceChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: "index",
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: "#ffffff",
                        font: { size: 12, weight: "600" },
                        padding: 12,
                    },
                },
                tooltip: {
                    backgroundColor: "rgba(0, 0, 0, 0.95)",
                    titleColor: "#ffffff",
                    bodyColor: "#ffffff",
                    borderColor: "#30d158",
                    borderWidth: 2,
                    padding: 10,
                    displayColors: true,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: yAxisMax,
                    ticks: { color: "#b0b0b5", font: { size: 11, weight: "500" } },
                    grid: { color: "#2c2c2e", drawBorder: false },
                    title: { display: true, text: "Duration (seconds)", color: "#ffffff", font: { size: 12, weight: "600" } },
                },
                x: {
                    ticks: {
                        color: "#b0b0b5",
                        font: { size: 10, weight: "500" },
                        maxRotation: 45,
                        minRotation: 0,
                    },
                    grid: { display: false },
                },
            },
        },
    });
}

function saveWorkout(data) {
    const logs = JSON.parse(localStorage.getItem("workoutLogs")) || [];
    logs.push(data);
    localStorage.setItem("workoutLogs", JSON.stringify(logs));
    updateHistoryUI();
    resetUI();
    saveModal.classList.add("hidden");
    startRestTimer();
}

// --- 3. Settings Logic ---
function loadSettings(exerciseName) {
    const saved =
        JSON.parse(localStorage.getItem(`settings_ex_${exerciseName}`)) ||
        JSON.parse(localStorage.getItem("settings_default"));
    if (saved) {
        if (saved.prepTime != null) prepTimeInput.value = saved.prepTime;
        if (saved.voiceStart != null) voiceStartInput.value = saved.voiceStart;
        if (saved.restTime != null) restTimeInput.value = saved.restTime;
    }

    // Load goal
    const goal = JSON.parse(localStorage.getItem(`goal_${exerciseName}`)) || 0;
    if (exerciseGoal) exerciseGoal.value = goal;

    updateSettingsPill();
}

function saveGoal(exerciseName, goalSeconds) {
    localStorage.setItem(`goal_${exerciseName}`, JSON.stringify(goalSeconds));
    updateHistoryUI();
}

function getGoal(exerciseName) {
    return parseInt(localStorage.getItem(`goal_${exerciseName}`)) || 0;
}

function updateSettingsPill() {
    const prep = parseInt(prepTimeInput.value) || 0;
    const voice = parseInt(voiceStartInput.value) || 0;
    const rest = isNaN(parseInt(restTimeInput.value)) ? 0 : parseInt(restTimeInput.value);
    settingsPill.innerHTML =
        `<span class="pill-item" data-field="prep">Prep <strong>${prep}s</strong></span>` +
        `<span class="pill-item" data-field="voice">Voice @ <strong>${voice}s</strong></span>` +
        `<span class="pill-item" data-field="rest">Rest <strong>${rest}s</strong></span>`;
}

let _currentEditField = null;

settingsPill.addEventListener("click", (e) => {
    if (isRunning || isPrep) return;
    const pill = e.target.closest(".pill-item");
    if (!pill) return;
    _currentEditField = pill.dataset.field;
    if (_currentEditField === "prep") {
        settingEditTitle.textContent = "Prep Time";
        settingEditInput.value = isNaN(parseInt(prepTimeInput.value)) ? 0 : parseInt(prepTimeInput.value);
        restPresets.style.display = "none";
    } else if (_currentEditField === "voice") {
        settingEditTitle.textContent = "Voice Start";
        settingEditInput.value = isNaN(parseInt(voiceStartInput.value)) ? 0 : parseInt(voiceStartInput.value);
        restPresets.style.display = "none";
    } else {
        settingEditTitle.textContent = "Rest Time";
        settingEditInput.value = isNaN(parseInt(restTimeInput.value)) ? 0 : parseInt(restTimeInput.value);
        restPresets.style.display = "flex";
    }
    settingEditModal.classList.remove("hidden");
    setTimeout(() => { settingEditInput.focus(); settingEditInput.select(); }, 10);
});

cancelSettingEditBtn.addEventListener("click", () => {
    settingEditModal.classList.add("hidden");
});

function applySettingEdit() {
    const val = Math.max(0, parseInt(settingEditInput.value) || 0);
    if (_currentEditField === "prep") {
        prepTimeInput.value = val;
    } else if (_currentEditField === "voice") {
        voiceStartInput.value = val;
    } else {
        restTimeInput.value = val;
    }
    const payload = JSON.stringify({
        prepTime: isNaN(parseInt(prepTimeInput.value)) ? 5 : parseInt(prepTimeInput.value),
        voiceStart: isNaN(parseInt(voiceStartInput.value)) ? 30 : parseInt(voiceStartInput.value),
        restTime: isNaN(parseInt(restTimeInput.value)) ? 0 : parseInt(restTimeInput.value),
    });
    localStorage.setItem(`settings_ex_${exerciseSelect.value}`, payload);
    localStorage.setItem("settings_default", payload);
    updateSettingsPill();
    settingEditModal.classList.add("hidden");
}

confirmSettingEditBtn.addEventListener("click", applySettingEdit);

settingEditInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applySettingEdit();
    if (e.key === "Escape") settingEditModal.classList.add("hidden");
});

presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        settingEditInput.value = btn.dataset.value;
        applySettingEdit();
    });
});

function updateSaveExerciseLabel() {
    if (saveExerciseLabel && exerciseSelect) saveExerciseLabel.textContent = exerciseSelect.value;
}

function flashBtn(btn) {
    const original = btn.innerHTML;
    btn.innerHTML = "Saved ✓";
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = original;
        btn.disabled = false;
    }, 1500);
}

saveDefaultBtn.addEventListener("click", () => {
    localStorage.setItem(
        "settings_default",
        JSON.stringify({
            prepTime: isNaN(parseInt(prepTimeInput.value)) ? 5 : parseInt(prepTimeInput.value),
            voiceStart: isNaN(parseInt(voiceStartInput.value)) ? 30 : parseInt(voiceStartInput.value),
            restTime: isNaN(parseInt(restTimeInput.value)) ? 0 : parseInt(restTimeInput.value),
        }),
    );
    updateSettingsPill();
    flashBtn(saveDefaultBtn);
});

saveExerciseBtn.addEventListener("click", () => {
    localStorage.setItem(
        `settings_ex_${exerciseSelect.value}`,
        JSON.stringify({
            prepTime: isNaN(parseInt(prepTimeInput.value)) ? 5 : parseInt(prepTimeInput.value),
            voiceStart: isNaN(parseInt(voiceStartInput.value)) ? 30 : parseInt(voiceStartInput.value),
            restTime: isNaN(parseInt(restTimeInput.value)) ? 0 : parseInt(restTimeInput.value),
        }),
    );

    // Save goal
    saveGoal(exerciseSelect.value, parseInt(exerciseGoal.value) || 0);

    updateSettingsPill();
    flashBtn(saveExerciseBtn);
});

// --- 4. Audio & Speech Logic ---
function playSound(type) {
    if (!audioUnlocked || audioCtx.state !== "running") return;

    const now = audioCtx.currentTime;

    // Helper to play a single tone with an ADSR-like envelope
    function playTone(freq, type = "sine", duration = 0.15, peak = 0.12, when = 0) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + when);
        gain.gain.setValueAtTime(0.0001, now + when);
        gain.gain.linearRampToValueAtTime(peak, now + when + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + when + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + when);
        osc.stop(now + when + duration + 0.02);
    }

    if (type === "prep") {
        // short, crisp tick every second handled elsewhere; here a short high click
        playTone(1400, "square", 0.08, 0.08);
    } else if (type === "start") {
        // pleasant two-tone chime
        playTone(880, "sine", 0.22, 0.14, 0);
        playTone(1320, "sine", 0.28, 0.10, 0.06);
    } else if (type === "10sec") {
        // two quick rising beeps
        playTone(600, "sine", 0.12, 0.10, 0);
        playTone(750, "sine", 0.12, 0.10, 0.12);
    } else if (type === "5sec") {
        // brief alert
        playTone(1000, "triangle", 0.10, 0.09, 0);
    } else {
        // default short click
        playTone(800, "sine", 0.12, 0.08, 0);
    }
}

function speak(text) {
    if (!audioUnlocked || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.rate = 1.5;
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) msg.voice = voices[0];
    window.speechSynthesis.speak(msg);
}

// --- 5. Timer Core Logic ---
function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    const rms = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}.${rms.toString().padStart(2, "0")}`;
}

function formatCountdown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function update() {
    const now = Date.now();
    if (isPrep) {
        const remaining = prepEndTime - now;
        if (remaining <= 0) {
            isPrep = false;
            isRunning = true;
            startTime = Date.now();
            status.textContent = "HOLD!";
            status.style.color = "var(--accent-green)";
            lastBeepSecond = 0;
            playSound("start");
        } else {
            display.textContent = formatTime(remaining);
            if (Math.ceil(remaining / 1000) !== lastBeepSecond) {
                playSound("prep");
                lastBeepSecond = Math.ceil(remaining / 1000);
            }
        }
    } else if (isRunning) {
        elapsedTime = now - startTime;
        display.textContent = formatTime(elapsedTime);
        const curSec = Math.floor(elapsedTime / 1000);

        if (curSec > lastBeepSecond) {
            lastBeepSecond = curSec;

            // Trigger interval beeps
            if (curSec % 10 === 0) {
                playSound("10sec");
            } else if (curSec % 5 === 0) {
                playSound("5sec");
            }

            // Trigger voice count (independent of beeps)
            const voiceThreshold = parseInt(voiceStartInput.value || 999);
            if (curSec >= voiceThreshold) {
                speak(curSec.toString());
            }
        }
    }
    if (isRunning || isPrep) animationFrameId = requestAnimationFrame(update);
}

// --- 6. Main Controls ---
startBtn.addEventListener("click", () => {
    unlockAudio();
    primeSpeechSynthesis();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    resetBtn.disabled = true;

    prepTimeInput.disabled = true;
    voiceStartInput.disabled = true;
    if (exerciseSelect) exerciseSelect.disabled = true;

    const p = parseInt(prepTimeInput.value) || 0;
    if (p > 0 && elapsedTime === 0) {
        isPrep = true;
        prepEndTime = Date.now() + p * 1000;
        lastBeepSecond = p;
        status.textContent = "GET READY";
        status.style.color = "var(--accent-blue)";
    } else {
        isRunning = true;
        startTime = Date.now() - elapsedTime;
        status.textContent = "HOLD!";
        status.style.color = "var(--accent-green)";
    }
    // Try Wake Lock first; fall back to NoSleep when unsupported
    requestWakeLock().then((granted) => {
        if (!granted) enableNoSleep();
    });

    update();
});

stopBtn.addEventListener("click", () => {
    isRunning = false;
    isPrep = false;
    cancelAnimationFrame(animationFrameId);
    // Release any wake locks or NoSleep when stopping
    releaseWakeLock();
    disableNoSleep();
    stopBtn.disabled = true;
    resetBtn.disabled = false;
    status.textContent = "FINISHED";
    status.style.color = "var(--text-main)";

    if (exerciseSelect) modalExerciseName.textContent = exerciseSelect.value;
    editMinutes.value = Math.floor(elapsedTime / 60000);
    editSeconds.value = Math.floor((elapsedTime % 60000) / 1000);
    saveModal.classList.remove("hidden");
    setTimeout(() => { editMinutes.focus(); editMinutes.select(); }, 50);
});

cancelSaveBtn.addEventListener("click", () => {
    saveModal.classList.add("hidden");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = "PAUSED";
    // stop preventing screen sleep when paused
    releaseWakeLock();
    disableNoSleep();
});

confirmSaveBtn.addEventListener("click", () => {
    const totalSeconds =
        parseInt(editMinutes.value || 0) * 60 +
        parseInt(editSeconds.value || 0);
    saveWorkout({
        exercise: exerciseSelect.value,
        durationSeconds: totalSeconds,
        timestamp: new Date().toISOString(),
    });
});

// --- Rest Timer ---
function startRestTimer() {
    const restSecs = isNaN(parseInt(restTimeInput.value)) ? 0 : parseInt(restTimeInput.value);
    if (restSecs <= 0) return;
    isResting = true;
    restEndTime = Date.now() + restSecs * 1000;
    status.textContent = "REST";
    status.style.color = "var(--accent-red)";
    display.style.color = "var(--accent-red)";
    startBtn.disabled = true;
    stopBtn.disabled = true;
    resetBtn.disabled = false;
    resetBtn.textContent = "SKIP";
    tickRest();
}

function tickRest() {
    if (!isResting) return;
    const remaining = restEndTime - Date.now();
    if (remaining <= 0) {
        finishRest();
        return;
    }
    display.textContent = formatTime(remaining);
    restAnimFrameId = requestAnimationFrame(tickRest);
}

function finishRest() {
    isResting = false;
    cancelAnimationFrame(restAnimFrameId);
    display.style.color = "";
    resetBtn.textContent = "RESET";
    playSound("start");
    resetUI();
}

function resetUI() {
    if (isResting) {
        isResting = false;
        cancelAnimationFrame(restAnimFrameId);
        display.style.color = "";
        resetBtn.textContent = "RESET";
    }
    elapsedTime = 0;
    lastBeepSecond = 0;
    display.textContent = "00:00.00";
    status.textContent = "READY";
    status.style.color = "var(--text-muted)";
    startBtn.disabled = false;
    stopBtn.disabled = true;
    resetBtn.disabled = false;
    prepTimeInput.disabled = false;
    voiceStartInput.disabled = false;
    if (exerciseSelect) exerciseSelect.disabled = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    // release any locks when resetting
    releaseWakeLock();
    disableNoSleep();
}

resetBtn.addEventListener("click", resetUI);

if (enableSoundBtn) {
    enableSoundBtn.addEventListener("click", async () => {
        await unlockAudio();
        primeSpeechSynthesis();
    });
}

// Best-effort auto-unlock on first user interaction for iOS browsers.
const autoUnlockHandler = async () => {
    await unlockAudio();
    primeSpeechSynthesis();
    document.removeEventListener("touchstart", autoUnlockHandler);
    document.removeEventListener("pointerdown", autoUnlockHandler);
};

document.addEventListener("touchstart", autoUnlockHandler, { passive: true });
document.addEventListener("pointerdown", autoUnlockHandler, { passive: true });

if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener(
        "voiceschanged",
        primeSpeechSynthesis,
    );
}

// --- Initialize ---
// Re-request wake lock when page becomes visible again (some browsers require re-request)
document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && (isRunning || isPrep)) {
        const granted = await requestWakeLock();
        if (!granted) enableNoSleep();
    }
});

updateExerciseDropdown();
if (typeof renderStretchRoutine === "function") renderStretchRoutine();
