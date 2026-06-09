// 取得したJSONデータを保存しておく変数
window.Answerlist = {};

const originalFetch = window.fetch;

window.fetch = async function(...args) {
    const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;

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
const lookupDB = {};

// ① JSONに含まれるHTMLタグを取り除いて純粋なテキストにする便利関数
function stripHtml(html) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim().replace(/\s+/g, ' ');
}

// JSONのあらゆる階層から「選択肢」と「正解」を持つオブジェクトを全自動で探し出す関数
function findQuestionsAutomated(obj, results = []) {
    if (!obj || typeof obj !== 'object') return results;
    
    if (Array.isArray(obj.choices) && (obj.answer !== undefined || obj.correct !== undefined)) {
        results.push(obj);
    }
    
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            findQuestionsAutomated(obj[key], results);
        }
    }
    return results;
}

// ② 逆引きデータベースの構築
function buildDatabase(allUnitData) {
    for (const key in lookupDB) delete lookupDB[key];

    for (const fileName in allUnitData) {
        const fileData = allUnitData[fileName];
        if (!fileData) continue;

        const questions = findQuestionsAutomated(fileData);

        questions.forEach(q => {
            if (q.choices && q.choices.length > 0) {
                const cleanChoices = q.choices.map(c => {
                    return {
                        symbol: c.symbol || c.id || c.value || "", 
                        text: stripHtml(c.text || c.label || c.content || "")
                    };
                });

                const sortedTexts = cleanChoices.map(c => c.text).sort();
                const key = sortedTexts.join('|');

                const ansSymbol = q.answer !== undefined ? q.answer : q.correct;
                const correctChoice = cleanChoices.find(c => c.symbol === ansSymbol);

                lookupDB[key] = {
                    questionId: q.id || "",
                    correctText: correctChoice ? correctChoice.text : "",
                    explanation: q.explanations?.question?.ja || q.explanation || "" 
                };
            }
        });
    }
    console.log("🕵️ データベース構築完了！ 登録問題数:", Object.keys(lookupDB).length);
}

// ③ 画面の文字を読み取って「問題ごと」に解答する関数
function solveCurrentQuestion() {
    // 画面上のすべての選択肢要素を取得
    const labels = Array.from(document.querySelectorAll('.MuiFormControlLabel-root'));
    if (labels.length === 0) {
        console.log("⚠️ 画面上に選択肢が見つかりません。");
        return;
    }

    // 【大幅改良】name属性ではなく、共通の親コンテナ（ラジオグループの箱）ごとにグループ化する
    const groups = new Map();
    labels.forEach(label => {
        // MUIのラジオグループ要素、または直近の親要素を「問題の箱」とする
        const container = label.closest('.MuiFormGroup-root, [role="radiogroup"]') || label.parentElement;
        if (!groups.has(container)) {
            groups.set(container, []);
        }
        groups.get(container).push(label);
    });

    let matchCount = 0;

    // 各問題の箱（グループ）ごとに検索処理を実行
    groups.forEach((groupLabels) => {
        const screenChoices = [];

        groupLabels.forEach(label => {
            const textSpan = label.lastElementChild;
            const input = label.querySelector('input[type="radio"]');
            
            if (textSpan && input) {
                const text = textSpan.innerText.trim().replace(/\s+/g, ' ');
                screenChoices.push({ label, input, text });
            }
        });

        if (screenChoices.length === 0) return;

        // 4択なら4択のテキストだけでソートしてキーを作成
        const currentTexts = screenChoices.map(c => c.text).sort();
        const currentKey = currentTexts.join('|');

        // データベースから個別に検索
        const foundData = lookupDB[currentKey];

        if (foundData) {
            matchCount++;
            if (foundData.explanation) console.log(`📚 ID[${foundData.questionId}] 解説:`, foundData.explanation);

            screenChoices.forEach(c => {
                if (c.text === foundData.correctText) {
                    // 正解の背景をハイライト
                    c.label.style.backgroundColor = "rgba(255, 99, 71, 0.4)";
                    c.label.style.border = "2px solid red";
                    c.label.style.borderRadius = "5px";
                }
            });
        } else {
            console.log("⚠️ この問題はデータベースに見つかりませんでした。キー:", currentKey);
        }
    });

    if (matchCount > 0) {
        console.log(`✅ ${matchCount}個の問題を個別にハイライトしました！`);
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