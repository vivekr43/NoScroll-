// ──────────────────────────────────────────────────────────
//  NOscroll — content.js  (v3 — accurate scroll counting)
//
//  KEY CHANGES:
//  - Throttle raised to 4000ms (4 sec between reports)
//    → one "real scroll" = actually pausing on new content
//  - MutationObserver only re-attaches listeners, never counts
//  - Only wheel + container scroll count (most intentional)
//  - Touch/keyboard de-prioritised (only for UX signal)
// ──────────────────────────────────────────────────────────

(function () {
    "use strict";

    const site = location.hostname.includes("instagram") ? "instagram" : "youtube";
    let overlayActive = false;
    let lastReport = 0;

    // 4 seconds between scroll reports — accurate for "one reel watched"
    const THROTTLE_MS = 4000;

    // ── Tell background a new session started ───────────────
    chrome.runtime.sendMessage({ type: "TAB_OPENED", site });

    // ── Core: report ONE scroll event to background ─────────
    function reportScroll(source) {
        const now = Date.now();
        if (now - lastReport < THROTTLE_MS) return;
        if (overlayActive) return;

        lastReport = now;
        console.log(`[NOscroll] Scroll reported from: ${source}`);

        chrome.runtime.sendMessage({ type: "SCROLL_EVENT", site }, () => {
            if (chrome.runtime.lastError) return;
        });
    }

    // ── METHOD 1: wheel (primary — fires intentional scrolls) ─
    // Use "deltaY" magnitude gate: ignore tiny mousewheel ticks
    let wheelAccum = 0;
    let wheelFlush = null;

    window.addEventListener("wheel", (e) => {
        wheelAccum += Math.abs(e.deltaY);
        clearTimeout(wheelFlush);
        wheelFlush = setTimeout(() => {
            // Only count if total wheel travel was significant (1 full scroll)
            if (wheelAccum > 200) {
                reportScroll("wheel");
            }
            wheelAccum = 0;
        }, 300);
    }, { passive: true });

    // ── METHOD 2: window scroll (YouTube main feed) ──────────
    window.addEventListener("scroll", () => reportScroll("window-scroll"), { passive: true });

    // ── METHOD 3: attach to Instagram's internal divs ───────
    function attachToScrollContainers() {
        const candidates = document.querySelectorAll(
            'div[style*="overflow"][style*="scroll"],' +
            'div[style*="overflow: auto"],' +
            'div[style*="overflow-y: auto"],' +
            'div[style*="overflow-y: scroll"],' +
            'main, [role="main"]'
        );
        candidates.forEach(el => {
            if (!el._noscrollAttached) {
                el._noscrollAttached = true;
                el.addEventListener("scroll", () => reportScroll("container"), { passive: true });
            }
        });
    }
    attachToScrollContainers();

    // ── METHOD 4: MutationObserver — only re-attaches listeners
    //    Does NOT call reportScroll (avoids double-counting)
    const observer = new MutationObserver(() => {
        attachToScrollContainers(); // attach to any new containers
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ── METHOD 5: touch swipe — big gestures only ───────────
    let touchStartY = 0;
    document.addEventListener("touchstart", (e) => {
        touchStartY = e.touches[0]?.clientY ?? 0;
    }, { passive: true });
    document.addEventListener("touchend", (e) => {
        const delta = Math.abs((e.changedTouches[0]?.clientY ?? 0) - touchStartY);
        if (delta > 100) reportScroll("touch"); // significant swipe only
    }, { passive: true });

    // ── Listen for SHOW_INTERRUPT from background ───────────
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "SHOW_INTERRUPT") showInterrupt(msg);
    });

    // ── Inject Overlay iframe ────────────────────────────────
    function showInterrupt(data) {
        if (overlayActive) return;
        overlayActive = true;

        const iframe = document.createElement("iframe");
        iframe.id = "noscroll-interrupt-frame";
        iframe.src = chrome.runtime.getURL("interrupt/interrupt.html");
        Object.assign(iframe.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            zIndex: "2147483647",
            border: "none",
            background: "transparent",
            opacity: "0",
            transition: "opacity 0.35s ease",
        });

        document.body.appendChild(iframe);

        iframe.addEventListener("load", () => {
            iframe.style.opacity = "1";
            iframe.contentWindow.postMessage({ type: "INTERRUPT_DATA", ...data }, "*");
        });

        function handleMsg(e) {
            if (!e.data?.type) return;
            if (e.data.type === "CLOSE_INTERRUPT") { closeInterrupt(iframe); cleanup(); }
            if (e.data.type === "SNOOZE") { chrome.runtime.sendMessage({ type: "SNOOZE" }); closeInterrupt(iframe); cleanup(); }
            if (e.data.type === "STOP_SCROLLING") { chrome.runtime.sendMessage({ type: "STOP_SCROLLING" }); closeInterrupt(iframe); cleanup(); }
        }
        function cleanup() { window.removeEventListener("message", handleMsg); }
        window.addEventListener("message", handleMsg);
    }

    function closeInterrupt(iframe) {
        if (!iframe?.parentNode) return;
        iframe.style.opacity = "0";
        setTimeout(() => { iframe.remove(); overlayActive = false; }, 350);
    }

    console.log(`[NOscroll v3] Active on ${site} ✓ (throttle: 4s)`);
})();
