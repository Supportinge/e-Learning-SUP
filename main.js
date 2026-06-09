// 取得したJSONデータを保存しておく変数
window.Answerlist = {};

const originalFetch = window.fetch;

window.fetch = async function(...args) {
    const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;

    // もしURLが目的のJSONの法則に一致したら
    if (requestUrl && requestUrl.includes('asset.alcnaplus.jp/anten/course/materials/') && requestUrl.endsWith('.json')) {
        
        try {
            // 普通に通信させる
            const response = await originalFetch.apply(this, args);
            
            // レスポンスをクローンして中身を読む
            const clone = response.clone();
            clone.json().then(data => {
                // ファイル名を取り出す（test_part1_1.json など）
                const fileName = requestUrl.split('/').pop();
                
                // 変数に放り込む！
                window.Answerlist[fileName] = data;
                
                buildDatabase(window.Answerlist);
            });

            return response;
        } catch (e) {
            console.error("json catch failed:", e);
        }
    }
    // 関係ない通信はそのまま通す
    return originalFetch.apply(this, args);
};
const lookupDB = {};

// ① JSONに含まれるHTMLタグを取り除いて純粋なテキストにする便利関数
function stripHtml(html) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim().replace(/\s+/g, ' ');
}

// ② 逆引きデータベースの構築
function buildDatabase(allUnitData) {
    for (const fileName in allUnitData) {
        if (fileName.startsWith("test_part")) {
            const questions = allUnitData[fileName].questions;
            if (!questions) continue;

            questions.forEach(q => {
                if (q.choices && q.choices.length > 0) {
                    // JSONの選択肢からHTMLタグを除去してきれいなテキストにする
                    const cleanChoices = q.choices.map(c => {
                        return {
                            symbol: c.symbol,
                            text: stripHtml(c.text)
                        };
                    });

                    // 順序シャッフル対策：テキストをアルファベット順にソートして繋ぐ
                    const sortedTexts = cleanChoices.map(c => c.text).sort();
                    const key = sortedTexts.join('|');

                    // 正解のテキストそのものを特定
                    const correctChoice = cleanChoices.find(c => c.symbol === q.answer);

                    lookupDB[key] = {
                        questionId: q.id,
                        correctText: correctChoice ? correctChoice.text : "",
                        explanation: q.explanations?.question?.ja || "" // 和訳・解説
                    };
                }
            });
        }
    }
    console.log("🕵️ データベース構築完了！ 登録問題数:", Object.keys(lookupDB).length);
}

// ③ 画面の文字を読み取って解答する関数
function solveCurrentQuestion() {
    // 画面の選択肢要素（MUIのラベル群）をすべて取得
    const labels = Array.from(document.querySelectorAll('.MuiFormControlLabel-root'));
    if (labels.length === 0) return;

    const screenChoices = [];
    labels.forEach(label => {
        // テキストが入っている最後の要素(span)を取得
        const textSpan = label.lastElementChild;
        // 実際にクリックすべきラジオボタンを取得
        const input = label.querySelector('input[type="radio"]');
        
        if (textSpan && input) {
            const text = textSpan.innerText.trim().replace(/\s+/g, ' ');
            screenChoices.push({ label, input, text });
        }
    });

    // 画面のテキストをソートして検索キーを作る（これでシャッフルを無効化！）
    const currentTexts = screenChoices.map(c => c.text).sort();
    const currentKey = currentTexts.join('|');

    // データベースから検索
    const foundData = lookupDB[currentKey];

    if (foundData) {
        //console.log("✅ 問題特定！ ID:", foundData.questionId);
        //console.log("💡 正解のテキスト:", foundData.correctText);
        if (foundData.explanation) console.log("📚 解説:", foundData.explanation);

        // 画面の選択肢から、正解と同じテキストを持つものを探す
        screenChoices.forEach(c => {
            if (c.text === foundData.correctText) {
                
                // 【カンニングモード】正解の背景を赤くハイライトする
                c.label.style.backgroundColor = "rgba(255, 99, 71, 0.4)";
                c.label.style.border = "2px solid red";
                c.label.style.borderRadius = "5px";

                // 【オートパイロットモード】自動でクリックしたい場合は以下の // を外す
                // c.input.click(); 
            }
        });
    } else {
        console.log("⚠️ この問題はデータベースに見つかりませんでした。");
    }
}

// ==========================================
// 実行部分
// ==========================================

// 1. JSONデータを渡してデータベースを構築（※allUnitDataが定義されていること）
buildDatabase(window.Answerlist);

// 2. ショートカットキーの設定（Shift + Spaceキーを押したら解く）
document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.code === 'Space') {
        solveCurrentQuestion();
    }
});