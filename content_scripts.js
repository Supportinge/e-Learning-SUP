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
    return (str || "")
        .replace(/\([A-D]\)/gi, '') 
        .replace(/[①②③④]/g, '')   
        .replace(/[\s \/.,?!()\[\]{}""''「」『』~～\-]/g, '')
        .toLowerCase();
}

function findAllQuestions(obj, results = []) {
    if (!obj || typeof obj !== 'object') return results;
    if (obj.answer !== undefined || obj.correct !== undefined || obj.choices !== undefined || obj.parts !== undefined) {
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
    if (q.parts && Array.isArray(q.parts)) {
        return q.parts.join(' ');
    } else if (Array.isArray(q.answer)) {
        return q.answer.map(item => typeof item === 'object' ? (item.text || item.content || "") : item).join(' ');
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

// 💥 【新機能】オート進行モード（Aキー）の管理
window.isChappieAutoMode = false;
window.chappieAutoTimer = null;

function toggleAutoMode() {
    window.isChappieAutoMode = !window.isChappieAutoMode;
    if (window.isChappieAutoMode) {
        console.log("🚀 【オート進行モード】ON！ (Aキー)");
        console.log("👉 Fキーで解答後、自動で Answer と Next を押します。最後の問題の手前で自動停止します！");
        
        window.chappieAutoTimer = setInterval(() => {
            const text = document.body.innerText;
            const buttons = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root'));

            // 1. 最後の問題かチェック（x of y パターン）
            const match = text.match(/(\d+)\s*of\s*(\d+)/i);
            if (match && parseInt(match[1]) >= parseInt(match[2])) {
                console.log("🛑 最後の問題に到達しました！オート進行を解除します。");
                window.isChappieAutoMode = false;
                clearInterval(window.chappieAutoTimer);
                return;
            }

            // Next Step（ステップ完全終了）ボタンがあれば即停止
            const nextStepBtn = buttons.find(b => (b.innerText || b.textContent).trim().startsWith('Next Step'));
            if (nextStepBtn && !nextStepBtn.disabled) {
                console.log("🛑 ステップの終端を検知しました！オート進行を解除します。");
                window.isChappieAutoMode = false;
                clearInterval(window.chappieAutoTimer);
                return;
            }

            // 2. 通常の Next ボタンを探して押す
            const nextBtn = buttons.find(b => {
                const t = (b.innerText || b.textContent).trim();
                return t.startsWith('Next') && !t.includes('Step'); 
            });

            if (nextBtn && !nextBtn.disabled && !nextBtn.classList.contains('Mui-disabled')) {
                console.log("🔵 Nextボタンを自動クリックしました！");
                nextBtn.click();
                return;
            }

            // 3. Answerボタンを探して押す（Fキーで入力が完了し、緑色になった瞬間を狙う！）
            const answerBtn = buttons.find(b => {
                const t = (b.innerText || b.textContent).trim();
                return t.startsWith('Answer');
            });

            if (answerBtn && !answerBtn.disabled && !answerBtn.classList.contains('Mui-disabled')) {
                console.log("🟢 Answerボタンを自動クリックしました！");
                answerBtn.click();
            }
        }, 1000); // 1秒ごとに監視
    } else {
        console.log("🛑 【オート進行モード】OFF！手動操作に戻ります。");
        if (window.chappieAutoTimer) clearInterval(window.chappieAutoTimer);
    }
}

// 💥 メインの解答処理（Fキー）
function solveAnyQuestion() {
    console.log(`🎯 スナイパーモード発動！画面の問題を解析します…`);
    const pageText = document.body.innerText;
    const pageTextNoSpace = normText(pageText);

    const allQuestions = [];
    for (const fileName in window.Answerlist) {
        findAllQuestions(window.Answerlist[fileName], allQuestions);
    }
    if (allQuestions.length === 0) {
        console.log("⚠️ データベースに問題がありません。");
        return;
    }

    let actionTaken = false; 

    // --- 【攻撃1.5】文法・読解の多択/チェックボックスの処理 ---
    for (const q of allQuestions) {
        if (q.choices && Array.isArray(q.choices)) {
            const correctChoices = q.choices.filter(c => String(c.correct) === 'true');
            if (correctChoices.length > 0) {
                let clickedCount = 0;
                correctChoices.forEach(correctChoice => {
                    let cText = correctChoice.label || correctChoice.text || correctChoice.content || correctChoice.en || "";
                    if (typeof cText === 'object') cText = cText.en || cText.ja || cText.text || "";
                    
                    const targetLabel = normText(cText);
                    if (targetLabel.length > 1) { 
                        const buttons = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root, .MuiFormControlLabel-root'));
                        const targetBtn = buttons.find(btn => normText(btn.textContent || btn.innerText) === targetLabel);
                        const qText = normText(stripHtml(q.question?.text || q.question?.ja || q.question?.en || ""));
                        const textMatches = qText.length > 5 && pageTextNoSpace.includes(qText.substring(0, 15));

                        if (targetBtn && textMatches) {
                            console.log(`🎯 複数選択をロックオン！ 正解のラベル: ${correctChoice.label}`);
                            setTimeout(() => { 
                                const input = targetBtn.querySelector('input');
                                if(input) input.click();
                                else targetBtn.click(); 
                            }, 300 + (clickedCount * 300));
                            clickedCount++;
                            actionTaken = true;
                        }
                    }
                });
                if (actionTaken) break; 
            }
        }
    }

    // --- 【攻撃1】ラジオボタン・チェックボックスの処理 ---
    if (!actionTaken) {
        let delayCount = 0; 
        const radioGroupsMap = new Map();
        
        document.querySelectorAll('.MuiFormControlLabel-root').forEach(label => {
            const input = label.querySelector('input');
            const key = (input && input.name) ? input.name : (label.closest('[role="radiogroup"], .MuiFormGroup-root') || label.parentElement.parentElement);
            if (!radioGroupsMap.has(key)) radioGroupsMap.set(key, []);
            radioGroupsMap.get(key).push(label);
        });
        const radioGroups = Array.from(radioGroupsMap.values());

        radioGroups.forEach((groupLabels, groupIndex) => {
            const screenChoices = groupLabels.map(label => normText(stripHtml(label.innerText))).filter(t => t.length > 1);
            if (screenChoices.length === 0) return;

            let bestQ = null;
            let maxScore = -1;

            for (const q of allQuestions) {
                if (!q.choices || !Array.isArray(q.choices)) continue;
                
                const qChoices = q.choices.map(c => {
                    let t = c.text || c.label || c.content || c.en || c.ja || "";
                    if (typeof t === 'object') t = t.text || t.en || t.ja || t.content || "";
                    return normText(stripHtml(t));
                }).filter(t => t.length > 1);

                let overlap = 0;
                for (const sc of screenChoices) {
                    if (qChoices.some(qc => qc.includes(sc) || sc.includes(qc) || qc === sc)) overlap++;
                }

                let textMatchBonus = 0;
                const qTextEn = normText(stripHtml(q.question?.en || q.question?.text || ""));
                const qTextJa = normText(stripHtml(q.question?.ja || ""));
                if (qTextEn.length > 5 && pageTextNoSpace.includes(qTextEn)) textMatchBonus += 100;
                if (qTextJa.length > 5 && pageTextNoSpace.includes(qTextJa)) textMatchBonus += 100;

                let totalScore = overlap + textMatchBonus;

                if (totalScore > maxScore) {
                    maxScore = totalScore;
                    bestQ = q;
                }
            }

            if (bestQ && maxScore > 0) {
                let tempSymbols = [];
                if (bestQ.answer) {
                    if (Array.isArray(bestQ.answer)) {
                        tempSymbols = bestQ.answer.map(a => typeof a === 'object' ? String(a.choice || a.symbol || "") : String(a));
                    } else if (typeof bestQ.answer === 'object' && bestQ.answer !== null) {
                        tempSymbols = [String(bestQ.answer.choice || bestQ.answer.symbol || "")];
                    } else if (typeof bestQ.answer === 'string') {
                        tempSymbols = bestQ.answer.split(/[,、\s]+/).map(s => s.trim());
                    }
                } else if (bestQ.choices && Array.isArray(bestQ.choices)) {
                    bestQ.choices.forEach((c, idx) => {
                        if (String(c.correct) === 'true') tempSymbols.push(String(idx)); 
                    });
                }

                tempSymbols.forEach(tempSymbol => {
                    if (tempSymbol !== "") {
                        let targetLabel = null;
                        if (/^[A-D]$/i.test(tempSymbol)) {
                            const idx = tempSymbol.toUpperCase().charCodeAt(0) - 65;
                            targetLabel = groupLabels[idx];
                        } else if (!isNaN(tempSymbol)) {
                            targetLabel = groupLabels[Number(tempSymbol)];
                        }

                        if (targetLabel) {
                            setTimeout(() => { 
                                const input = targetLabel.querySelector('input');
                                if (input) input.click();
                                else targetLabel.click();
                            }, 300 + (delayCount * 400));
                            delayCount++;
                            actionTaken = true;
                        }
                    }
                });
            }
        });
    }

    // --- 【攻撃2】記述・並び替え・正誤問題の処理 ---
    const qGroups = new Map();
    for (const q of allQuestions) {
        const qEn = normText(stripHtml(q.question?.en || ""));
        const qJa = normText(stripHtml(q.question?.ja || ""));
        let key = "";
        if (qEn.length > 5 && pageTextNoSpace.includes(qEn.substring(0, 20))) key = qEn.substring(0, 20);
        else if (qJa.length > 5 && pageTextNoSpace.includes(qJa.substring(0, 20))) key = qJa.substring(0, 20);
        
        if (key) {
            if (!qGroups.has(key)) qGroups.set(key, []);
            qGroups.get(key).push(q);
        }
    }

    let finalAnswersToInput = [];
    const availableBtnsForScore = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root'))
        .filter(btn => !btn.disabled && !btn.classList.contains('Mui-disabled') && (btn.innerText || btn.textContent).trim().length > 0 && !/^[A-D]$/i.test((btn.innerText || btn.textContent).trim()));

    qGroups.forEach(group => {
        let bestQ = null;
        let maxScore = -1;
        let bestAnsTextLength = -1; 

        group.forEach(q => {
            let score = 0;
            let checkPieces = [];
            
            if (q.parts && Array.isArray(q.parts)) {
                checkPieces = q.parts.slice();
            } else if (Array.isArray(q.answer)) {
                checkPieces = q.answer.map(item => typeof item === 'object' ? (item.text || item.content || "") : item);
            } else if (typeof q.answer === 'string') {
                checkPieces = q.answer.split(/[\s\/]+/);
            } else if (q.answer && typeof q.answer === 'object' && q.answer.correct && q.answer.choice) {
                // 正誤問題
            } else if (typeof q.answer === 'object' && q.answer !== null && q.answer.text) {
                checkPieces = q.answer.text.split(/[\s\/]+/);
            }

            let pieceMatchCount = 0;
            checkPieces.forEach(p => {
                const pieceText = normText(p);
                if (pieceText.length > 0 && availableBtnsForScore.some(btn => normText(btn.innerText || btn.textContent) === pieceText)) {
                    pieceMatchCount++;
                }
            });

            if (pieceMatchCount > 1) score += pieceMatchCount * 100;
            else if (pieceMatchCount === 1) score += 10;

            if (q.choices && Array.isArray(q.choices)) {
                let choiceMatchCount = 0;
                q.choices.forEach(c => {
                    const cText = normText(stripHtml(c.text || c.label || c.content || ""));
                    if (cText.length > 1 && pageTextNoSpace.includes(cText)) choiceMatchCount++;
                });
                score += choiceMatchCount * 5;
            }

            let tempAnsText = "";
            if (q.answer && typeof q.answer === 'object' && q.answer.correct && q.answer.choice) {
                tempAnsText = stripHtml(q.answer.correct);
                score += 50; 
            } else {
                tempAnsText = extractTextAnswer(q);
            }

            if (score === 0) score = 1;

            if (score > maxScore) {
                maxScore = score;
                bestQ = q;
                bestAnsTextLength = tempAnsText.length;
            } else if (score === maxScore) {
                if (availableBtnsForScore.length === 0) {
                    if (tempAnsText.length < bestAnsTextLength && tempAnsText.length > 0) {
                        bestQ = q;
                        bestAnsTextLength = tempAnsText.length;
                    }
                } else {
                    if (tempAnsText.length > bestAnsTextLength) {
                        bestQ = q;
                        bestAnsTextLength = tempAnsText.length;
                    }
                }
            }
        });

        if (bestQ) {
            let ansText = "";
            let isErrorCorrection = false; 
            if (bestQ.answer && typeof bestQ.answer === 'object' && bestQ.answer.correct && bestQ.answer.choice) {
                ansText = stripHtml(bestQ.answer.correct);
                isErrorCorrection = true;
            } else {
                ansText = extractTextAnswer(bestQ);
            }
            if (ansText && !finalAnswersToInput.some(a => a.text === ansText)) {
                finalAnswersToInput.push({ text: ansText, isErrorCorrection: isErrorCorrection });
            }
        }
    });

    if (availableBtnsForScore.length > 0) {
        finalAnswersToInput.sort((a, b) => b.text.length - a.text.length);
        finalAnswersToInput = finalAnswersToInput.filter((ans, idx, arr) => {
            return !arr.some((other, otherIdx) => otherIdx < idx && other.text.includes(ans.text));
        });
    } else {
        finalAnswersToInput.sort((a, b) => {
            if (a.isErrorCorrection && !b.isErrorCorrection) return -1;
            if (!a.isErrorCorrection && b.isErrorCorrection) return 1;
            return a.text.length - b.text.length;
        });
    }

    if (finalAnswersToInput.length > 0) {
        actionTaken = true; 
        console.log(`📝 ${finalAnswersToInput.length}件の記述/並び替え/正誤問題をロックオンしました！`);
        
        let globalClickDelay = 800;
        const globalUsedBtns = new Set(); 

        finalAnswersToInput.forEach((ansObj, index) => {
            const ansTextRaw = ansObj.text;

            if (ansObj.isErrorCorrection) {
                setTimeout(() => {
                    const freshTextInputs = Array.from(document.querySelectorAll('input[type="text"], textarea, .MuiInputBase-input:not([type="radio"]):not([type="checkbox"])')).filter(el => !el.disabled);
                    if (index < freshTextInputs.length) {
                        const input = freshTextInputs[index];
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        if (nativeInputValueSetter) nativeInputValueSetter.call(input, ansTextRaw);
                        else input.value = ansTextRaw;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log(`✅ 正誤問題の入力欄に「${ansTextRaw}」を自動入力しました！`);
                    }
                }, 600 + (index * 300));
                return; 
            }

            let remainingText = normText(ansTextRaw);
            let sequence = [];
            let failsafe = 0;

            while (remainingText.length > 0 && failsafe < 20) {
                failsafe++;
                let found = false;
                for (let i = 0; i < availableBtnsForScore.length; i++) {
                    let btn = availableBtnsForScore[i];
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

            if (sequence.length > 0) {
                sequence.forEach((item) => {
                    setTimeout(() => {
                        item.btn.click();
                        console.log(`👆 パズルピース「${item.word}」をハメ込みました！`);
                    }, globalClickDelay);
                    globalClickDelay += 200; 
                });
            } else {
                setTimeout(() => {
                    const freshTextInputs = Array.from(document.querySelectorAll('input[type="text"], textarea, .MuiInputBase-input:not([type="radio"]):not([type="checkbox"])')).filter(el => !el.disabled);
                    if (index < freshTextInputs.length) {
                        const input = freshTextInputs[index];
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        if (nativeInputValueSetter) nativeInputValueSetter.call(input, ansTextRaw);
                        else input.value = ansTextRaw;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log(`✅ 入力欄に「${ansTextRaw}」を自動入力しました！`);
                    }
                }, 600 + (index * 300));
            }
        });
    }

    // --- 【攻撃0】単語スナイパー ---
    if (!actionTaken) {
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
                let isMatch = false;
                const escapedEn = enWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const exactRegex = new RegExp("\\b" + escapedEn + "\\b", "i");
                
                if (exactRegex.test(pageText)) isMatch = true;
                else {
                    const enClean = normText(enWord);
                    if (enClean.length > 4 && pageTextNoSpace.includes(enClean)) isMatch = true;
                }

                if (isMatch) {
                    const jaWordRaw = vocabMap[enWord];
                    const jaWordFullClean = normText(jaWordRaw);
                    const jaWordsArray = jaWordRaw.split(/[、,・\/]+/).map(w => normText(w)).filter(w => w.length > 0);

                    const buttons = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root'));
                    const targetBtn = buttons.find(btn => {
                        const btnTextClean = normText(btn.textContent || btn.innerText);
                        if (!btnTextClean) return false;
                        if (btnTextClean === jaWordFullClean) return true;
                        return jaWordsArray.some(jw => btnTextClean === jw || (jw.length > 2 && (btnTextClean.includes(jw) || jw.includes(btnTextClean))));
                    });

                    if (targetBtn) {
                        console.log(`🎯 単語スナイパー発動！「${enWord}」の正解「${jaWordRaw}」をロックオン！`);
                        setTimeout(() => { targetBtn.click(); }, 100);
                        break; 
                    }
                }
            }
        }
    }
}

// 💥 キーイベント登録
window.onkeydown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // 👇 Aキーでオート進行モードの切り替え！
    if (e.key === 'a' || e.key === 'A') {
        toggleAutoMode();
        return;
    }

    if (e.key === 'f' || e.key === 'F') {
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

console.log("🤖 【フルオート進行モード搭載版】起動！\n👉 Fキー：解答する\n👉 Aキー：オート進行（Answer＆Next）ON/OFF");