# Mobile Stopwatch (Timer)

Small mobile-friendly stopwatch/hold-tracker built with HTML/CSS/JS.
Test via [Github Pages](https://ddanielalves.github.io/workout-timer/)

**Purpose**

- Simple stopwatch for holds (e.g., dead hangs) with prep timer, beeps, and optional speech count.
- Keeps displayed elapsed time correct even if the page is suspended, using timestamp-based timing.
- Attempts to keep screen awake while running using the Screen Wake Lock API, with a NoSleep.js fallback when Wake Lock isn't available.

**Files**

- [index.html](index.html) — UI and app entry.
- [script.js](script.js) — Core logic, timing, audio, Wake Lock and NoSleep integration.
- [style.css](style.css) — Styles.

Usage

- Open [index.html](index.html) in a mobile browser (or host it on a local/remote server).
- Select an exercise (or add a new one), set `Prep (s)` and `Voice @ (s)` if desired.
- Press `START` to begin. `STOP` shows save modal; `RESET` clears the timer.

Limitations

- iOS Safari historically lacks the Screen Wake Lock API; NoSleep may help but is not guaranteed because OS-level policies can change.
- There is no reliable way for a web page to run JavaScript while the device enters deep sleep. For absolute background/always-running behavior, a native app is required.

**Storage & Contributions**

- All data (exercises, settings, and workout logs) is stored locally in your browser's `localStorage` and never sent to a server by this project.
- If you'd like server-backed storage, syncing, or any other feature, feel free to fork the repo and extend it.
- Contributions welcome — open issues or send pull requests and I'll review them.
