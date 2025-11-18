const express = require('express');
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/balance', walletController.getBalance);
router.get('/transactions', walletController.getTransactions);
router.post('/add-funds', walletController.addFunds);

module.exports = router;
