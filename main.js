// 取得したJSONデータを保存しておく変数
window.Answerlist = window.Answerlist || {};

// 1. JSONデータの横取り
if (!window.isFetchIntercepted) {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        if (requestUrl && requestUrl.includes('.json')) {
            try {
                const response = await originalFetch.apply(this, args);
                const clone = response.clone();
                clone.json().then(data => {
                    const cleanUrl = requestUrl.split('?')[0];
                    const fileName = cleanUrl.split('/').pop();
                    window.Answerlist[fileName] = data;
                    console.log("📥 新しい教材データを読み込みました:", fileName);
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

// ユーティリティ関数
function stripHtml(html) {
    if (!html) return "";
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim().replace(/\s+/g, ' ');
}

function normText(str) {
    return (str || "").replace(/[\s \/.,?!()\[\]{}""''「」『』]/g, '').toLowerCase();
}

function findAllQuestions(obj, results = []) {
    if (!obj || typeof obj !== 'object') return results;
    if (obj.answer !== undefined || obj.correct !== undefined || obj.choices !== undefined) {
        results.push(obj);
    }
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (obj[key] && typeof obj[key] === 'object') {
                findAllQuestions(obj[key], results);
            }
        }
    }
    return results;
}

function extractTextAnswer(q) {
    if (Array.isArray(q.answer)) {
        return q.answer.map(item => typeof item === 'object' ? (item.text || item.content || "") : item).join('');
    } else if (typeof q.answer === 'object' && q.answer !== null) {
        return q.answer.correct || q.answer.text || "";
    } else if (typeof q.answer === 'string' && !/^[A-D]$/i.test(q.answer) && isNaN(q.answer)) {
        return q.answer;
    } else {
        const html = q.explanations?.correctanswer || q.correctanswer || "";
        const spanMatch = html.match(/<[^>]*data-nan-corrected[^>]*>([\s\S]*?)<\/[a-z]+>/i);
        if (spanMatch) return stripHtml(spanMatch[1]);
    }
    return "";
}

// 💥 メインの解答処理
function solveAnyQuestion() {
    console.log(`🎯 スナイパーモード発動！画面の問題を解析します…`);
    const pageText = document.body.innerText;
    const pageTextNoSpace = normText(pageText);

    // --- 【攻撃0】単語の二択問題 ---
    let vocabClicked = false;
    let vocabMap = {};
    for (const fileName in window.Answerlist) {
        const data = window.Answerlist[fileName];
        if (data && data.notes && Array.isArray(data.notes)) {
            data.notes.forEach(n => {
                if (n.en && n.en.vocabulary && n.ja && n.ja.vocabulary) {
                    vocabMap[n.en.vocabulary.trim()] = n.ja.vocabulary.trim();
                }
            });
        }
    }

    if (Object.keys(vocabMap).length > 0) {
        for (const enWord in vocabMap) {
            const regex = new RegExp("\\b" + enWord + "\\b", "i");
            if (regex.test(pageText)) {
                const jaWordClean = normText(vocabMap[enWord]);
                const buttons = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root'));
                const targetBtn = buttons.find(btn => normText(btn.textContent || btn.innerText) === jaWordClean);
                if (targetBtn) {
                    console.log(`🎯 単語スナイパー発動！「${enWord}」の正解をロックオン！`);
                    setTimeout(() => { targetBtn.click(); }, 100);
                    vocabClicked = true;
                    break;
                }
            }
        }
    }
    if (vocabClicked) return;

    // --- 既存の問題を集める ---
    const allQuestions = [];
    for (const fileName in window.Answerlist) {
        findAllQuestions(window.Answerlist[fileName], allQuestions);
    }
    if (allQuestions.length === 0) {
        console.log("⚠️ データベースに問題がありません。");
        return;
    }

    // --- 【攻撃1.5】文法・読解の二択/多択ボタンの処理 ---
    let clickedSpecialButton = false;
    for (const q of allQuestions) {
        if (q.choices && Array.isArray(q.choices)) {
            const correctChoice = q.choices.find(c => String(c.correct) === 'true');
            if (correctChoice && correctChoice.label) {
                const targetLabel = normText(correctChoice.label);
                const buttons = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root'));
                const targetBtn = buttons.find(btn => normText(btn.textContent || btn.innerText) === targetLabel);
                const wrongChoice = q.choices.find(c => String(c.correct) === 'false');
                const wrongLabel = wrongChoice ? normText(wrongChoice.label) : "";
                const wrongBtn = buttons.find(btn => normText(btn.textContent || btn.innerText) === wrongLabel);
                const qText = normText(stripHtml(q.question?.text || q.question?.ja || q.question?.en || ""));
                const textMatches = qText.length > 5 && pageTextNoSpace.includes(qText.substring(0, 15));

                if (targetBtn && (wrongBtn || textMatches)) {
                    console.log(`🎯 2択/多択問題をロックオン！ 正解のラベル: ${correctChoice.label}`);
                    setTimeout(() => { targetBtn.click(); }, 300);
                    clickedSpecialButton = true;
                    break; 
                }
            }
        }
    }
    if (clickedSpecialButton) return;

    // --- 【攻撃1】ラジオボタンの処理（通常） ---
    const radioGroupsMap = new Map();
    document.querySelectorAll('.MuiFormControlLabel-root').forEach(label => {
        const parent = label.closest('[role="radiogroup"], .MuiFormGroup-root') || label.parentElement.parentElement;
        if (!radioGroupsMap.has(parent)) radioGroupsMap.set(parent, []);
        radioGroupsMap.get(parent).push(label);
    });
    const radioGroups = Array.from(radioGroupsMap.values());

    radioGroups.forEach((groupLabels, groupIndex) => {
        const screenChoices = groupLabels.map(label => stripHtml(label.innerText).replace(/\s+/g, ''));
        if (screenChoices.length === 0) return;

        let bestQ = null;
        let maxOverlap = 0;

        for (const q of allQuestions) {
            if (!q.choices || !Array.isArray(q.choices)) continue;
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
                if (groupLabels[idx]) groupLabels[idx].click();
            } else if (!isNaN(tempSymbol) && groupLabels[Number(tempSymbol)]) {
                groupLabels[Number(tempSymbol)].click();
            }
        }
    });

    // --- 【攻撃2】記述・並び替えの処理（スマート判別式！） ---
    const matchedQuestions = [];
    for (const q of allQuestions) {
        const ansText = extractTextAnswer(q);
        if (ansText) {
            const qEn = normText(stripHtml(q.question?.en || ""));
            const qJa = normText(stripHtml(q.question?.ja || ""));
            if ((qEn.length > 5 && pageTextNoSpace.includes(qEn.substring(0, 20))) || 
                (qJa.length > 5 && pageTextNoSpace.includes(qJa.substring(0, 20)))) {
                matchedQuestions.push(ansText);
            }
        }
    }

    let uniqueAnswers = Array.from(new Set(matchedQuestions.map(text => normText(text))));
    uniqueAnswers.sort((a, b) => b.length - a.length); 
    uniqueAnswers = uniqueAnswers.filter((ans, idx, arr) => {
        return !arr.some((otherAns, otherIdx) => otherIdx < idx && otherAns.includes(ans));
    });

    if (uniqueAnswers.length > 0) {
        console.log(`📝 ${uniqueAnswers.length}件の記述/並び替え問題をロックオンしました！`);
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], textarea, .MuiInputBase-input:not([type="radio"]):not([type="checkbox"])')).filter(el => !el.disabled);
        
        let globalClickDelay = 800;
        const globalUsedBtns = new Set(); 

        uniqueAnswers.forEach((cleanAnsText, index) => {
            let availableBtns = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root'))
                .filter(btn => !btn.disabled && !btn.classList.contains('Mui-disabled') && (btn.innerText || btn.textContent).trim().length > 0);

            let remainingText = cleanAnsText;
            let sequence = [];
            let failsafe = 0;

            // ボタンパズルの組み立て
            while (remainingText.length > 0 && failsafe < 20) {
                failsafe++;
                let found = false;
                for (let i = 0; i < availableBtns.length; i++) {
                    let btn = availableBtns[i];
                    let btnTextRaw = btn.textContent || btn.innerText;
                    let btnTextClean = normText(btnTextRaw);
                    
                    if (btnTextClean && remainingText.startsWith(btnTextClean) && !globalUsedBtns.has(btn)) {
                        sequence.push({ btn: btn, word: btnTextRaw.trim() });
                        remainingText = remainingText.substring(btnTextClean.length);
                        globalUsedBtns.add(btn);
                        found = true;
                        break;
                    }
                }
                if (!found) break; 
            }

            // 👇 【新機能】ボタンがあるならボタンだけ！無いなら文字入力！
            if (sequence.length > 0) {
                // ボタンが見つかったので、クリックだけ実行（入力はサボる！）
                sequence.forEach((item) => {
                    setTimeout(() => {
                        item.btn.click();
                        console.log(`👆 パズルピース「${item.word}」をハメ込みました！`);
                    }, globalClickDelay);
                    globalClickDelay += 200; 
                });
            } else {
                // ボタンが見つからなかったので、テキストボックスに直接入力！
                if (index < textInputs.length) {
                    setTimeout(() => {
                        const originalAnsText = matchedQuestions.find(t => normText(t) === cleanAnsText) || cleanAnsText;
                        const input = textInputs[index];
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        if (nativeInputValueSetter) nativeInputValueSetter.call(input, originalAnsText);
                        else input.value = originalAnsText;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log(`✅ 入力欄に「${originalAnsText}」を自動入力しました！`);
                    }, 300 + (index * 300));
                }
            }
        });
    }
}

// 💥 キーイベント登録
window.onkeydown = (e) => {
    if ((e.key === 'f' || e.key === 'F') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        const verbTargets = document.querySelectorAll('span[data-nan-target]');
        if (verbTargets.length > 0) {
            console.log(`🎯 動詞スナイパー発動！`);
            let delay = 0;
            verbTargets.forEach((target) => {
                setTimeout(() => { target.click(); }, delay);
                delay += 200 + Math.random() * 200; 
            });
        } else {
            solveAnyQuestion();
        }
    }
};