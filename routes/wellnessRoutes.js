const express = require('express');
const router = express.Router();
const wellnessController = require('../controllers/wellnessController');
const gamesController = require('../controllers/wellnessGamesController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// --- Mindful Games & Break Progress Endpoints ---
router.get('/games/summary', gamesController.getWellnessGamesSummary);

// Sudoku
router.get('/sudoku', gamesController.getSudokuProgress);
router.post('/sudoku/progress', gamesController.saveSudokuProgress);
router.post('/sudoku/complete', gamesController.completeSudoku);

// Word Scramble
router.get('/word-scramble/progress', gamesController.getWordScrambleProgress);
router.post('/word-scramble/progress', gamesController.saveWordScrambleProgress);

// Mindful Riddle
router.get('/riddle/progress', gamesController.getRiddleProgress);
router.post('/riddle/progress', gamesController.saveRiddleProgress);

// 4-7-8 Breathing Pacer
router.get('/breathing/progress', gamesController.getBreathingProgress);
router.post('/breathing/progress', gamesController.saveBreathingProgress);

// --- Daily Mood Check-In Endpoints ---
router.get('/summary', wellnessController.getWellnessSummary);
router.get('/', wellnessController.getWellnessRecords);
router.get('/:id', wellnessController.getWellnessById);
router.post('/', wellnessController.createWellnessRecord);
router.delete('/:id', wellnessController.deleteWellnessRecord);

module.exports = router;
