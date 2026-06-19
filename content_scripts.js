// ポップアップからの指令を受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TOGGLE_AUTO") {
        // MAINワールド（main.js）に向けてイベントを発射！
        window.dispatchEvent(new CustomEvent("CHAPPIE_TOGGLE_EVENT"));
    }
});