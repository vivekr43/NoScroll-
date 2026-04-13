// ──────────────────────────────────────────────────────────
//  NOscroll — background.js (Service Worker)  v2
//  Manages state, behavior classification, Claude API calls
// ──────────────────────────────────────────────────────────

// 🔑 ADD YOUR CLAUDE API KEY HERE
const CLAUDE_API_KEY = "YOUR_CLAUDE_API_KEY_HERE";
const CLAUDE_MODEL = "claude-opus-4-5";
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";

// ── Trigger Thresholds ───────────────────────────────────
// SCROLL_THRESHOLD: 50 real scrolls (at 4s throttle ≈ 3-4 min of active scrolling)
// Time threshold: reads dynamically from state.dailyLimitMs (user's chip selection)
const SCROLL_THRESHOLD = 50;
const LATE_NIGHT_HOUR = 23;
const BOREDOM_REOPEN_MS = 5 * 60 * 1000;
const SNOOZE_DURATION_MS = 5 * 60 * 1000;

// ── Default State ────────────────────────────────────────
const DEFAULT_STATE = {
  scrollCount: 0,         // session count — resets after each warning
  totalScrollsToday: 0,  // cumulative daily count — never resets on warning
  sessionStart: null,
  lastOpenTime: null,
  reopenCount: 0,
  warningsFired: 0,
  totalTimeMs: 0,
  streakDays: 0,
  lastStreakDate: null,
  snoozedUntil: null,
  shieldEnabled: true,
  dailyLimitMs: 30 * 60 * 1000,
  igTimeMs: 0,
  ytTimeMs: 0,
  lastNudge: "",
  lastBehavior: "",
  lastWarningTime: null,
};

// ── State helpers ─────────────────────────────────────────
async function getState() {
  return new Promise(resolve => {
    chrome.storage.local.get(DEFAULT_STATE, data => resolve(data));
  });
}

async function setState(updates) {
  return new Promise(resolve => {
    chrome.storage.local.set(updates, resolve);
  });
}

// ── Behavior Classifier ──────────────────────────────────
function classifyBehavior(state) {
  const hour = new Date().getHours();
  if (hour >= LATE_NIGHT_HOUR || hour < 4) return "latenight";
  if (state.reopenCount >= 2) return "boredom";
  return "avoidance";
}

// ── Claude API — Generate Nudge ──────────────────────────
async function generateNudge(behavior, stats) {
  const toneMap = {
    avoidance: "Be direct, real, and honest. Call out that they're using scrolling to avoid something. Tough love but supportive. Short — under 3 sentences.",
    boredom: "Be funny, sarcastic, and a little brutally honest. They're literally scrolling out of boredom. Make them laugh but also make a point. Under 3 sentences.",
    latenight: "Be gentle, caring, almost like a worried friend. It's late. They should sleep. Kind but real. Under 2 sentences.",
  };

  const systemPrompt = `You are NOscroll, a GenZ-coded digital wellness AI that helps people stop doom scrolling. ${toneMap[behavior]} Never use hashtags or emojis in excess. Speak like a real person, not a corporate wellness app.`;

  const userMsg = `The user has been scrolling for ${Math.round(stats.timeMs / 60000)} minutes, hit ${stats.scrolls} scrolls, and this is a "${behavior}" pattern. Write a short, punchy nudge message to interrupt them.`;

  try {
    const response = await fetch(CLAUDE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 150,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.content[0].text.trim();
  } catch (err) {
    console.warn("[NOscroll] Claude API failed, using fallback:", err);
    const fallbacks = {
      avoidance: "Whatever you're avoiding isn't going anywhere. Neither is this feed. But you know deep down you're hiding. Close the app.",
      boredom: "You've opened this thing like 3 times in 5 minutes. Even your phone is judging you rn. Do literally anything else.",
      latenight: "Hey. It's late. These videos will still be here tomorrow. Your sleep won't come back though. Put the phone down, for real.",
    };
    return fallbacks[behavior];
  }
}

// ── Main Trigger — called when threshold hit ─────────────
async function fireWarning(tabId, site) {
  const state = await getState();

  // Check snooze
  if (state.snoozedUntil && Date.now() < state.snoozedUntil) return;

  // Time threshold = whatever the user picked with the limit chip
  const timeThresholdMs = state.dailyLimitMs ?? (15 * 60 * 1000);
  const timeMs = state.sessionStart ? Date.now() - state.sessionStart : 0;

  // Double-check threshold (race condition guard)
  const newCount = state.scrollCount ?? 0;
  if (newCount < SCROLL_THRESHOLD && timeMs < timeThresholdMs) return;

  const behavior = classifyBehavior(state);
  const nudge = await generateNudge(behavior, { scrolls: newCount, timeMs });

  await setState({
    warningsFired: (state.warningsFired ?? 0) + 1,
    lastNudge: nudge,
    lastBehavior: behavior,
    lastWarningTime: Date.now(),
    totalTimeMs: (state.totalTimeMs ?? 0) + timeMs,
    // reset session only — totalScrollsToday stays
    scrollCount: 0,
    sessionStart: null,
  });

  // Tell content script to show overlay
  // Guard: content script might not be ready yet (just ignore if so)
  if (!tabId) return;
  chrome.tabs.sendMessage(
    tabId,
    { type: "SHOW_INTERRUPT", nudge, behavior, scrolls: state.totalScrollsToday, timeMs, site },
    () => {
      if (chrome.runtime.lastError) {
        // Content script not ready — re-inject it then retry once
        console.warn("[NOscroll] Content script not responding, re-injecting:", chrome.runtime.lastError.message);
        chrome.scripting.executeScript(
          { target: { tabId }, files: ["content.js"] },
          () => {
            if (chrome.runtime.lastError) return;
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {
                type: "SHOW_INTERRUPT", nudge, behavior,
                scrolls: state.totalScrollsToday, timeMs, site,
              });
            }, 800);
          }
        );
      }
    }
  );
}

// ── Message Listener (from content.js) ───────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (msg.type === "SCROLL_EVENT") {
    (async () => {
      try {
        const state = await getState();
        if (!state.shieldEnabled) { sendResponse({ ok: true }); return; }

        const now = Date.now();
        const newCount = (state.scrollCount ?? 0) + 1;
        const sessionStart = state.sessionStart || now;
        const elapsed = now - sessionStart;

        // time threshold comes from user's selected limit chip
        const timeThresholdMs = state.dailyLimitMs ?? (15 * 60 * 1000);

        console.log(`[NOscroll] Scroll #${newCount} (today: ${(state.totalScrollsToday ?? 0) + 1}) on ${msg.site} | elapsed: ${Math.round(elapsed / 1000)}s / threshold: ${Math.round(timeThresholdMs / 60000)}min`);

        const updates = {
          scrollCount: newCount,
          totalScrollsToday: (state.totalScrollsToday ?? 0) + 1,
          sessionStart: sessionStart,
          igTimeMs: msg.site === "instagram" ? (state.igTimeMs ?? 0) + 4000 : (state.igTimeMs ?? 0),
          ytTimeMs: msg.site === "youtube" ? (state.ytTimeMs ?? 0) + 4000 : (state.ytTimeMs ?? 0),
        };
        await setState(updates);

        // Fire when 50 real scrolls OR user's chosen time limit reached
        if (newCount >= SCROLL_THRESHOLD || elapsed >= timeThresholdMs) {
          await fireWarning(tabId, msg.site);
        }
        sendResponse({ ok: true });
      } catch (err) {
        console.error("[NOscroll] SCROLL_EVENT error:", err);
        sendResponse({ ok: false });
      }
    })();
    return true; // keep channel open for async
  }

  if (msg.type === "TAB_OPENED") {
    (async () => {
      const state = await getState();
      const now = Date.now();
      const recentReopen = state.lastOpenTime && (now - state.lastOpenTime < BOREDOM_REOPEN_MS);
      await setState({
        lastOpenTime: now,
        reopenCount: recentReopen ? state.reopenCount + 1 : 1,
        sessionStart: now,
        scrollCount: 0,
      });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "SNOOZE") {
    (async () => {
      await setState({ snoozedUntil: Date.now() + SNOOZE_DURATION_MS });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "STOP_SCROLLING") {
    (async () => {
      await setState({ scrollCount: 0, sessionStart: null, snoozedUntil: null });
      if (tabId) chrome.tabs.update(tabId, { url: "https://www.google.com" });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "GET_STATE") {
    getState().then(state => sendResponse(state));
    return true;
  }

  if (msg.type === "SET_SHIELD") {
    setState({ shieldEnabled: msg.enabled }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "SET_LIMIT") {
    setState({ dailyLimitMs: msg.limitMs }).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// ── Daily Reset Alarm ─────────────────────────────────────
chrome.alarms.create("dailyReset", { when: nextMidnight(), periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "dailyReset") {
    updateStreak().then(() => {
      setState({
        scrollCount: 0,
        totalScrollsToday: 0,   // ← reset the daily total at midnight
        sessionStart: null,
        warningsFired: 0,
        igTimeMs: 0,
        ytTimeMs: 0,
        reopenCount: 0,
        totalTimeMs: 0,
      });
    });
  }
});

function nextMidnight() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

async function updateStreak() {
  const state = await getState();
  const today = new Date().toDateString();
  if (state.lastStreakDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const streak = (state.lastStreakDate === yesterday) ? state.streakDays + 1 : 1;
  await setState({ streakDays: streak, lastStreakDate: today });
}

console.log("[NOscroll] Background service worker started ✓");
