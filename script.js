// --- DOM Elements ---
const display = document.getElementById("display");
const status = document.getElementById("status");
const prepTimeInput = document.getElementById("prepTime");
const voiceStartInput = document.getElementById("voiceStart");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const enableSoundBtn = document.getElementById("enableSoundBtn");

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
const performanceChartCanvas = document.getElementById("performanceChart");

// Chart instance
let performanceChart = null;

// Settings Elements
const saveDefaultBtn = document.getElementById("saveDefaultBtn");
const saveExerciseBtn = document.getElementById("saveExerciseBtn");
const saveExerciseLabel = document.getElementById("saveExerciseLabel");
const settingsPill = document.getElementById("settingsPill");

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
    "Dead Hang",
];

function updateDropdown() {
    exerciseSelect.innerHTML = exercises
        .map((ex) => `<option value="${ex}">${ex}</option>`)
        .join("");
    updateHistoryUI();
    loadSettings(exerciseSelect.value);
    updateSaveExerciseLabel();
}

exerciseSelect.addEventListener("change", () => {
    updateHistoryUI();
    loadSettings(exerciseSelect.value);
    updateSaveExerciseLabel();
});

addExerciseBtn.addEventListener("click", () => {
    const name = prompt("Enter new exercise name:");
    if (name && name.trim() !== "") {
        exercises.push(name.trim());
        localStorage.setItem("myExercises", JSON.stringify(exercises));
        updateDropdown();
        exerciseSelect.value = name.trim();
        updateHistoryUI();
        loadSettings(name.trim());
        updateSaveExerciseLabel();
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
    renderPerformanceChart(filtered);
}

function renderPerformanceChart(logs) {
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

    // Calculate trend line (simple moving average)
    const windowSize = Math.min(3, sorted.length);
    const trendData = data.map((_, idx) => {
        const start = Math.max(0, idx - Math.floor(windowSize / 2));
        const end = Math.min(data.length, idx + Math.floor(windowSize / 2) + 1);
        const avg = data.slice(start, end).reduce((a, b) => a + b, 0) / (end - start);
        return avg;
    });

    const ctx = performanceChartCanvas.getContext("2d");

    // Destroy existing chart to avoid memory leaks
    if (performanceChart) {
        performanceChart.destroy();
    }

    performanceChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
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
                {
                    label: "Trend",
                    data: trendData,
                    borderColor: "#9c9ca3",
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0.3,
                },
            ],
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
}

// --- 3. Settings Logic ---
function loadSettings(exerciseName) {
    const saved =
        JSON.parse(localStorage.getItem(`settings_ex_${exerciseName}`)) ||
        JSON.parse(localStorage.getItem("settings_default"));
    if (saved) {
        if (saved.prepTime != null) prepTimeInput.value = saved.prepTime;
        if (saved.voiceStart != null) voiceStartInput.value = saved.voiceStart;
    }
    updateSettingsPill();
}

function updateSettingsPill() {
    const prep = parseInt(prepTimeInput.value) || 0;
    const voice = parseInt(voiceStartInput.value) || 0;
    settingsPill.innerHTML =
        `<span class="pill-item">Prep <strong>${prep}s</strong></span>` +
        `<span class="pill-item">Voice @ <strong>${voice}s</strong></span>`;
}

function updateSaveExerciseLabel() {
    if (saveExerciseLabel) saveExerciseLabel.textContent = exerciseSelect.value;
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
            prepTime: parseInt(prepTimeInput.value) || 5,
            voiceStart: parseInt(voiceStartInput.value) || 30,
        }),
    );
    updateSettingsPill();
    flashBtn(saveDefaultBtn);
});

saveExerciseBtn.addEventListener("click", () => {
    localStorage.setItem(
        `settings_ex_${exerciseSelect.value}`,
        JSON.stringify({
            prepTime: parseInt(prepTimeInput.value) || 5,
            voiceStart: parseInt(voiceStartInput.value) || 30,
        }),
    );
    updateSettingsPill();
    flashBtn(saveExerciseBtn);
});

// --- 4. Audio & Speech Logic ---
function playSound(type) {
    if (!audioUnlocked || audioCtx.state !== "running") return;
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

updateDropdown();
