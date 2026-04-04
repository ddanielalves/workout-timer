// --- DOM Elements ---
const display = document.getElementById("display");
const status = document.getElementById("status");
const prepTimeInput = document.getElementById("prepTime");
const voiceStartInput = document.getElementById("voiceStart");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");

const exerciseSelect = document.getElementById("exerciseSelect");
const addExerciseBtn = document.getElementById("addExerciseBtn");

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

// Navigation Elements
const navBtns = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

// --- Timer State ---
let startTime, animationFrameId, prepEndTime;
let isRunning = false;
let isPrep = false;
let elapsedTime = 0;
let lastBeepSecond = 0;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 1. Navigation Logic ---
navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        navBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        views.forEach((v) => v.classList.remove("active-view"));
        document
            .getElementById(btn.dataset.target)
            .classList.add("active-view");

        if (btn.dataset.target === "view-history") updateHistoryUI();
    });
});

// --- 2. Exercise & Storage Logic ---
let exercises = JSON.parse(localStorage.getItem("myExercises")) || [
    "Plank",
    "L-Sit",
    "Dead Hang",
];

function updateDropdown() {
    exerciseSelect.innerHTML = exercises
        .map((ex) => `<option value="${ex}">${ex}</option>`)
        .join("");
    updateHistoryUI();
}

exerciseSelect.addEventListener("change", updateHistoryUI);

addExerciseBtn.addEventListener("click", () => {
    const name = prompt("Enter new exercise name:");
    if (name && name.trim() !== "") {
        exercises.push(name.trim());
        localStorage.setItem("myExercises", JSON.stringify(exercises));
        updateDropdown();
        exerciseSelect.value = name.trim();
        updateHistoryUI();
    }
});

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

function updateHistoryUI() {
    const selectedEx = exerciseSelect.value;
    const allLogs = JSON.parse(localStorage.getItem("workoutLogs")) || [];

    const filtered = allLogs.filter((log) => log.exercise === selectedEx);
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
}

function saveWorkout(data) {
    const logs = JSON.parse(localStorage.getItem("workoutLogs")) || [];
    logs.push(data);
    localStorage.setItem("workoutLogs", JSON.stringify(logs));
    updateHistoryUI();
    resetUI();
    saveModal.classList.add("hidden");
}

// --- 3. Audio & Speech Logic ---
function playSound(type) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "prep") {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === "start") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === "10sec") {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === "5sec") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }
}

function speak(text) {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.rate = 1.5;
    window.speechSynthesis.speak(msg);
}

// --- 4. Timer Core Logic ---
function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    const rms = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}.${rms.toString().padStart(2, "0")}`;
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

// --- 5. Main Controls ---
startBtn.addEventListener("click", () => {
    audioCtx.resume();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    resetBtn.disabled = true;

    prepTimeInput.disabled = true;
    voiceStartInput.disabled = true;
    exerciseSelect.disabled = true;

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
    update();
});

stopBtn.addEventListener("click", () => {
    isRunning = false;
    isPrep = false;
    cancelAnimationFrame(animationFrameId);
    stopBtn.disabled = true;
    resetBtn.disabled = false;
    status.textContent = "FINISHED";
    status.style.color = "var(--text-main)";

    modalExerciseName.textContent = exerciseSelect.value;
    editMinutes.value = Math.floor(elapsedTime / 60000);
    editSeconds.value = Math.floor((elapsedTime % 60000) / 1000);
    saveModal.classList.remove("hidden");
});

cancelSaveBtn.addEventListener("click", () => {
    saveModal.classList.add("hidden");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = "PAUSED";
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

function resetUI() {
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
    exerciseSelect.disabled = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

resetBtn.addEventListener("click", resetUI);

// --- Initialize ---
updateDropdown();
