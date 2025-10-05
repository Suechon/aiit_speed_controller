self.addEventListener('activate', () => console.log('SW active'));
// ★ popup や content からは絶対に読み込まないこと！

if (chrome?.commands?.onCommand) {
    chrome.commands.onCommand.addListener((command) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) return;
            const msg =
                command === "speed_up" ? { type: "NUDGE", delta: 0.25 } :
                    command === "speed_down" ? { type: "NUDGE", delta: -0.25 } :
                        { type: "RESET" };
            chrome.tabs.sendMessage(tabId, msg);
        });
    });
} else {
    // ここに来る＝このスクリプトがサービスワーカー以外で実行されている可能性が高い
    console.warn('chrome.commands is undefined. Is background.js running as the MV3 service worker?');
}
