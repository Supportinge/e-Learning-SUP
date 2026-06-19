document.getElementById('toggleBtn').addEventListener('click', () => {
    // 現在アクティブなタブを取得
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            // タブに向けて「切り替え指令」を送信
            chrome.tabs.sendMessage(tabs[0].id, { action: "TOGGLE_AUTO" });
            
            // ポップアップを閉じる
            window.close();
        }
    });
});