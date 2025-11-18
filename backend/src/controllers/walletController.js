const Wallet = require('../models/Wallet');

const walletController = {
  getBalance: async (req, res) => {
    try {
      const balance = await Wallet.getBalance(req.user.id);
      res.json({ balance });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getTransactions: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const transactions = await Wallet.getTransactions(req.user.id, limit);
      res.json({ transactions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  addFunds: async (req, res) => {
    try {
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      await Wallet.credit(req.user.id, amount, null, 'Funds added');
      const balance = await Wallet.getBalance(req.user.id);

      res.json({ balance });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = walletController;
