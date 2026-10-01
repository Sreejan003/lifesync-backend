/**
 * LifeSync - Soothing Games & Mindful Break Module (js/soothing-games.js)
 * -----------------------------------------------------------------------
 * Provides relaxing, non-stress mindful mini-games for the Mental Wellness section:
 * 1. Zen Sudoku (Powered by Free Dosuku Sudoku API with offline fallback)
 * 2. Mindful Word Scramble (Peaceful vocabulary & free Random Word API)
 * 3. Mindful Riddle & Zen Quotes (Free Riddles & Quotes APIs)
 * 4. 4-7-8 Guided Breathing Pacer (Audio-visual relaxation exercise)
 */

(function () {
    'use strict';

    // ==========================================
    // 1. ZEN SUDOKU ENGINE
    // ==========================================

    // High quality offline fallback boards in case of no internet
    const SUDOKU_FALLBACKS = {
        easy: {
            value: [
                [0, 2, 0, 0, 0, 0, 0, 8, 0],
                [5, 0, 0, 0, 0, 3, 0, 0, 4],
                [0, 0, 0, 2, 4, 0, 0, 0, 0],
                [0, 0, 3, 0, 0, 8, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 2, 9, 0, 0, 7, 0, 0],
                [0, 0, 0, 0, 3, 1, 0, 0, 0],
                [8, 0, 0, 5, 0, 0, 0, 0, 9],
                [0, 7, 0, 0, 0, 0, 0, 6, 0]
            ],
            solution: [
                [4, 2, 6, 1, 7, 5, 9, 8, 3],
                [5, 8, 7, 6, 9, 3, 1, 2, 4],
                [3, 1, 9, 2, 4, 8, 5, 7, 6],
                [9, 6, 3, 7, 5, 8, 2, 4, 1],
                [7, 5, 8, 4, 1, 2, 6, 3, 9],
                [1, 4, 2, 9, 6, 3, 7, 5, 8],
                [6, 9, 5, 8, 3, 1, 4, 0, 7],
                [8, 3, 4, 5, 2, 6, 0, 1, 9],
                [2, 7, 1, 3, 8, 4, 8, 6, 5]
            ],
            difficulty: "Easy"
        },
        medium: {
            value: [
                [3, 0, 0, 2, 0, 0, 0, 6, 9],
                [8, 0, 0, 4, 0, 0, 0, 1, 0],
                [6, 0, 0, 0, 9, 0, 3, 2, 8],
                [0, 6, 0, 3, 4, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 9, 0, 8, 4],
                [4, 0, 0, 0, 0, 0, 6, 0, 0],
                [0, 5, 2, 8, 0, 6, 9, 0, 1],
                [1, 8, 0, 0, 0, 4, 0, 7, 0],
                [9, 0, 4, 0, 0, 0, 0, 0, 6]
            ],
            solution: [
                [3, 1, 5, 2, 7, 8, 4, 6, 9],
                [8, 2, 9, 4, 6, 3, 5, 1, 7],
                [6, 4, 7, 1, 9, 5, 3, 2, 8],
                [2, 6, 8, 3, 4, 1, 7, 9, 5],
                [5, 7, 3, 6, 2, 9, 1, 8, 4],
                [4, 9, 1, 5, 8, 7, 6, 3, 2],
                [7, 5, 2, 8, 3, 6, 9, 4, 1],
                [1, 8, 6, 9, 5, 4, 2, 7, 3],
                [9, 3, 4, 7, 1, 2, 8, 5, 6]
            ],
            difficulty: "Medium"
        }
    };

    let sudokuState = {
        board: [],
        initialBoard: [],
        solution: [],
        selectedCell: null, // { r, c }
        history: [],
        difficulty: 'medium',
        timerSeconds: 0,
        timerInterval: null,
        isCompleted: false,
        mistakesCount: 0
    };

    async function fetchSudokuFromAPI(difficulty = 'medium') {
        const url = 'https://sudoku-api.vercel.app/api/dosuku';
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4500);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data.newboard && data.newboard.grids && data.newboard.grids.length > 0) {
                    const grid = data.newboard.grids[0];
                    return {
                        value: grid.value,
                        solution: grid.solution,
                        difficulty: grid.difficulty || difficulty
                    };
                }
            }
        } catch (e) {
            console.info('Dosuku API fetch failed or timed out, loading calming fallback puzzle.');
        }

        // Return copy of fallback puzzle
        const fallback = SUDOKU_FALLBACKS[difficulty.toLowerCase()] || SUDOKU_FALLBACKS.medium;
        return JSON.parse(JSON.stringify(fallback));
    }

    function startSudokuTimer() {
        if (sudokuState.timerInterval) clearInterval(sudokuState.timerInterval);
        sudokuState.timerSeconds = 0;
        updateSudokuTimerDisplay();
        sudokuState.timerInterval = setInterval(() => {
            if (!sudokuState.isCompleted) {
                sudokuState.timerSeconds++;
                updateSudokuTimerDisplay();
            }
        }, 1000);
    }

    function updateSudokuTimerDisplay() {
        const timerElem = document.getElementById('sudokuTimerDisplay');
        if (!timerElem) return;
        const mins = String(Math.floor(sudokuState.timerSeconds / 60)).padStart(2, '0');
        const secs = String(sudokuState.timerSeconds % 60).padStart(2, '0');
        timerElem.textContent = `${mins}:${secs}`;
    }

    async function initSudokuGame(difficulty = 'medium') {
        const statusElem = document.getElementById('sudokuStatusMessage');
        if (statusElem) statusElem.textContent = 'Fetching fresh puzzle...';

        sudokuState.difficulty = difficulty;
        sudokuState.isCompleted = false;
        sudokuState.selectedCell = null;
        sudokuState.history = [];
        sudokuState.mistakesCount = 0;
        sudokuState.hintsUsed = 0;
        sudokuState.checksCount = 0;
        sudokuState.puzzleId = `board_${difficulty}_${Date.now()}`;

        const puzzle = await fetchSudokuFromAPI(difficulty);
        sudokuState.initialBoard = JSON.parse(JSON.stringify(puzzle.value));
        sudokuState.board = JSON.parse(JSON.stringify(puzzle.value));
        sudokuState.solution = puzzle.solution;

        if (statusElem) statusElem.textContent = `Zen Mode (${puzzle.difficulty || difficulty})`;

        renderSudokuGrid();
        startSudokuTimer();

        // Notify backend of puzzle start if online
        if (typeof window !== 'undefined' && window.LifeSyncAPI && typeof window.LifeSyncAPI.saveSudokuProgress === 'function') {
            window.LifeSyncAPI.saveSudokuProgress({
                puzzleId: sudokuState.puzzleId,
                difficulty: sudokuState.difficulty,
                timeSeconds: 0,
                mistakesCount: 0,
                hintsUsed: 0,
                checksCount: 0
            }).catch(() => {});
        }
    }

    function renderSudokuGrid() {
        const gridElem = document.getElementById('sudokuGridContainer');
        if (!gridElem) return;

        gridElem.innerHTML = '';

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const val = sudokuState.board[r][c];
                const isInitial = sudokuState.initialBoard[r][c] !== 0;

                const cell = document.createElement('div');
                cell.className = 'sudoku-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                // 3x3 block borders
                if (r % 3 === 0 && r !== 0) cell.classList.add('border-top-thick');
                if (c % 3 === 0 && c !== 0) cell.classList.add('border-left-thick');

                if (isInitial) {
                    cell.classList.add('cell-initial');
                } else if (val !== 0) {
                    cell.classList.add('cell-user-filled');
                }

                if (val !== 0) {
                    cell.textContent = val;
                }

                // Highlight selected cell
                if (sudokuState.selectedCell && sudokuState.selectedCell.r === r && sudokuState.selectedCell.c === c) {
                    cell.classList.add('cell-selected');
                } else if (sudokuState.selectedCell) {
                    const selR = sudokuState.selectedCell.r;
                    const selC = sudokuState.selectedCell.c;
                    const selVal = sudokuState.board[selR][selC];

                    // Highlight same row, col, or 3x3 box
                    const inSameBox = Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3);
                    if (r === selR || c === selC || inSameBox) {
                        cell.classList.add('cell-related');
                    }

                    // Highlight matching numbers
                    if (selVal !== 0 && val === selVal) {
                        cell.classList.add('cell-same-number');
                    }
                }

                cell.addEventListener('click', () => {
                    selectSudokuCell(r, c);
                });

                gridElem.appendChild(cell);
            }
        }
    }

    function selectSudokuCell(r, c) {
        sudokuState.selectedCell = { r, c };
        renderSudokuGrid();
    }

    function applySudokuNumber(num) {
        if (!sudokuState.selectedCell || sudokuState.isCompleted) return;
        const { r, c } = sudokuState.selectedCell;

        // If it was a fixed starting number, cannot change
        if (sudokuState.initialBoard[r][c] !== 0) return;

        const oldVal = sudokuState.board[r][c];
        if (oldVal === num) return; // No change

        // Save history for undo
        sudokuState.history.push({ r, c, prevVal: oldVal, newVal: num });
        sudokuState.board[r][c] = num;

        renderSudokuGrid();
        checkSudokuCompletion();
    }

    function eraseSudokuCell() {
        if (!sudokuState.selectedCell || sudokuState.isCompleted) return;
        const { r, c } = sudokuState.selectedCell;
        if (sudokuState.initialBoard[r][c] !== 0) return;

        const oldVal = sudokuState.board[r][c];
        if (oldVal === 0) return;

        sudokuState.history.push({ r, c, prevVal: oldVal, newVal: 0 });
        sudokuState.board[r][c] = 0;

        renderSudokuGrid();
    }

    function undoSudokuMove() {
        if (sudokuState.history.length === 0 || sudokuState.isCompleted) return;
        const lastMove = sudokuState.history.pop();
        sudokuState.board[lastMove.r][lastMove.c] = lastMove.prevVal;
        sudokuState.selectedCell = { r: lastMove.r, c: lastMove.c };
        renderSudokuGrid();
    }

    function giveSudokuHint() {
        if (!sudokuState.selectedCell || sudokuState.isCompleted) {
            // Pick first empty cell
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (sudokuState.board[r][c] === 0) {
                        sudokuState.selectedCell = { r, c };
                        break;
                    }
                }
                if (sudokuState.selectedCell) break;
            }
        }

        if (!sudokuState.selectedCell) return;
        const { r, c } = sudokuState.selectedCell;

        if (sudokuState.solution && sudokuState.solution[r]) {
            const correctVal = sudokuState.solution[r][c];
            sudokuState.board[r][c] = correctVal;
            sudokuState.hintsUsed = (sudokuState.hintsUsed || 0) + 1;
            renderSudokuGrid();

            if (window.UI && window.UI.showToast) {
                window.UI.showToast(`Hint placed: ${correctVal}`, 'info');
            }
            checkSudokuCompletion();
        }
    }

    function checkSudokuErrors() {
        let errorCount = 0;
        const gridElem = document.getElementById('sudokuGridContainer');
        if (!gridElem) return;

        sudokuState.checksCount = (sudokuState.checksCount || 0) + 1;
        const cells = gridElem.querySelectorAll('.sudoku-cell');

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const currentVal = sudokuState.board[r][c];
                const isInitial = sudokuState.initialBoard[r][c] !== 0;

                if (!isInitial && currentVal !== 0 && sudokuState.solution && sudokuState.solution[r]) {
                    const expectedVal = sudokuState.solution[r][c];
                    const idx = r * 9 + c;
                    const cellEl = cells[idx];

                    if (currentVal !== expectedVal) {
                        errorCount++;
                        if (cellEl) cellEl.classList.add('cell-error');
                    }
                }
            }
        }

        if (errorCount > 0) {
            sudokuState.mistakesCount = (sudokuState.mistakesCount || 0) + errorCount;
        }

        const statusElem = document.getElementById('sudokuStatusMessage');
        if (errorCount === 0) {
            if (statusElem) statusElem.textContent = '✨ Everything looks great so far!';
            if (window.UI && window.UI.showToast) window.UI.showToast('Great job! No mistakes found so far.', 'success');
        } else {
            if (statusElem) statusElem.textContent = `Highlighted ${errorCount} mistake(s). Keep breathing!`;
            if (window.UI && window.UI.showToast) window.UI.showToast(`Found ${errorCount} conflicting number(s).`, 'warning');
        }

        // Remove error highlight after 3 seconds
        setTimeout(() => {
            cells.forEach(c => c.classList.remove('cell-error'));
        }, 3000);
    }

    function checkSudokuCompletion() {
        if (!sudokuState.solution || sudokuState.solution.length === 0) return;

        let allFilled = true;
        let allCorrect = true;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (sudokuState.board[r][c] === 0) {
                    allFilled = false;
                    break;
                }
                if (sudokuState.board[r][c] !== sudokuState.solution[r][c]) {
                    allCorrect = false;
                }
            }
            if (!allFilled) break;
        }

        if (allFilled && allCorrect) {
            sudokuState.isCompleted = true;
            if (sudokuState.timerInterval) clearInterval(sudokuState.timerInterval);

            const statusElem = document.getElementById('sudokuStatusMessage');
            if (statusElem) statusElem.textContent = '🎉 Congratulations! Zen Sudoku Mastered!';

            if (window.UI && window.UI.showToast) {
                window.UI.showToast('🎉 Wonderful! You solved the Zen Sudoku puzzle!', 'success');
            }

            // Sync completion to backend if available
            if (typeof window !== 'undefined' && window.LifeSyncAPI && typeof window.LifeSyncAPI.completeSudoku === 'function') {
                window.LifeSyncAPI.completeSudoku({
                    puzzleId: sudokuState.puzzleId,
                    difficulty: sudokuState.difficulty,
                    timeSeconds: sudokuState.timerSeconds,
                    mistakesCount: sudokuState.mistakesCount || 0,
                    hintsUsed: sudokuState.hintsUsed || 0,
                    checksCount: sudokuState.checksCount || 0
                }).catch(() => {});
            }
        }
    }


    // ==========================================
    // 2. MINDFUL WORD SCRAMBLE
    // ==========================================

    const MINDFUL_WORDS = [
        { word: 'SERENITY', clue: 'The state of being calm, peaceful, and untroubled.' },
        { word: 'BREATHE', clue: 'Inhale peace, exhale tension and study fatigue.' },
        { word: 'TRANQUIL', clue: 'Free from disturbance; peaceful and still.' },
        { word: 'BALANCE', clue: 'Harmonious equilibrium between studies, rest, and life.' },
        { word: 'HARMONY', clue: 'A pleasing, peaceful arrangement of thoughts and actions.' },
        { word: 'PATIENCE', clue: 'The capacity to endure delay or challenges with composure.' },
        { word: 'MINDFUL', clue: 'Being fully present and aware in this exact moment.' },
        { word: 'GRATITUDE', clue: 'The feeling of thankfulness and appreciating simple blessings.' },
        { word: 'CLARITY', clue: 'Mental lucidity, sharp perception, and freedom from ambiguity.' },
        { word: 'RESILIENCE', clue: 'The strength to bounce back from difficult assignments or setbacks.' },
        { word: 'COURAGE', clue: 'The quiet inner voice that says: I will try again tomorrow.' },
        { word: 'COMFORT', clue: 'A state of ease, reassurance, and peaceful relief.' },
        { word: 'MEDITATE', clue: 'Taking peaceful time to settle your thoughts and focus.' },
        { word: 'KINDNESS', clue: 'Gentleness, generosity, and compassion toward yourself and others.' }
    ];

    let scrambleState = {
        targetWord: '',
        clue: '',
        scrambledLetters: [],
        currentGuess: [], // array of objects { letter, originalIndex }
        streak: 0
    };

    function shuffleString(str) {
        const arr = str.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        // Ensure not identical to original
        if (arr.join('') === str && str.length > 2) {
            [arr[0], arr[1]] = [arr[1], arr[0]];
        }
        return arr;
    }

    async function loadNextScramble() {
        let picked;

        // Try fetching a random word from API optionally, fallback to mindful dictionary
        try {
            if (Math.random() > 0.6) {
                const res = await fetch('https://random-word-api.herokuapp.com/word?length=6');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data[0]) {
                        picked = {
                            word: data[0].toUpperCase(),
                            clue: 'Mindful vocabulary challenge. Focus and unscramble the word!'
                        };
                    }
                }
            }
        } catch (e) {}

        if (!picked) {
            picked = MINDFUL_WORDS[Math.floor(Math.random() * MINDFUL_WORDS.length)];
        }

        scrambleState.targetWord = picked.word.toUpperCase();
        scrambleState.clue = picked.clue;
        scrambleState.scrambledLetters = shuffleString(scrambleState.targetWord);
        scrambleState.currentGuess = [];

        renderScrambleUI();
    }

    function renderScrambleUI() {
        const clueElem = document.getElementById('scrambleClueText');
        const tilesContainer = document.getElementById('scrambleAvailableTiles');
        const answerContainer = document.getElementById('scrambleAnswerSlots');
        const streakElem = document.getElementById('scrambleStreakVal');
        const feedbackElem = document.getElementById('scrambleFeedbackMsg');

        if (clueElem) clueElem.textContent = scrambleState.clue;
        if (streakElem) streakElem.textContent = `Streak: ${scrambleState.streak} 🔥`;
        if (feedbackElem) feedbackElem.textContent = '';

        // Render available letter tiles
        if (tilesContainer) {
            tilesContainer.innerHTML = '';
            scrambleState.scrambledLetters.forEach((letter, idx) => {
                const isUsed = scrambleState.currentGuess.some(g => g.originalIndex === idx);
                const tile = document.createElement('button');
                tile.type = 'button';
                tile.className = `letter-tile ${isUsed ? 'used' : ''}`;
                tile.textContent = letter;

                if (!isUsed) {
                    tile.addEventListener('click', () => {
                        scrambleState.currentGuess.push({ letter, originalIndex: idx });
                        renderScrambleUI();
                        checkAutoSubmitScramble();
                    });
                }

                tilesContainer.appendChild(tile);
            });
        }

        // Render answer slots
        if (answerContainer) {
            answerContainer.innerHTML = '';
            for (let i = 0; i < scrambleState.targetWord.length; i++) {
                const slot = document.createElement('div');
                slot.className = 'answer-slot';

                if (i < scrambleState.currentGuess.length) {
                    const guessItem = scrambleState.currentGuess[i];
                    slot.textContent = guessItem.letter;
                    slot.classList.add('filled');
                    slot.title = 'Click to remove letter';

                    slot.addEventListener('click', () => {
                        scrambleState.currentGuess.splice(i, 1);
                        renderScrambleUI();
                    });
                }

                answerContainer.appendChild(slot);
            }
        }
    }

    function checkAutoSubmitScramble() {
        if (scrambleState.currentGuess.length === scrambleState.targetWord.length) {
            verifyScrambleAnswer();
        }
    }

    function verifyScrambleAnswer() {
        const guessStr = scrambleState.currentGuess.map(g => g.letter).join('');
        const feedbackElem = document.getElementById('scrambleFeedbackMsg');

        if (guessStr === scrambleState.targetWord) {
            scrambleState.streak++;
            if (feedbackElem) {
                feedbackElem.className = 'scramble-feedback success';
                feedbackElem.textContent = `🎉 Correct! Wonderful focus! (+50 Zen XP)`;
            }
            if (window.UI && window.UI.showToast) {
                window.UI.showToast(`✨ Excellent! "${scrambleState.targetWord}" is correct!`, 'success');
            }

            // Award XP to user profile if available
            try {
                if (window.ProfileModule && window.ProfileModule.getProfile) {
                    const prof = window.ProfileModule.getProfile();
                    if (prof) {
                        prof.xp = (prof.xp || 120) + 50;
                        if (window.LifeSyncStorage && window.LifeSyncStorage.saveProfile) {
                            window.LifeSyncStorage.saveProfile(window.AuthSystem.getCurrentUser(), prof);
                        }
                    }
                }
            } catch (e) {}

            // Sync Word Scramble solve to backend if available
            if (typeof window !== 'undefined' && window.LifeSyncAPI && typeof window.LifeSyncAPI.saveWordScrambleProgress === 'function') {
                window.LifeSyncAPI.saveWordScrambleProgress({
                    streak: scrambleState.streak,
                    xpEarned: 50,
                    wordCompleted: true,
                    word: scrambleState.targetWord,
                    hintsUsed: scrambleState.hintsUsed || 0
                }).catch(() => {});
            }

            setTimeout(() => {
                loadNextScramble();
            }, 1600);
        } else {
            if (feedbackElem) {
                feedbackElem.className = 'scramble-feedback error';
                feedbackElem.textContent = `Not quite right yet. Try rearranging the letters!`;
            }
        }
    }

    function clearScrambleGuess() {
        scrambleState.currentGuess = [];
        renderScrambleUI();
    }

    function giveScrambleHint() {
        scrambleState.hintsUsed = (scrambleState.hintsUsed || 0) + 1;
        // Place the next correct letter in order
        const currentLen = scrambleState.currentGuess.length;
        if (currentLen >= scrambleState.targetWord.length) return;

        const nextLetter = scrambleState.targetWord[currentLen];

        // Find an unused index with this letter
        const availableIdx = scrambleState.scrambledLetters.findIndex((l, idx) =>
            l === nextLetter && !scrambleState.currentGuess.some(g => g.originalIndex === idx)
        );

        if (availableIdx !== -1) {
            scrambleState.currentGuess.push({ letter: nextLetter, originalIndex: availableIdx });
            renderScrambleUI();
            checkAutoSubmitScramble();
        }
    }


    // ==========================================
    // 3. MINDFUL RIDDLE & ZEN QUOTES
    // ==========================================

    const FALLBACK_RIDDLES = [
        {
            riddle: "I have keys, but no locks. I have space, but no room. You can enter, but you cannot go outside. What am I?",
            answer: "A Keyboard"
        },
        {
            riddle: "The more of this there is, the less you see. What is it?",
            answer: "Darkness"
        },
        {
            riddle: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
            answer: "An Echo"
        },
        {
            riddle: "What belongs to you, but other people use it much more than you do?",
            answer: "Your Name"
        },
        {
            riddle: "What has an eye, but cannot see?",
            answer: "A Needle"
        },
        {
            riddle: "What goes up and never comes down?",
            answer: "Your Age"
        }
    ];

    let currentRiddleAnswer = "";

    async function loadFreshRiddle() {
        const questionElem = document.getElementById('riddleQuestionText');
        const answerElem = document.getElementById('riddleAnswerText');
        const revealBtn = document.getElementById('btnRevealRiddleAnswer');

        if (questionElem) questionElem.textContent = 'Fetching mindful riddle...';
        if (answerElem) {
            answerElem.classList.add('hidden');
            answerElem.textContent = '';
        }
        if (revealBtn) revealBtn.textContent = '👁️ Reveal Answer';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const res = await fetch('https://riddles-api.vercel.app/random', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data.riddle) {
                    if (questionElem) questionElem.textContent = `"${data.riddle}"`;
                    currentRiddleAnswer = data.answer || "Enjoy the puzzle!";
                    return;
                }
            }
        } catch (e) {}

        // Fallback
        const item = FALLBACK_RIDDLES[Math.floor(Math.random() * FALLBACK_RIDDLES.length)];
        if (questionElem) questionElem.textContent = `"${item.riddle}"`;
        currentRiddleAnswer = item.answer;
    }

    function toggleRiddleAnswer() {
        const answerElem = document.getElementById('riddleAnswerText');
        const revealBtn = document.getElementById('btnRevealRiddleAnswer');
        if (!answerElem) return;

        if (answerElem.classList.contains('hidden')) {
            answerElem.textContent = `💡 Answer: ${currentRiddleAnswer}`;
            answerElem.classList.remove('hidden');
            if (revealBtn) revealBtn.textContent = '🙈 Hide Answer';

            // Sync riddle reveal to backend if available
            if (typeof window !== 'undefined' && window.LifeSyncAPI && typeof window.LifeSyncAPI.saveRiddleProgress === 'function') {
                window.LifeSyncAPI.saveRiddleProgress({
                    attempted: true,
                    solved: true,
                    xpEarned: 20
                }).catch(() => {});
            }
        } else {
            answerElem.classList.add('hidden');
            if (revealBtn) revealBtn.textContent = '👁️ Reveal Answer';
        }
    }


    // ==========================================
    // 4. 4-7-8 BREATHING PACER
    // ==========================================

    let breathingState = {
        isRunning: false,
        phase: 'idle', // 'inhale', 'hold', 'exhale'
        cycleCount: 0,
        intervalId: null
    };

    function startBreathingPacer() {
        const btnToggle = document.getElementById('btnToggleBreathing');
        const textInstruction = document.getElementById('breathingInstructionText');
        const counterText = document.getElementById('breathingCounterText');
        const circleOrb = document.getElementById('breathingCircleOrb');

        if (breathingState.isRunning) {
            // Stop
            breathingState.isRunning = false;
            clearInterval(breathingState.intervalId);
            if (btnToggle) btnToggle.textContent = '▶️ Begin Breathing Exercise';
            if (textInstruction) textInstruction.textContent = 'Press Start to begin 4-7-8 relaxation.';
            if (counterText) counterText.textContent = '4s Inhale • 7s Hold • 8s Exhale';
            if (circleOrb) {
                circleOrb.className = 'breathing-orb idle';
            }

            // Sync completed breathing session to backend if at least 1 cycle was performed
            if (breathingState.cycleCount > 0 && typeof window !== 'undefined' && window.LifeSyncAPI && typeof window.LifeSyncAPI.saveBreathingProgress === 'function') {
                window.LifeSyncAPI.saveBreathingProgress({
                    cyclesCompleted: breathingState.cycleCount,
                    sessionCompleted: true
                }).catch(() => {});
            }
            return;
        }

        // Start
        breathingState.isRunning = true;
        if (btnToggle) btnToggle.textContent = '⏸️ Pause';
        runBreathingCycle();
    }

    function runBreathingCycle() {
        if (!breathingState.isRunning) return;

        const textInstruction = document.getElementById('breathingInstructionText');
        const counterText = document.getElementById('breathingCounterText');
        const circleOrb = document.getElementById('breathingCircleOrb');
        const cycleDisplay = document.getElementById('breathingCyclesCompletedVal');

        // PHASE 1: Inhale (4s)
        breathingState.phase = 'inhale';
        if (textInstruction) textInstruction.textContent = '🌿 Breathe in gently through your nose...';
        if (counterText) counterText.textContent = 'Inhale for 4 seconds';
        if (circleOrb) circleOrb.className = 'breathing-orb inhale';

        let phaseTime = 4;
        breathingState.intervalId = setInterval(() => {
            phaseTime--;
            if (counterText) counterText.textContent = `Inhale... (${phaseTime}s)`;

            if (phaseTime <= 0) {
                clearInterval(breathingState.intervalId);

                // PHASE 2: Hold (7s)
                breathingState.phase = 'hold';
                if (textInstruction) textInstruction.textContent = '✨ Hold your breath gently...';
                if (circleOrb) circleOrb.className = 'breathing-orb hold';

                let holdTime = 7;
                if (counterText) counterText.textContent = `Hold... (${holdTime}s)`;

                breathingState.intervalId = setInterval(() => {
                    holdTime--;
                    if (counterText) counterText.textContent = `Hold... (${holdTime}s)`;

                    if (holdTime <= 0) {
                        clearInterval(breathingState.intervalId);

                        // PHASE 3: Exhale (8s)
                        breathingState.phase = 'exhale';
                        if (textInstruction) textInstruction.textContent = '💨 Exhale slowly through your mouth...';
                        if (circleOrb) circleOrb.className = 'breathing-orb exhale';

                        let exhaleTime = 8;
                        if (counterText) counterText.textContent = `Exhale... (${exhaleTime}s)`;

                        breathingState.intervalId = setInterval(() => {
                            exhaleTime--;
                            if (counterText) counterText.textContent = `Exhale... (${exhaleTime}s)`;

                            if (exhaleTime <= 0) {
                                clearInterval(breathingState.intervalId);
                                breathingState.cycleCount++;
                                if (cycleDisplay) cycleDisplay.textContent = `Cycles Completed: ${breathingState.cycleCount} 🧘`;

                                if (breathingState.isRunning) {
                                    runBreathingCycle(); // Loop next breath cycle
                                }
                            }
                        }, 1000);
                    }
                }, 1000);
            }
        }, 1000);
    }


    // ==========================================
    // 5. GLOBAL TAB SWITCHER & CONTROLLER
    // ==========================================

    function switchGameTab(tabName) {
        const tabBtns = document.querySelectorAll('.game-tab-btn');
        const panes = document.querySelectorAll('.game-content-pane');

        tabBtns.forEach(btn => {
            if (btn.dataset.game === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        panes.forEach(pane => {
            if (pane.id === `gamePane-${tabName}`) {
                pane.classList.remove('hidden');
                pane.classList.add('active');
            } else {
                pane.classList.add('hidden');
                pane.classList.remove('active');
            }
        });

        // Trigger initializations if not already active
        if (tabName === 'sudoku' && sudokuState.board.length === 0) {
            initSudokuGame('medium');
        } else if (tabName === 'scramble' && scrambleState.scrambledLetters.length === 0) {
            loadNextScramble();
        } else if (tabName === 'riddle' && !currentRiddleAnswer) {
            loadFreshRiddle();
        }
    }

    function setupEventListeners() {
        // Tab buttons
        const tabBtns = document.querySelectorAll('.game-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                switchGameTab(btn.dataset.game);
            });
        });

        // Sudoku controls
        const btnNewSudoku = document.getElementById('btnNewSudokuGame');
        if (btnNewSudoku) {
            btnNewSudoku.addEventListener('click', () => {
                const diffSelect = document.getElementById('sudokuDifficultySelect');
                const diff = diffSelect ? diffSelect.value : 'medium';
                initSudokuGame(diff);
            });
        }

        const btnSudokuUndo = document.getElementById('btnSudokuUndo');
        if (btnSudokuUndo) btnSudokuUndo.addEventListener('click', undoSudokuMove);

        const btnSudokuErase = document.getElementById('btnSudokuErase');
        if (btnSudokuErase) btnSudokuErase.addEventListener('click', eraseSudokuCell);

        const btnSudokuHint = document.getElementById('btnSudokuHint');
        if (btnSudokuHint) btnSudokuHint.addEventListener('click', giveSudokuHint);

        const btnSudokuCheck = document.getElementById('btnSudokuCheck');
        if (btnSudokuCheck) btnSudokuCheck.addEventListener('click', checkSudokuErrors);

        // Sudoku on-screen number pad buttons (1 to 9)
        const numPadBtns = document.querySelectorAll('.num-pad-btn');
        numPadBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.number, 10);
                if (num >= 1 && num <= 9) {
                    applySudokuNumber(num);
                }
            });
        });

        // Sudoku Physical Keyboard Support
        document.addEventListener('keydown', (e) => {
            // Only capture if sudoku game is visible and cell is selected
            const sudokuPane = document.getElementById('gamePane-sudoku');
            if (!sudokuPane || sudokuPane.classList.contains('hidden')) return;
            if (!sudokuState.selectedCell) return;

            const key = e.key;

            if (key >= '1' && key <= '9') {
                applySudokuNumber(parseInt(key, 10));
            } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
                eraseSudokuCell();
            } else if (key === 'ArrowUp') {
                e.preventDefault();
                const newR = Math.max(0, sudokuState.selectedCell.r - 1);
                selectSudokuCell(newR, sudokuState.selectedCell.c);
            } else if (key === 'ArrowDown') {
                e.preventDefault();
                const newR = Math.min(8, sudokuState.selectedCell.r + 1);
                selectSudokuCell(newR, sudokuState.selectedCell.c);
            } else if (key === 'ArrowLeft') {
                e.preventDefault();
                const newC = Math.max(0, sudokuState.selectedCell.c - 1);
                selectSudokuCell(sudokuState.selectedCell.r, newC);
            } else if (key === 'ArrowRight') {
                e.preventDefault();
                const newC = Math.min(8, sudokuState.selectedCell.c + 1);
                selectSudokuCell(sudokuState.selectedCell.r, newC);
            }
        });

        // Scramble controls
        const btnScrambleHint = document.getElementById('btnScrambleHint');
        if (btnScrambleHint) btnScrambleHint.addEventListener('click', giveScrambleHint);

        const btnScrambleClear = document.getElementById('btnScrambleClear');
        if (btnScrambleClear) btnScrambleClear.addEventListener('click', clearScrambleGuess);

        const btnScrambleNext = document.getElementById('btnScrambleNext');
        if (btnScrambleNext) btnScrambleNext.addEventListener('click', loadNextScramble);

        // Riddle controls
        const btnRevealRiddle = document.getElementById('btnRevealRiddleAnswer');
        if (btnRevealRiddle) btnRevealRiddle.addEventListener('click', toggleRiddleAnswer);

        const btnNextRiddle = document.getElementById('btnNextRiddle');
        if (btnNextRiddle) btnNextRiddle.addEventListener('click', loadFreshRiddle);

        // Breathing controls
        const btnToggleBreathing = document.getElementById('btnToggleBreathing');
        if (btnToggleBreathing) btnToggleBreathing.addEventListener('click', startBreathingPacer);
    }

    function init() {
        setupEventListeners();
        // Initialize Sudoku by default
        initSudokuGame('medium');

        // Restore user progress if backend is available
        if (typeof window !== 'undefined' && window.LifeSyncAPI && typeof window.LifeSyncAPI.getWordScrambleProgress === 'function') {
            window.LifeSyncAPI.getWordScrambleProgress().then(res => {
                if (res && res.streak !== undefined && res.streak > 0) {
                    scrambleState.streak = res.streak;
                    const streakElem = document.getElementById('scrambleStreakVal');
                    if (streakElem) streakElem.textContent = `Streak: ${scrambleState.streak} 🔥`;
                }
            }).catch(() => {});
        }
    }

    // Expose Module
    window.SoothingGamesModule = {
        init,
        initSudokuGame,
        loadNextScramble,
        loadFreshRiddle,
        startBreathingPacer,
        switchGameTab
    };

    // Auto-init on DOMContentLoaded if games container is in page
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('wellnessGamesSection')) {
                init();
            }
        });
    } else {
        if (document.getElementById('wellnessGamesSection')) {
            init();
        }
    }
})();
