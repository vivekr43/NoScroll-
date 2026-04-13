// NOscroll — popup.js (vanilla JS, no dependencies)

// ─── Motivational Messages ────────────────────────────────
// Changes every hour. 48 messages = unique message for every hour across 2 days.
const MOTIVATIONS = [
  "Your attention is the most valuable thing you own. Spend it wisely.",
  "Every scroll is a vote for how you want to spend your life.",
  "The people who made this app are paid for every second you spend on it. Don't let them win.",
  "Boredom is not an emergency. You don't need to fix it with your phone.",
  "You'll never wish you'd scrolled more. You will wish you'd done more.",
  "What's one thing you've been putting off? Go do that instead.",
  "The reel you're about to watch will not change your life. Closing the app might.",
  "Real life doesn't have an algorithm. That's what makes it worth living.",
  "Your brain craves novelty. Give it something real — a walk, a conversation, a book.",
  "If you're scrolling to feel better, it won't work. It never does.",
  "Five minutes of scrolling turns into fifty. You know this.",
  "The best things in your life aren't on this app.",
  "Presence is a superpower. Everyone else is on their phone.",
  "Your future self is watching the choices you make right now.",
  "Scrolling is borrowing happiness you'll have to pay back with restlessness.",
  "Every time you put the phone down, your attention span gets a little stronger.",
  "You are more interesting than anything on that feed.",
  "The creators you're watching built something. What are you building?",
  "Rest is okay. Numbing is not the same as rest.",
  "What would you do right now if your phone didn't exist?",
  "You don't need more content. You need more time in your own head.",
  "The highlight reel you're watching is not anyone's real life.",
  "Dopamine from scrolling fades fast. Build something that lasts longer.",
  "Your concentration is a muscle. Every time you resist, it gets stronger.",
  "Being bored is the first step toward being creative.",
  "There's a version of you that doesn't need the phone to feel okay. You can be that person.",
  "Comparison is the thief of joy, and the feed is a comparison machine.",
  "Close the app. Take three deep breaths. Notice how that feels.",
  "You have actual goals. This app doesn't help with any of them.",
  "One hour of deep work beats five hours of half-attention and scrolling.",
  "The most interesting people you know probably spend less time on here.",
  "Your mind is quieter without the noise. Try it for 10 minutes.",
  "Not everything needs to be consumed. Some moments just need to be lived.",
  "The algorithm is designed to make you feel like you're missing out. You're not.",
  "Scrolling is easy. Everything worth having is a little harder.",
  "You've already seen enough today. The rest can wait.",
  "Real rest means no screen. Your brain hasn't had a break yet.",
  "Every time you choose presence over the phone, you win.",
  "Think of one person you want to spend more time with. Call them instead.",
  "The discomfort of putting the phone down passes in about 90 seconds. Wait it out.",
  "You'll remember the conversations, not the reels.",
  "Your eyes are tired. Your thumbs are tired. Your brain is tired. Stop.",
  "Nothing on that feed needs you right now. But your life does.",
  "Small choices made consistently are how people change their lives.",
  "How many of those reels do you actually remember from last week?",
  "The present moment is the only place where anything real happens.",
  "You opened this app for a reason you've already forgotten. That's okay — just stop now.",
  "The person you want to be doesn't spend hours here. Be that person today.",
];

function getMotivation() {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const hour = now.getHours();
  const idx = (dayOfYear * 24 + hour) % MOTIVATIONS.length;
  return MOTIVATIONS[idx];
}

function getNextHourMinutes() {
  const now = new Date();
  const mins = 59 - now.getMinutes();
  return mins === 0 ? "changes next minute" : `changes in ${mins} min`;
}

// ─── Helpers ──────────────────────────────────────────────
function msToMin(ms) { return Math.round((ms ?? 0) / 60000); }
function msToDisplay(ms) {
  const m = Math.floor((ms ?? 0) / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}
function pct(used, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}
function timeLabel(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning! 🌤";
  if (h < 17) return "Hey there! 👋";
  if (h < 21) return "Evening vibes! 🌙";
  return "Still up? 🦉";
}

const DEFAULT_STATE = {
  scrollCount: 0, totalScrollsToday: 0, sessionStart: null,
  lastOpenTime: null, reopenCount: 0, warningsFired: 0,
  totalTimeMs: 0, streakDays: 0, lastStreakDate: null,
  snoozedUntil: null, shieldEnabled: true,
  dailyLimitMs: 30 * 60 * 1000, igTimeMs: 0, ytTimeMs: 0,
  lastNudge: "", lastBehavior: "", lastWarningTime: null,
};

function sendMsg(type, payload = {}) {
  return new Promise(resolve =>
    chrome.runtime.sendMessage({ type, ...payload }, resolve)
  );
}

// ─── Tab switching ────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.getElementById(`tab-${tab}`).classList.add("active");
  });
});

// ─── Build week bar chart ──────────────────────────────────
function buildBarChart(todayMins) {
  const chart = document.getElementById("barChart");
  if (!chart) return;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const maxVal = Math.max(todayMins, 30);
  chart.innerHTML = "";
  days.forEach((day, i) => {
    const isToday = i === todayIdx;
    const val = isToday ? todayMins : 0;
    const heightPct = maxVal ? Math.max((val / maxVal) * 100, 4) : 4;
    const col = document.createElement("div");
    col.className = "bar-col";
    col.innerHTML = `
      <div class="bar-wrap">
        <div class="${isToday ? "bar-fill bar-today" : "bar-fill bar-empty"}" style="height:${heightPct}%"></div>
      </div>
      <div class="${isToday ? "bar-label bar-label-today" : "bar-label"}">${day}</div>
    `;
    chart.appendChild(col);
  });
}

// ─── Main render ──────────────────────────────────────────
function render(state) {
  if (!state) return;

  const scrolls = state.totalScrollsToday ?? 0;
  const totalMs = (state.igTimeMs ?? 0) + (state.ytTimeMs ?? 0);
  const warnings = state.warningsFired ?? 0;
  const streak = state.streakDays ?? 0;
  const limitMs = state.dailyLimitMs ?? 30 * 60000;
  const limitMins = msToMin(limitMs);
  const igMin = msToMin(state.igTimeMs ?? 0);
  const ytMin = msToMin(state.ytTimeMs ?? 0);
  const shieldOn = state.shieldEnabled ?? true;

  // ── Greeting & headline ──
  const greetEl = document.getElementById("greeting");
  const headlineEl = document.getElementById("headline");
  if (greetEl) greetEl.textContent = getGreeting();
  if (headlineEl) {
    if (scrolls === 0) {
      headlineEl.innerHTML = `You're <span>scroll-free</span> today! 🎉`;
    } else {
      headlineEl.innerHTML = `${scrolls} reels in —<br><span>Is it worth it?</span>`;
    }
  }

  const el = id => document.getElementById(id);
  if (el("statScrolls"))    el("statScrolls").textContent = scrolls;
  if (el("statScrollsSub")) el("statScrollsSub").textContent = scrolls === 0 ? "Clean slate! 🌿" : "↑ Today";
  if (el("statTime"))       el("statTime").textContent = msToDisplay(totalMs);
  if (el("statWarnings"))   el("statWarnings").textContent = warnings;
  if (el("statWarnSub"))    el("statWarnSub").textContent = warnings === 0 ? "Stay strong!" : warnings > 2 ? "You ignored a few 😅" : "Nice job!";
  if (el("statStreak"))     el("statStreak").innerHTML = `${streak}<small>d</small>`;
  if (el("igTime"))         el("igTime").textContent = `${igMin} min`;
  if (el("ytTime"))         el("ytTime").textContent = `${ytMin} min`;
  if (el("igBar"))          el("igBar").style.width = `${pct(state.igTimeMs ?? 0, limitMs)}%`;
  if (el("ytBar"))          el("ytBar").style.width = `${pct(state.ytTimeMs ?? 0, limitMs)}%`;

  const alertBlock = el("alertBlock");
  if (alertBlock) {
    if (state.lastWarningTime) {
      alertBlock.style.display = "flex";
      if (el("alertMsg")) el("alertMsg").innerHTML = `Triggered at <strong>${timeLabel(state.lastWarningTime)}</strong>`;
    } else {
      alertBlock.style.display = "none";
    }
  }

  // ── Motivation ──
  if (el("motivationText"))  el("motivationText").textContent = `"${getMotivation()}"`;
  if (el("motivationTimer")) el("motivationTimer").textContent = getNextHourMinutes();

  // ── Shield toggle ──
  const toggleEl = el("shieldToggle");
  const badgeEl  = el("shieldBadge");
  const statusEl = el("shieldStatus");
  if (toggleEl) { toggleEl.classList.toggle("on", shieldOn); toggleEl.classList.toggle("off", !shieldOn); }
  if (badgeEl)  { badgeEl.className = shieldOn ? "badge badge-on" : "badge badge-off"; badgeEl.textContent = shieldOn ? "● Active" : "● Paused"; }
  if (statusEl) statusEl.textContent = shieldOn ? "active" : "paused";

  let foundStandard = false;
  document.querySelectorAll(".chip:not(#customLimitBtn)").forEach(chip => {
    const isActive = parseInt(chip.dataset.mins) === limitMins;
    chip.classList.toggle("chip-active", isActive);
    if (isActive) foundStandard = true;
  });

  const customChip = el("customLimitBtn");
  if (customChip && limitMins > 0) {
    if (!foundStandard) {
        customChip.classList.add("chip-active");
        customChip.dataset.mins = limitMins;
        if (el("customLimitVal")) el("customLimitVal").textContent = limitMins;
        if (el("customLimitUnit")) el("customLimitUnit").textContent = "min";
    } else {
        customChip.classList.remove("chip-active");
        customChip.dataset.mins = "";
        if (el("customLimitVal")) el("customLimitVal").textContent = "✎";
        if (el("customLimitUnit")) el("customLimitUnit").textContent = "custom";
    }
  }

  if (el("infoLimit")) el("infoLimit").textContent = `${limitMins} min`;

  if (el("s-scrolls"))  el("s-scrolls").textContent = scrolls;
  if (el("s-time"))     el("s-time").textContent = msToDisplay(totalMs);
  if (el("s-warnings")) el("s-warnings").textContent = warnings;
  if (el("s-streak"))   el("s-streak").textContent = `${streak} day${streak !== 1 ? "s" : ""}`;
  if (el("s-ig"))       el("s-ig").textContent = msToDisplay(state.igTimeMs ?? 0);
  if (el("s-yt"))       el("s-yt").textContent = msToDisplay(state.ytTimeMs ?? 0);

  buildBarChart(msToMin(totalMs));

  const footer = el("statsFooter");
  if (footer) footer.textContent =
    scrolls === 0 ? "🌿 Zero scrolls today. Legendary."
    : streak > 2  ? `🔥 ${streak}-day streak. Don't break it.`
    : "Every session tracked. Stay aware.";
}

// ─── Event handlers ───────────────────────────────────────
document.getElementById("shieldToggle").addEventListener("click", async () => {
  const state = await sendMsg("GET_STATE");
  const newVal = !(state.shieldEnabled ?? true);
  await sendMsg("SET_SHIELD", { enabled: newVal });
  loadState();
});

document.querySelectorAll(".chip:not(#customLimitBtn)").forEach(chip => {
  chip.addEventListener("click", async () => {
    const limitMs = parseInt(chip.dataset.mins) * 60000;
    await sendMsg("SET_LIMIT", { limitMs });
    if (document.getElementById("customLimitWrap")) document.getElementById("customLimitWrap").style.display = "none";
    loadState();
  });
});

if (document.getElementById("customLimitBtn")) {
  document.getElementById("customLimitBtn").addEventListener("click", () => {
    const wrap = document.getElementById("customLimitWrap");
    if (wrap) wrap.style.display = wrap.style.display === "none" ? "flex" : "none";
  });
}

if (document.getElementById("saveCustomBtn")) {
  const saveAction = async () => {
    const input = document.getElementById("customLimitInput");
    const val = parseInt(input.value);
    if (!isNaN(val) && val > 0) {
      const limitMs = val * 60000;
      await sendMsg("SET_LIMIT", { limitMs });
      document.getElementById("customLimitWrap").style.display = "none";
      input.value = "";
      loadState();
    }
  };

  document.getElementById("saveCustomBtn").addEventListener("click", saveAction);
  document.getElementById("customLimitInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveAction();
  });
}

document.getElementById("resetBtn").addEventListener("click", async () => {
  await new Promise(resolve => chrome.storage.local.set({
    scrollCount: 0, totalScrollsToday: 0, sessionStart: null,
    warningsFired: 0, igTimeMs: 0, ytTimeMs: 0,
    lastWarningTime: null, lastNudge: "", lastBehavior: "",
  }, resolve));
  loadState();
});

// ─── Load & poll state ────────────────────────────────────
function loadState() {
  sendMsg("GET_STATE").then(render);
}

(function initMotivation() {
  const el = id => document.getElementById(id);
  if (el("motivationText"))  el("motivationText").textContent = `"${getMotivation()}"`;
  if (el("motivationTimer")) el("motivationTimer").textContent = getNextHourMinutes();
})();

loadState();
setInterval(loadState, 5000);
setInterval(() => {
  const el = id => document.getElementById(id);
  if (el("motivationText"))  el("motivationText").textContent = `"${getMotivation()}"`;
  if (el("motivationTimer")) el("motivationTimer").textContent = getNextHourMinutes();
}, 60000);
