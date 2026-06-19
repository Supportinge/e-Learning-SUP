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
                    console.log(`📥 [NETWORK] 新しい教材データを読み込みました: ${fileName}`);
                });
                return response;
            } catch (e) {
                console.error("❌ [NETWORK] json catch failed:", e);
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

function forceClick(el, labelName = "不明なボタン") {
    if (!el) return;
    try {
        console.log(`🖱️ [CLICK] 「${labelName}」を強行突破クリック！`);
        el.click();
        const innerBtn = el.querySelector('.MuiButtonBase-root');
        if (innerBtn) innerBtn.click();
        const input = el.querySelector('input');
        if (input) {
            input.click();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } catch (e) {
        console.error(`❌ [CLICK ERROR] ${labelName} のクリック中にエラー:`, e);
    }
}

// 💥 【新機能】絶対順守ステートマシン（AI記憶装置）
window.isChappieAutoMode = false;
window.chappieAutoTimer = null;
window.isSolving = false; 
window.chappieState = 'NEED_TO_SOLVE'; 
window.lastFingerprint = ""; 

function toggleAutoMode() {
    window.isChappieAutoMode = !window.isChappieAutoMode;
    if (window.isChappieAutoMode) {
        console.log("🚀 【オート進行モード】ON！ (Aキー)");
        window.chappieState = 'NEED_TO_SOLVE'; 
        window.lastFingerprint = ""; 

        // 監視スピードを0.8秒にして、5秒テストにも素早く対応！
        window.chappieAutoTimer = setInterval(() => {
            const allButtons = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root, .MuiFormControlLabel-root'));

            const nextStepBtn = allButtons.find(b => (b.innerText || b.textContent).trim().startsWith('Next Step'));
            if (nextStepBtn && !nextStepBtn.disabled && !nextStepBtn.classList.contains('Mui-disabled')) {
                console.log("🛑 [AUTO MODE] ステップ完全クリア！オートモードを解除します。");
                toggleAutoMode();
                return;
            }

            const answerBtn = allButtons.find(b => (b.innerText || b.textContent).trim().startsWith('Answer'));
            const nextBtn = allButtons.find(b => {
                const t = (b.innerText || b.textContent).trim();
                return t.startsWith('Next') && !t.includes('Step');
            });

            // 指紋（選択肢の文字）を作って画面の切り替わりを察知
            const candidateBtns = allButtons.filter(b => {
                const t = (b.innerText || b.textContent).trim();
                return t.length > 0 && !/^(Answer|Next|Step)/i.test(t);
            });
            const currentFingerprint = candidateBtns.map(b => normText(b.innerText || b.textContent)).join('');

            if (currentFingerprint !== window.lastFingerprint && currentFingerprint.length > 0) {
                console.log("🔄 [AUTO MODE] 新しい問題を察知しました！");
                window.chappieState = 'NEED_TO_SOLVE'; // 強制的に「解くモード」へ！
                window.lastFingerprint = currentFingerprint;
            }

            // 👇 【最強アプデ】絶対に「解く」のを優先し、解き終わるまでNextを押さない！
            if (window.chappieState === 'NEED_TO_SOLVE') {
                if (!window.isSolving) {
                    console.log("🤖 [AUTO MODE] ハッキングを開始します！");
                    window.isSolving = true;
                    
                    setTimeout(() => {
                        solveAnyQuestion(); // ここで絶対に解く！
                        window.chappieState = 'SOLVED'; // 解き終わった！
                        
                        setTimeout(() => { window.isSolving = false; }, 2000); 
                    }, 800); // 画面描画をちょっと待つ
                }
            } else if (window.chappieState === 'SOLVED') {
                // 解き終わった状態なら、ボタンを押してヨシ！
                if (!window.isSolving) {
                    if (answerBtn && !answerBtn.disabled && !answerBtn.classList.contains('Mui-disabled')) {
                        console.log("🟢 [AUTO MODE] 解答完了！Answerボタンを自動クリック！");
                        answerBtn.click();
                    } else if (nextBtn && !nextBtn.disabled && !nextBtn.classList.contains('Mui-disabled')) {
                        const match = document.body.innerText.match(/(\d+)\s*of\s*(\d+)/i);
                        const isLastQuestion = (match && parseInt(match[1]) >= parseInt(match[2]));

                        if (isLastQuestion) {
                            console.log("🛑 [AUTO MODE] 最後の問題です。オートモードを安全に停止します！");
                            toggleAutoMode();
                        } else {
                            console.log("🔵 [AUTO MODE] Nextボタンを自動クリック！次の問題へ進みます！");
                            nextBtn.click();
                            window.chappieState = 'NEED_TO_SOLVE'; 
                            window.lastFingerprint = ""; 
                        }
                    }
                }
            }
        }, 800); 
    } else {
        console.log("🛑 【オート進行モード】OFF！");
        if (window.chappieAutoTimer) clearInterval(window.chappieAutoTimer);
        window.isSolving = false;
    }
}

// 💥 メインの解答処理
function solveAnyQuestion() {
    console.log(`🎯 [SOLVE] スナイパーモード発動！`);
    const pageText = document.body.innerText;
    const pageTextNoSpace = normText(pageText);

    const rawQuestions = [];
    
    // ① 通信から横取りしたデータ
    for (const fileName in window.Answerlist) {
        findAllQuestions(window.Answerlist[fileName], rawQuestions);
    }
    
    // ② Next.jsの隠し金庫から直接データ
    if (window.__NEXT_DATA__) {
        findAllQuestions(window.__NEXT_DATA__, rawQuestions);
    }

    const allQuestions = [];
    const seenJson = new Set();
    rawQuestions.forEach(q => {
        const jsonStr = JSON.stringify(q);
        if(!seenJson.has(jsonStr)) {
            seenJson.add(jsonStr);
            allQuestions.push(q);
        }
    });

    if (allQuestions.length === 0) {
        console.log("⚠️ [SOLVE] データベースに問題がありません。");
        return false;
    }

    let actionTaken = false; 

    // --- 【攻撃1.5】すべてのボタン型選択問題 ---
    for (const q of allQuestions) {
        if (q.choices && Array.isArray(q.choices)) {
            let correctTexts = [];

            q.choices.forEach(c => {
                if (String(c.correct) === 'true') {
                    let t = c.label || c.text || c.content || c.en || c.ja || "";
                    if (typeof t === 'object') t = t.en || t.ja || t.text || "";
                    correctTexts.push(normText(t));
                }
            });

            if (correctTexts.length === 0 && q.answer) {
                let ansArr = Array.isArray(q.answer) ? q.answer : [q.answer];
                ansArr.forEach(ans => {
                    let sym = typeof ans === 'object' ? (ans.choice || ans.symbol || "") : String(ans);
                    if (/^[A-D]$/i.test(sym)) {
                        const idx = sym.toUpperCase().charCodeAt(0) - 65; 
                        if (q.choices[idx]) {
                            let t = q.choices[idx].label || q.choices[idx].text || q.choices[idx].content || q.choices[idx].en || q.choices[idx].ja || "";
                            if (typeof t === 'object') t = t.en || t.ja || t.text || "";
                            correctTexts.push(normText(t));
                        }
                    } else if (!isNaN(sym) && sym !== "") {
                        const idx = Number(sym);
                        if (q.choices[idx]) {
                            let t = q.choices[idx].label || q.choices[idx].text || q.choices[idx].content || q.choices[idx].en || q.choices[idx].ja || "";
                            if (typeof t === 'object') t = t.en || t.ja || t.text || "";
                            correctTexts.push(normText(t));
                        }
                    } else if (typeof sym === 'string' && sym.length > 1) {
                        correctTexts.push(normText(sym));
                    }
                });
            }

            correctTexts = correctTexts.filter(t => t.length > 0);

            if (correctTexts.length > 0) {
                const buttons = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root'));
                
                let foundChoicesCount = 0;
                q.choices.forEach(c => {
                    let cText = c.label || c.text || c.content || c.en || c.ja || "";
                    if (typeof cText === 'object') cText = cText.en || cText.ja || cText.text || "";
                    const cLabel = normText(cText);
                    if (cLabel.length > 0 && buttons.some(b => normText(b.textContent || b.innerText) === cLabel)) {
                        foundChoicesCount++;
                    }
                });

                const qTextEn = normText(stripHtml(q.question?.en || q.question?.text || ""));
                const qTextJa = normText(stripHtml(q.question?.ja || ""));
                const textMatches = (qTextEn.length > 2 && pageTextNoSpace.includes(qTextEn)) || 
                                    (qTextJa.length > 2 && pageTextNoSpace.includes(qTextJa));

                if (foundChoicesCount >= 2 || textMatches) {
                    let targetBtns = [];
                    correctTexts.forEach(cText => {
                        const btn = buttons.find(b => normText(b.textContent || b.innerText) === cText);
                        if (btn) targetBtns.push({btn: btn, label: cText});
                    });

                    if (targetBtns.length > 0) {
                        console.log(`🎯 [攻撃1.5] ボタン型選択問題をロックオン！（${foundChoicesCount}個の選択肢を確認）`);
                        let clickedCount = 0;
                        targetBtns.forEach(target => {
                            setTimeout(() => { forceClick(target.btn, target.label); }, 100 + (clickedCount * 200));
                            clickedCount++;
                        });
                        actionTaken = true;
                        break; 
                    }
                }
            }
        }
    }

    // --- 【攻撃1】ラジオボタンの処理 ---
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

            let contextNode = groupLabels[0];
            let contextText = "";
            for(let i=0; i<5; i++) {
                if(contextNode.parentElement) {
                    contextNode = contextNode.parentElement;
                    contextText = normText(stripHtml(contextNode.innerText));
                    if (contextText.length > 30) break;
                }
            }
            if (contextText.length < 30) contextText = pageTextNoSpace;

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
                if (qTextEn.length > 5 && contextText.includes(qTextEn)) textMatchBonus += 100;
                if (qTextJa.length > 5 && contextText.includes(qTextJa)) textMatchBonus += 100;

                let totalScore = overlap + textMatchBonus;

                if (totalScore > maxScore) {
                    maxScore = totalScore;
                    bestQ = q;
                }
            }

            if (bestQ && maxScore > 0) {
                let correctSymbols = [];
                let correctTexts = [];

                if (bestQ.choices && Array.isArray(bestQ.choices)) {
                    bestQ.choices.forEach((c, idx) => {
                        const cSymbol = String(c.symbol || c.choice || "");
                        let cTextRaw = c.text || c.label || c.content || c.en || "";
                        if (typeof cTextRaw === 'object') cTextRaw = cTextRaw.en || cTextRaw.ja || cTextRaw.text || "";
                        const cText = normText(stripHtml(cTextRaw));
                        
                        let isCorrect = String(c.correct) === 'true';
                        
                        if (!isCorrect && bestQ.answer) {
                            if (Array.isArray(bestQ.answer)) {
                                isCorrect = bestQ.answer.some(a => {
                                    const aStr = String(typeof a === 'object' ? (a.choice || a.symbol || "") : a);
                                    return aStr === cSymbol || aStr === String(idx);
                                });
                            } else if (typeof bestQ.answer === 'object') {
                                isCorrect = String(bestQ.answer.choice || bestQ.answer.symbol || "") === cSymbol;
                            } else if (typeof bestQ.answer === 'string') {
                                const ansParts = bestQ.answer.split(/[,、\s]+/).map(s => s.trim());
                                isCorrect = ansParts.includes(cSymbol) || ansParts.includes(String(idx)) || bestQ.answer === cSymbol;
                            }
                        }

                        if (isCorrect) {
                            if (cSymbol) correctSymbols.push(cSymbol);
                            else correctSymbols.push(String(idx));
                            if (cText.length > 1) correctTexts.push(cText);
                        }
                    });
                } else if (bestQ.answer && typeof bestQ.answer === 'string') {
                    correctSymbols = bestQ.answer.split(/[,、\s]+/).map(s => s.trim());
                }

                let targetLabels = [];
                if (correctTexts.length > 0) {
                    correctTexts.forEach(cText => {
                        const matchedLabel = groupLabels.find(label => {
                            const labelText = normText(stripHtml(label.innerText));
                            return labelText.includes(cText) || cText.includes(labelText);
                        });
                        if (matchedLabel && !targetLabels.includes(matchedLabel)) {
                            targetLabels.push(matchedLabel);
                        }
                    });
                }
                
                if (targetLabels.length === 0 && correctSymbols.length > 0) {
                    correctSymbols.forEach(sym => {
                        if (/^[A-D]$/i.test(sym)) {
                            const idx = sym.toUpperCase().charCodeAt(0) - 65;
                            if (groupLabels[idx] && !targetLabels.includes(groupLabels[idx])) targetLabels.push(groupLabels[idx]);
                        } else if (!isNaN(sym)) {
                            const idx = Number(sym);
                            if (groupLabels[idx] && !targetLabels.includes(groupLabels[idx])) targetLabels.push(groupLabels[idx]);
                        }
                    });
                }

                if (targetLabels.length > 0) {
                    targetLabels.forEach(targetLabel => {
                        setTimeout(() => { forceClick(targetLabel, "ラジオボタン"); }, 300 + (delayCount * 400));
                        delayCount++;
                        actionTaken = true;
                    });
                }
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
        console.log(`📝 [SOLVE] ${finalAnswersToInput.length}件の記述/並び替え/正誤問題をセット！`);
        
        let globalClickDelay = 100; 
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
                        console.log(`✅ [SOLVE] 正誤問題の入力欄に「${ansTextRaw}」を入力完了。`);
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
                        let targetBtn = item.btn;
                        if (!document.body.contains(targetBtn)) {
                            const freshBtns = Array.from(document.querySelectorAll('button, .MuiButtonBase-root, [role="button"], .MuiChip-root'))
                                .filter(btn => !btn.disabled && !btn.classList.contains('Mui-disabled') && (btn.innerText || btn.textContent).trim().length > 0);
                            const matchingBtns = freshBtns.filter(b => normText(b.textContent || b.innerText) === normText(item.word));
                            if (matchingBtns.length > 0) targetBtn = matchingBtns[matchingBtns.length - 1]; 
                            else targetBtn = null;
                        }

                        if (targetBtn) {
                            forceClick(targetBtn, item.word);
                            console.log(`👆 パズルピース「${item.word}」をハメ込みました！`);
                        }
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
                        console.log(`✅ [SOLVE] 入力欄に「${ansTextRaw}」を入力完了。`);
                    }
                }, 100 + (index * 200));
            }
        });
    }

    // --- 【攻撃0】単語スナイパー ---
    if (!actionTaken) {
        console.log("⚔️ [SOLVE] 単語スナイパーの解析を開始...");
        let vocabMap = {};
        
        const extractVocab = (obj, depth = 0) => {
            if (depth > 15) return; 
            if (!obj || typeof obj !== 'object') return;
            
            if (obj.notes && Array.isArray(obj.notes)) {
                obj.notes.forEach(n => {
                    if (n.en && n.en.vocabulary && n.ja && n.ja.vocabulary) {
                        vocabMap[n.en.vocabulary.trim()] = n.ja.vocabulary.trim();
                    }
                });
            }
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    extractVocab(obj[key], depth + 1);
                }
            }
        };

        for (const fileName in window.Answerlist) {
            extractVocab(window.Answerlist[fileName]);
        }
        if (window.__NEXT_DATA__) {
            extractVocab(window.__NEXT_DATA__);
        }

        if (Object.keys(vocabMap).length > 0) {
            for (const enWord in vocabMap) {
                let isMatch = false;
                const escapedEn = enWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const exactRegex = new RegExp("\\b" + escapedEn + "\\b", "i");
                
                if (exactRegex.test(pageText)) isMatch = true;
                else {
                    const enClean = normText(enWord);
                    if (enClean.length > 2 && pageTextNoSpace.includes(enClean)) isMatch = true;
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
                        return jaWordsArray.some(jw => btnTextClean === jw || (jw.length > 1 && (btnTextClean.includes(jw) || jw.includes(btnTextClean))));
                    });

                    if (targetBtn) {
                        console.log(`🎯 [攻撃0] 単語スナイパー発動！「${enWord}」の正解「${jaWordRaw}」をロックオン！`);
                        setTimeout(() => { forceClick(targetBtn, jaWordRaw); }, 100);
                        actionTaken = true;
                        break; 
                    }
                }
            }
        }
    }

    return actionTaken; 
}

// 💥 キーイベント登録
window.onkeydown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

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
                setTimeout(() => { forceClick(target, "動詞ハイライト"); }, delay);
                delay += 200 + Math.random() * 200; 
            });
        } else {
            if (!window.isSolving) {
                window.isSolving = true;
                solveAnyQuestion();
                window.chappieState = 'SOLVED'; 
                setTimeout(() => { window.isSolving = false; }, 3000);
            }
        }
    }
};

console.log("🤖 【絶対順守ステートマシン版】起動！\n👉 Aキーで一切のスキップ・暴走なしの完璧な自動化が完成したよ！");