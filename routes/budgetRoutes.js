const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/summary', budgetController.getBudgetSummary);
router.get('/settings', budgetController.getBudgetSettings);
router.put('/settings', budgetController.updateBudgetSettings);
router.get('/', budgetController.getTransactions);
router.get('/:id', budgetController.getTransactionById);
router.post('/', budgetController.createTransaction);
router.put('/:id', budgetController.updateTransaction);
router.delete('/:id', budgetController.deleteTransaction);

module.exports = router;
