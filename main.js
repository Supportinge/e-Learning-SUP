// 取得したJSONデータを保存しておく変数
window.Answerlist = {};
// 2. sendBeacon での送信もブロック
const originalSendBeacon = navigator.sendBeacon;
navigator.sendBeacon = function(url, data) {
    if (typeof url === 'string' && url.includes('sentry-tunnel')) {
        console.log("🛡️ [Sentry Blocker] SentryへのsendBeacon通信を遮断しました");
        return true; // 成功したフリをする
    }
    return originalSendBeacon.call(this, url, data);
};
const originalFetch = window.fetch;

window.fetch = async function(...args) {
    const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    // 🚫 【追加】sentry-tunnel の通信をブロックして偽の成功を返す
    // sentry-tunnel への通信を検知したら、通信せずに「成功」を返す
    if (requestUrl && requestUrl.includes('sentry-tunnel')) {
        console.log("🛡️ [Sentry Blocker] Sentryへのfetch通信を遮断しました");
        return new Response(JSON.stringify({ id: "mocked-sentry" }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }else{
        console.log(" [Fetch]", requestUrl);
    }
    // 後ろにパラメータがついていても確実にキャッチ
    if (requestUrl && requestUrl.includes('asset.alcnaplus.jp/anten/course/materials/') && requestUrl.includes('.json')) {
        
        try {
            const response = await originalFetch.apply(this, args);
            const clone = response.clone();
            clone.json().then(data => {
                // クエリパラメータを除去してファイル名を取り出す
                const cleanUrl = requestUrl.split('?')[0];
                const fileName = cleanUrl.split('/').pop();
                
                window.Answerlist[fileName] = data;
                buildDatabase(window.Answerlist);
            });

            return response;
        } catch (e) {
            console.error("json catch failed:", e);
        }
    }
    return originalFetch.apply(this, args);
};
const lookupDB = {choices: {}, text: {}};

// ① JSONに含まれるHTMLタグを取り除いて純粋なテキストにする便利関数
function stripHtml(html) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim().replace(/\s+/g, ' ');
}

// 検索時の空白や大文字小文字のズレを吸収するための正規化関数
function normalizeText(text) {
    return stripHtml(text).replace(/\s+/g, '').toLowerCase();
}

// ② オブジェクトの奥底に隠れた「問題データ」をすべて探し出す探索関数
function findAllQuestions(obj) {
    let questions = [];
    if (Array.isArray(obj)) {
        for (let item of obj) questions = questions.concat(findAllQuestions(item));
    } else if (obj !== null && typeof obj === 'object') {
        // 標準的な問題データ (answerがあるもの)
        if (obj.answer) {
            questions.push(obj);
        }
        // 単語テスト系データ (BlqQuestionがあるもの)の救済措置
        else if (obj.BlqQuestion && obj.BlqCorrect) {
            questions.push({
                id: "vocab_" + obj.BlqQuestion,
                answer: obj.BlqCorrect,
                question: { en: obj.BlqQuestion }
            });
        }
        // 違えば、さらに下の階層を探索
        else {
            for (let key in obj) questions = questions.concat(findAllQuestions(obj[key]));
        }
    }
    return questions;
}

// ② 逆引きデータベースの構築
function buildDatabase(rawData) {
    let data;
    try { data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData; }
    catch (e) { return console.error("❌ JSONデータのパースに失敗しました。", e); }

    const allQuestions = findAllQuestions(data);

    allQuestions.forEach(q => {
        // 【パターンA】選択肢がある場合
        if (q.choices && q.choices.length > 0) {
            const cleanChoices = q.choices.map(c => ({ symbol: c.symbol, text: stripHtml(c.text) }));
            const choiceKey = cleanChoices.map(c => c.text).sort().join('|');
            const correctChoice = cleanChoices.find(c => c.symbol === q.answer);

            lookupDB.choices[choiceKey] = {
                questionId: q.id,
                correctText: correctChoice ? correctChoice.text : "",
                explanation: q.explanations?.question?.ja || q.explanation || ""
            };
        } 
        // 【パターンB】選択肢がない（記述式）場合
        else if (q.answer) {
            // 問題文（英語または日本語）を取得
            const qText = q.question?.en || q.question?.ja || q.explanations?.question?.en || q.explanations?.question?.ja || q.BlqQuestion || "";
            
            if (qText) {
                // 問題文を「空白なしの小文字」に圧縮してキーにする
                const textKey = normalizeText(qText);
                lookupDB.text[textKey] = {
                    questionId: q.id,
                    correctText: q.answer, // 記述式の正解
                    explanation: q.explanations?.question?.ja || q.explanation || ""
                };
            }
        }
    });

    //console.log(`🕵️ データベース構築完了！ 選択肢問題: ${Object.keys(lookupDB.choices).length}件, 記述式問題: ${Object.keys(lookupDB.text).length}件`);
}

// ④ Reactのテキストボックスに人間が打ったように強制入力する関数
function setReactInputValue(inputElement, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    
    if (inputElement.tagName === "TEXTAREA" && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(inputElement, value);
    } else if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputElement, value);
    } else {
        inputElement.value = value;
    }
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

// ③ 画面の文字を読み取って「問題ごと」に解答する関数
// ⑤ 画面の文字を読み取って解答する関数
function solveCurrentQuestion() {
    const labels = Array.from(document.querySelectorAll('.MuiFormControlLabel-root'));

    // ==========================================
    // 【パターンA】画面に選択肢（ラジオボタン）がある場合
    // ==========================================
    if (labels.length > 0) {
        const screenChoices = [];
        labels.forEach(label => {
            const textSpan = label.lastElementChild;
            const input = label.querySelector('input[type="radio"]');
            if (textSpan && input) screenChoices.push({ label, input, text: stripHtml(textSpan.innerText) });
        });

        const currentKey = screenChoices.map(c => c.text).sort().join('|');
        const foundData = lookupDB.choices[currentKey];

        if (foundData) {
            //console.log("✅ [選択肢] 問題特定！ 正解:", foundData.correctText);
            screenChoices.forEach(c => {
                if (c.text === foundData.correctText) {
                    // カンニング用ハイライト
                    c.label.style.backgroundColor = "rgba(255, 99, 71, 0.4)";
                    c.label.style.border = "2px solid red";
                    c.label.style.borderRadius = "5px";
                    // 自動クリック
                    // c.input.click(); 
                }
            });
        } else {
            //console.log("⚠️ この選択肢問題は見つかりませんでした。");
        }
    } 
    // ==========================================
    // 【パターンB】画面に選択肢がない（記述式）場合
    // ==========================================
    else {
        // 画面のテキストをすべて取得し、「空白なしの小文字」に圧縮
        const screenText = normalizeText(document.body.innerText);
        
        let foundData = null;
        // 辞書の中の問題文が、画面のテキストに含まれているか検索
        for (const [qTextKey, data] of Object.entries(lookupDB.text)) {
            if (qTextKey.length > 3 && screenText.includes(qTextKey)) {
                foundData = data;
                break;
            }
        }

        if (foundData) {
            //console.log("✅ [記述式] 問題特定！ 正解:", foundData.correctText);
            
            // 画面の入力欄（テキストボックス）を探す
            const inputField = document.querySelector('input[type="text"], input[type="email"], textarea');
            if (inputField) {
                // 正解を強制入力！
                setReactInputValue(inputField, foundData.correctText);
                
                // 入力欄を赤く光らせる
                inputField.style.backgroundColor = "rgba(255, 99, 71, 0.2)";
                inputField.style.border = "2px solid red";
                //console.log("✍️ 自動入力完了！");
            } else {
                //console.log("⚠️ 正解は分かりましたが、画面に入力欄が見つかりません。");
            }
        } else {
            //console.log("⚠️ この記述式問題は見つかりませんでした。");
        }
    }
}

// ==========================================
// 実行部分
// ==========================================

buildDatabase(window.Answerlist);

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }

    if (e.key === 'f' || e.key === 'F') {
        solveCurrentQuestion();
    }
});