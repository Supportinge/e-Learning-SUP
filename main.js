// 取得したJSONデータを保存しておく変数
window.Answerlist = window.Answerlist || {};
if (!window.isSendBeaconIntercepted) {
    const originalSendBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function(url, data) {
        if (typeof url === 'string' && url.includes('sentry-tunnel')) {
            console.log("🛡️ [Sentry Blocker] SentryへのsendBeacon通信を遮断しました");
            return true;
        }
        return originalSendBeacon.call(this, url, data);
    };
    window.isSendBeaconIntercepted = true;
}

if (!window.isFetchIntercepted) {
    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        if (requestUrl && requestUrl.includes('sentry-tunnel')) {
            console.log("🛡️ [Sentry Blocker] Sentryへのfetch通信を遮断しました");
            return new Response(JSON.stringify({ id: "mocked-sentry" }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (requestUrl && requestUrl.includes('asset.alcnaplus.jp/anten/course/materials/') && requestUrl.includes('.json')) {
            try {
                const response = await originalFetch.apply(this, args);
                const clone = response.clone();
                clone.json().then(data => {
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
    window.isFetchIntercepted = true;
}
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
        if (obj.answer !== undefined || obj.correct !== undefined) {
            questions.push(obj.answer !== undefined ? obj : { ...obj, answer: obj.correct });
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

    console.log(`🕵️ データベース構築完了！ 選択肢問題: ${Object.keys(lookupDB.choices).length}件, 記述式問題: ${Object.keys(lookupDB.text).length}件`);
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
    let solved = false;

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
            console.log("✅ [選択肢] 問題特定！ 正解:", foundData.correctText);
            solved = true;
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
            console.log("⚠️ この選択肢問題は見つかりませんでした。");
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
            console.log("✅ [記述式] 問題特定！ 正解:", foundData.correctText);
            solved = true;
            
            // 画面の入力欄（テキストボックス）を探す
            const inputField = document.querySelector('input[type="text"], input[type="email"], textarea');
            if (inputField) {
                // 正解を強制入力！
                setReactInputValue(inputField, foundData.correctText);
                
                // 入力欄を赤く光らせる
                inputField.style.backgroundColor = "rgba(255, 99, 71, 0.2)";
                inputField.style.border = "2px solid red";
                console.log("✍️ 自動入力完了！");
            } else {
                console.log("⚠️ 正解は分かりましたが、画面に入力欄が見つかりません。");
            }
        } else {
            console.log("⚠️ この記述式問題は見つかりませんでした。");
        }
    }

    return solved;
}

function solveAnyQuestion() {
    const allQuestions = [];
    for (const fileName in window.Answerlist) {
        findAllQuestions(window.Answerlist[fileName], allQuestions);
    }

    if (allQuestions.length === 0) {
        console.log("⚠️ データベースに問題がありません。");
        return false;
    }

    console.log(`🎯 スナイパーモード発動！画面の問題を解析します…`);

    const radioGroupsMap = new Map();
    document.querySelectorAll('.MuiFormControlLabel-root').forEach(label => {
        const parent = label.closest('[role="radiogroup"], .MuiFormGroup-root') || label.parentElement.parentElement;
        if (!radioGroupsMap.has(parent)) radioGroupsMap.set(parent, []);
        radioGroupsMap.get(parent).push(label);
    });
    const radioGroups = Array.from(radioGroupsMap.values());

    let solved = false;

    radioGroups.forEach(groupLabels => {
        const screenChoices = groupLabels.map(label => stripHtml(label.innerText).replace(/\s+/g, ''));
        if (screenChoices.length === 0) return;

        let bestQ = null;
        let maxOverlap = 0;

        for (const q of allQuestions) {
            if (!q.choices) continue;
            const qChoices = q.choices.map(c => stripHtml(c.text || c.content || c.label || "").replace(/\s+/g, ''));
            let overlap = 0;
            for (const sc of screenChoices) {
                if (qChoices.some(qc => qc.includes(sc) || sc.includes(qc) || qc === sc)) overlap++;
            }
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                bestQ = q;
            }
        }

        if (bestQ && maxOverlap >= 1) {
            let tempSymbol = "";
            if (typeof bestQ.answer === 'object' && bestQ.answer !== null) tempSymbol = bestQ.answer.choice || bestQ.answer.symbol;
            else if (typeof bestQ.answer === 'string') tempSymbol = bestQ.answer;

            if (tempSymbol && /^[A-D]$/i.test(tempSymbol)) {
                const idx = tempSymbol.toUpperCase().charCodeAt(0) - 65;
                if (groupLabels[idx]) {
                    groupLabels[idx].click();
                    solved = true;
                }
            } else if (!isNaN(tempSymbol) && groupLabels[Number(tempSymbol)]) {
                groupLabels[Number(tempSymbol)].click();
                solved = true;
            }
        }
    });

    const pageText = document.body.innerText.replace(/[\s\/]+/g, '');
    const matchedQuestions = [];

    for (const q of allQuestions) {
        const ansObj = extractTextAnswerObj(q);
        if (ansObj.text || ansObj.clickItems.length > 0) {
            const qEn = stripHtml(q.question?.en || "").replace(/[\s\/]+/g, '');
            const qJa = stripHtml(q.question?.ja || "").replace(/[\s\/]+/g, '');

            if ((qEn.length > 5 && pageText.includes(qEn.substring(0, 20))) ||
                (qJa.length > 5 && pageText.includes(qJa.substring(0, 20)))) {
                matchedQuestions.push({ q, ansObj });
            }
        }
    }

    if (matchedQuestions.length > 0) {
        console.log(`📝 ${matchedQuestions.length}件の記述/並び替え問題をロックオンしました！`);

        const textInputs = Array.from(document.querySelectorAll('input[type="text"], textarea, .MuiInputBase-input:not([type="radio"]):not([type="checkbox"])')).filter(el => !el.disabled);

        matchedQuestions.forEach((match, index) => {
            const ansObj = match.ansObj;
            console.log(`💡 正解データ: ${ansObj.text}`);
            console.log(`🧩 クリック予定のパーツ:`, ansObj.clickItems);

            if (index < textInputs.length) {
                setTimeout(() => {
                    const input = textInputs[index];
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    if (nativeInputValueSetter) nativeInputValueSetter.call(input, ansObj.text);
                    else input.value = ansObj.text;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`✅ 入力欄に「${ansObj.text}」を入力しました！`);
                }, 300 + (index * 300));
                solved = true;
            }

            if (ansObj.clickItems.length > 0) {
                setTimeout(() => {
                    let clickDelay = 0;
                    ansObj.clickItems.forEach(word => {
                        const cleanWord = word.trim().replace(/[\s \/]+/g, '');
                        if (!cleanWord) return;

                        setTimeout(() => {
                            const buttons = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"]'));

                            const target = buttons.find(btn => {
                                const btnText = (btn.textContent || btn.innerText || "").replace(/[\s \/]+/g, '');
                                return btnText === cleanWord;
                            });

                            if (target) {
                                target.click();
                                console.log(`👆 ボタン「${word}」をクリックしました！`);
                            } else {
                                console.log(`❌ 警告: ボタン「${word}」が画面に見つかりませんでした！`);
                            }
                        }, clickDelay);
                        clickDelay += 200;
                    });
                }, 800 + (index * 500));
                solved = true;
            }
        });
    } else if (!solved) {
        console.log("⚠️ 画面の情報と一致する記述/並び替え問題が見つかりませんでした。");
    }

    return solved || matchedQuestions.length > 0;
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
        const verbTargets = document.querySelectorAll('span[data-nan-target]');
        if (verbTargets.length > 0) {
            console.log(`🎯 動詞スナイパー発動！ ${verbTargets.length} 個のターゲットを捕捉！`);
            let delay = 0;
            verbTargets.forEach((target, index) => {
                setTimeout(() => {
                    target.click();
                    console.log(`💥 ターゲット ${index + 1} 撃破: 「${target.innerText}」`);
                }, delay);
                delay += 200 + Math.random() * 200;
            });
            return;
        }

        if (!solveCurrentQuestion()) {
            solveAnyQuestion();
        }
    }
});