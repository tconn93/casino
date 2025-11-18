const { runAsync, getAsync, allAsync } = require('./database');

class Wallet {
  static async getBalance(userId) {
    const result = await getAsync('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
    return result ? result.balance : 0;
  }

  static async updateBalance(userId, amount) {
    await runAsync('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, userId]);
    return this.getBalance(userId);
  }

  static async canAfford(userId, amount) {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  static async addTransaction(userId, amount, type, gameType = null, description = null) {
    return runAsync(
      'INSERT INTO transactions (user_id, amount, type, game_type, description) VALUES (?, ?, ?, ?, ?)',
      [userId, amount, type, gameType, description]
    );
  }

  static async getTransactions(userId, limit = 50) {
    const query = `
      SELECT * FROM transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return allAsync(query, [userId, limit]);
  }

  static async debit(userId, amount, gameType, description) {
    const canAfford = await this.canAfford(userId, amount);
    if (!canAfford) {
      throw new Error('Insufficient funds');
    }
    await this.updateBalance(userId, -amount);
    await this.addTransaction(userId, -amount, 'debit', gameType, description);
  }

  static async credit(userId, amount, gameType, description) {
    await this.updateBalance(userId, amount);
    await this.addTransaction(userId, amount, 'credit', gameType, description);
  }
}

module.exports = Wallet;
