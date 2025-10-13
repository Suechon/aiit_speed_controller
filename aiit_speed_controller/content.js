// ===== 設定 =====
const STEP = 0.25;
const MAX_RATE = 4.0;
const MIN_RATE = 0.25;
const DEFAULT_RATE = 1.0;
const TIME_STEP = 5;

let lastVideo = null;

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function safeSetRate(v, rate) {
    const r = clamp(Number(rate || 1.0), MIN_RATE, MAX_RATE);
    try { v.playbackRate = r; } catch { }
    showBadge(r);
    notifyRate(r);
}

function notifyRate(rate) {
    try { chrome.runtime.sendMessage({ type: "RATE_CHANGED", rate }); } catch { }
}

let badgeTimer = null;
function showBadge(rate) {
    let el = document.getElementById("__kaltura_speed_badge");
    if (!el) {
        el = document.createElement("div");
        el.id = "__kaltura_speed_badge";
        el.style.cssText = `
      position: fixed; right: 12px; bottom: 12px; z-index: 2147483647;
      padding: 6px 10px; background: rgba(0,0,0,.6); color: #fff;
      font: 14px/1.2 system-ui, sans-serif; border-radius: 8px;
      pointer-events: none;
    `;
        document.documentElement.appendChild(el);
    }
    el.textContent = `× ${Number(rate).toFixed(2)}`;
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => el.remove(), 1200);
}

function getVideo() {
    if (lastVideo && document.contains(lastVideo)) return lastVideo;
    lastVideo = document.querySelector("video");
    return lastVideo;
}

function wireVideo(v) {
    if (!v || v.__kalturaSpeedWired) return;
    v.__kalturaSpeedWired = true;
    lastVideo = v;

    chrome.storage?.sync?.get(["initialRate"], (res) => {
        const init = Number(res.initialRate) || v.playbackRate || 1.0;
        safeSetRate(v, init);
    });

    v.addEventListener("ratechange", () => notifyRate(v.playbackRate));
}

function scanVideos() {
    document.querySelectorAll("video").forEach(wireVideo);
}


// 進める戻す
function safeSeek(v, deltaSec) {
    if (!v) return;
    const cur = Number(v.currentTime || 0);
    const dur = Number(v.duration || Infinity);
    const next = clamp(cur + Number(deltaSec || 0), 0, isFinite(dur) ? dur : cur + Number(deltaSec || 0));
    try { v.currentTime = next; } catch {}
    showSeekBadge(deltaSec);
}

let seekBadgeTimer = null;
function showSeekBadge(deltaSec) {
    const id = "__kaltura_seek_badge";
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.style.cssText = `
          position: fixed; right: 12px; bottom: 48px; z-index: 2147483647;
          padding: 6px 10px; background: rgba(0,0,0,.6); color: #fff;
          font: 14px/1.2 system-ui, sans-serif; border-radius: 8px;
          pointer-events: none;
        `;
        document.documentElement.appendChild(el);
    }
    const sign = (Number(deltaSec) >= 0) ? "+" : "";
    el.textContent = `${sign}${Number(deltaSec)}s`;
    clearTimeout(seekBadgeTimer);
    seekBadgeTimer = setTimeout(() => el.remove(), 800);
}

 
// 動的生成にも対応
const mo = new MutationObserver(() => scanVideos());
mo.observe(document.documentElement, { subtree: true, childList: true });
scanVideos();

// キーボード（iframe内で有効：D/S/R）
window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.isComposing) return;
    const v = getVideo();
    if (!v) return;
    if (e.key === "D") safeSetRate(v, (v.playbackRate || 1.0) + STEP);
    if (e.key === "S") safeSetRate(v, (v.playbackRate || 1.0) - STEP);
    if (e.key === "R") safeSetRate(v, DEFAULT_RATE);
    if (e.key.toLowerCase() === "l")  safeSeek(v, +TIME_STEP); e.preventDefault(); 
    if (e.key.toLowerCase() === "j") safeSeek(v, -TIME_STEP); e.preventDefault(); 
});

// ポップアップや背景からのメッセージ
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const v = getVideo();
    if (msg?.type === "GET_RATE") {
        sendResponse({ ok: true, rate: v ? v.playbackRate : null });
        return; // sync response
    }
    if (!v) { sendResponse?.({ ok: false }); return; }

    if (msg.type === "SET_RATE") {
        safeSetRate(v, msg.value);
        sendResponse?.({ ok: true });
    } else if (msg.type === "NUDGE") {
        safeSetRate(v, (v.playbackRate || 1.0) + Number(msg.delta || 0));
        sendResponse?.({ ok: true });
    } else if (msg.type === "RESET") {
        safeSetRate(v, DEFAULT_RATE);
        sendResponse?.({ ok: true });
    } else if (msg.type === "SET_INITIAL") {
        chrome.storage.sync.set({ initialRate: Number(msg.value) || 1.0 });
        sendResponse?.({ ok: true });
    } else if (msg.type === "SEEK") {
        safeSeek(v, Number(msg.delta || 0));
        sendResponse?.({ ok: true });
    } 

    
});
