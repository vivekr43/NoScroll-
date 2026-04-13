// ──────────────────────────────────────────────────────────
//  NOscroll — interrupt.js  (v2 — matches new UI)
// ──────────────────────────────────────────────────────────

function msToDisplay(ms) {
    const m = Math.floor((ms ?? 0) / 60000);
    if (m <= 0) return "< 1m";
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

const SUB_MESSAGES = {
    avoidance: "You've been scrolling to avoid something real. It's not going away. Close this app.",
    boredom: "You've opened this thing multiple times in the last few minutes. You are literally that bored. Do one real thing instead.",
    latenight: "It's late. Your sleep matters more than this. The algorithm will still be here tomorrow.",
};

const BEHAVIOR_EMOJIS = {
    avoidance: "😬",
    boredom: "😐",
    latenight: "🌙",
};

// ── Sound Effect ──────────────────────────────────────────
function playAlertSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        
        function playTone(freq, time, duration) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.3, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(time);
            osc.stop(time + duration);
        }
        
        // A soft, descending double-chime to grab attention without being jarring
        playTone(659.25, ctx.currentTime, 0.4); // E5
        playTone(523.25, ctx.currentTime + 0.15, 0.5); // C5
    } catch (err) {
        console.warn('Audio play failed', err);
    }
}

// ── Receive data from content.js ─────────────────────────
window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "INTERRUPT_DATA") return;
    populateUI(e.data);
    playAlertSound();
});

function populateUI(data) {
    const { nudge, behavior, scrolls, timeMs } = data;

    // Sub message
    const subEl = document.getElementById("subMsg");
    if (subEl) subEl.textContent = SUB_MESSAGES[behavior] ?? "Time to take a breather.";

    // Stat pills
    document.getElementById("pillScrolls").textContent = scrolls ?? 0;
    document.getElementById("pillTime").textContent = msToDisplay(timeMs ?? 0);
    document.getElementById("pillBehavior").textContent = BEHAVIOR_EMOJIS[behavior] ?? "📱";

    // AI nudge
    const nudgeEl = document.getElementById("nudgeText");
    if (nudgeEl) nudgeEl.innerHTML = nudge
        ? `"${nudge}"`
        : '"Hey. You don\'t have to keep scrolling. You can just stop."';

    // Daily limit bar — pull from storage
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
        if (!state) return;
        const limitMs = state.dailyLimitMs ?? 30 * 60000;
        const totalUsed = (state.igTimeMs ?? 0) + (state.ytTimeMs ?? 0);
        const pct = Math.min(100, Math.round((totalUsed / limitMs) * 100));
        const barEl = document.getElementById("limitBar");
        const labelEl = document.getElementById("progressLabel");
        if (barEl) barEl.style.width = `${pct}%`;
        if (labelEl) labelEl.textContent = `Daily Limit: ${pct}% used`;
    });
}

// ── Buttons ───────────────────────────────────────────────
document.getElementById("btnStop").addEventListener("click", () => {
    window.parent.postMessage({ type: "STOP_SCROLLING" }, "*");
});
document.getElementById("btnSnooze").addEventListener("click", () => {
    window.parent.postMessage({ type: "SNOOZE" }, "*");
});
document.getElementById("btnIgnore").addEventListener("click", () => {
    window.parent.postMessage({ type: "CLOSE_INTERRUPT" }, "*");
});

// Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") window.parent.postMessage({ type: "CLOSE_INTERRUPT" }, "*");
});
