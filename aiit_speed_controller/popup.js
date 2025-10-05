// ===== 設定 =====
const STEP = 0.5;        // ±の刻み
const KEEP_SECONDS = 6;  // 粘り時間短めで体感を上げる
const MIN_RATE = 0.25;
const MAX_RATE = 6.0;

// ===== キャッシュ（今のタブ内だけ）=====
let cachedFrameIds = null;

// === 追加：プリセットチップ ===
document.querySelectorAll('.chip[data-rate]').forEach(el => {
    el.addEventListener('click', () => {
        const r = parseFloat(el.getAttribute('data-rate'));
        if (!isNaN(r)) applyOptimistic(clamp(r, MIN_RATE, MAX_RATE));
    });
});

// ▼ UIヘルパ
const $ = (id) => document.getElementById(id);
const clamp = (v, lo = MIN_RATE, hi = MAX_RATE) => Math.max(lo, Math.min(hi, v));
const roundStep = (v, step = STEP) => Math.round(v / step) * step;
const readDisplayedRate = () => {
    const t = $("current")?.textContent || "";
    const m = t.match(/×\s*([0-9.]+)/);
    return m ? parseFloat(m[1]) : null;
};
const setDisplayedRate = (val) => { if ($("current")) $("current").textContent = `× ${val.toFixed(2)}`; };

/* -------------------------------------------
 * アクティブタブ取得
 * -----------------------------------------*/
async function getHttpTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https?:\/\//i.test(tab.url || "")) throw new Error("This tab is not http(s)");
    return tab;
}

/* -------------------------------------------
 * 各フレームで video の本数を調べる
 * -----------------------------------------*/
function probeVideosFn() {
    const vids = document.querySelectorAll("video");
    return { href: location.href, count: vids.length };
}

/* -------------------------------------------
 * 再生速度コントローラ（ページ側で実行）
 * -----------------------------------------*/
function injectedSpeedController(mode, value, keepSec = 6) {
    // スコープ外になるのでべた書き
    const clip = v => Math.max(0.1, Math.min(6.0, v));
    const stepRound = v => Math.round(v / 0.5) * 0.5; // ±は0.5刻み

    const DEADLINE = Date.now() + keepSec * 1000;
    if (typeof window.__kalturaTargetRate !== 'number') window.__kalturaTargetRate = 1.0;

    function setOnVideo(v, RATE) {
        try {
            if (v.playbackRate !== RATE) v.playbackRate = RATE;
            if (!v.__keepRate) {
                v.__keepRate = true;
                v.addEventListener('ratechange', () => {
                    if (Math.abs(v.playbackRate - window.__kalturaTargetRate) > 1e-6) {
                        v.playbackRate = window.__kalturaTargetRate;
                    }
                });
                v.addEventListener('play', () => { v.playbackRate = window.__kalturaTargetRate; });
                v.addEventListener('loadedmetadata', () => { v.playbackRate = window.__kalturaTargetRate; });
            }
        } catch { }
    }

    function applyToAllVideos(RATE) {
        const vids = document.querySelectorAll('video');
        vids.forEach(v => setOnVideo(v, RATE));
        return vids.length;
    }

    function enforceLoop() {
        const n = applyToAllVideos(window.__kalturaTargetRate);
        if (Date.now() <= DEADLINE) setTimeout(enforceLoop, n > 0 ? 400 : 200);
    }

    // 追加された<video>にも適用
    if (!window.__kalturaMO) {
        window.__kalturaMO = new MutationObserver(() => {
            document.querySelectorAll('video').forEach(v => setOnVideo(v, window.__kalturaTargetRate));
        });
        window.__kalturaMO.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (mode === 'set') {
        // 手入力などは丸めずに絶対値設定
        window.__kalturaTargetRate = clip(Number(value) || 1.0);
    } else if (mode === 'nudge') {
        // ±は0.5刻みで目標値を更新
        const base = (typeof window.__kalturaTargetRate === 'number') ? window.__kalturaTargetRate : 1.0;
        window.__kalturaTargetRate = stepRound(clip(base + Number(value || 0)));
    }

    applyToAllVideos(window.__kalturaTargetRate);
    enforceLoop();

    try {
        let el = document.getElementById('__kaltura_speed_badge');
        if (!el) {
            el = document.createElement('div');
            el.id = '__kaltura_speed_badge';
            el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:6px 10px;background:rgba(0,0,0,.6);color:#fff;border-radius:8px;font:14px system-ui';
            document.documentElement.appendChild(el);
        }
        el.textContent = `× ${window.__kalturaTargetRate.toFixed(2)}`;
        setTimeout(() => el.remove(), 1000);
    } catch { }
}

/* -------------------------------------------
 * video があるフレームだけ選別して実行（キャッシュ対応）
 * -----------------------------------------*/
async function getVideoFrames(tabId) {
    if (cachedFrameIds && cachedFrameIds.length) return cachedFrameIds;

    const probes = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: probeVideosFn
    });
    const ids = probes.filter(r => r?.result && r.result.count > 0).map(r => r.frameId);
    cachedFrameIds = ids.length ? ids : null;
    return ids;
}

async function runOnlyOnFramesWithVideo(func, args = []) {
    const tab = await getHttpTab();
    let frameIds = await getVideoFrames(tab.id);

    if (!frameIds?.length) {
        throw new Error("動画タグがまだ見つかりません。再生を開始してからもう一度押してください。");
    }

    try {
        return await chrome.scripting.executeScript({
            target: { tabId: tab.id, frameIds },
            func, args
        });
    } catch (e) {
        // フレーム差し替え時はキャッシュ捨てて一回だけ再探索
        cachedFrameIds = null;
        frameIds = await getVideoFrames(tab.id);
        if (!frameIds?.length) throw e;
        return await chrome.scripting.executeScript({
            target: { tabId: tab.id, frameIds },
            func, args
        });
    }
}

/* -------------------------------------------
 * 現在速度の取得（キャッシュ優先）
 * -----------------------------------------*/
function injectedGetRate() {
    const v = document.querySelector("video");
    return v ? v.playbackRate : null;
}

async function getCurrentRate() {
    const tab = await getHttpTab();
    const frames = await getVideoFrames(tab.id);
    const target = frames?.length
        ? { tabId: tab.id, frameIds: frames }
        : { tabId: tab.id, allFrames: true };

    const res = await chrome.scripting.executeScript({ target, func: injectedGetRate });
    const first = res.find(r => typeof r.result === "number");
    return first ? first.result : null;
}

/* -------------------------------------------
 * 表示の更新（実測）
 * -----------------------------------------*/
async function refreshRate() {
    const val = await getCurrentRate();
    $("current").textContent = (typeof val === "number") ? `× ${val.toFixed(2)}` : "× —";
}

/* -------------------------------------------
 * 楽観適用（UIを即時更新→裏で適用→あとで同期）
 * -----------------------------------------*/
async function applyOptimistic(targetRate) {
    // 即時UI更新
    setDisplayedRate(targetRate);
    setStatus("⏳ 適用中…（少々お待ちください）");

    try {
        // 実適用（完了待ち）
        await runOnlyOnFramesWithVideo(injectedSpeedController, ["set", targetRate, KEEP_SECONDS]);

        // 3) 少し待って実測同期（ここでラグ吸収）
        await new Promise(r => setTimeout(() => setStatus(""), 2000));
        await refreshRate();

        // 4) メッセージは“ずっと出したい”なら残す／消したいなら次の1行をコメントアウト
        // setStatus("");  // ← 消したくなったら有効に
    } catch (err) {
        console.warn("[KalturaSpeed] apply failed:", err);
        setStatus("⚠️ 適用に失敗しました。もう一度お試しください。");
    }
}

/* -------------------------------------------
 * イベント結線
 * -----------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {

    $("up").addEventListener("click", async () => {
        // 楽観：現在表示から計算（取得待ちしない）
        const shown = readDisplayedRate() ?? 1.0;
        const next = clamp(roundStep(shown + STEP));
        applyOptimistic(next);
    });

    $("down").addEventListener("click", async () => {
        const shown = readDisplayedRate() ?? 1.0;
        const next = clamp(roundStep(shown - STEP));
        applyOptimistic(next);
    });

    $("reset").addEventListener("click", () => {
        applyOptimistic(1.0);
    });

    $("apply").addEventListener("click", () => {
        const v = parseFloat($("manual").value);
        if (!isNaN(v)) {
            // 手入力は丸めなし（そのまま適用）
            const next = clamp(v);
            applyOptimistic(next);
        }
    });

    $("refresh").addEventListener("click", refreshRate);

    // 初期表示は実測
    refreshRate();
});

document.addEventListener('keydown', (e) => {
    // テキスト入力中は無視
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

    const shown = readDisplayedRate() ?? 1.0;

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = clamp(roundStep(shown + STEP));
        applyOptimistic(next);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = clamp(roundStep(shown - STEP));
        applyOptimistic(next);
    } else if (e.key === '0') {
        e.preventDefault();
        applyOptimistic(1.0);
    }
});

function setStatus(message = "") {
    const id = "__speed_status_msg";
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement("div");
        el.id = id;
        // 見やすいがクリックを邪魔しない（pointer-events:none）
        el.style.cssText = `
      position: absolute;
      right: 12px;
      top: 8px;
      font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans JP", sans-serif;
      color: #a4acc4;
      pointer-events: none;
      z-index: 9999;
      transition: opacity .15s ease;
      opacity: 0.9;
    `;
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = message ? "0.9" : "0";
}