const { runAsync, getAsync, allAsync } = require('./database');
const bcrypt = require('bcryptjs');

class User {
  static async create(username, password, email = null) {
    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
      const result = await runAsync(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [username, hashedPassword, email]
      );

      // Create wallet for new user with initial balance
      await runAsync(
        'INSERT INTO wallets (user_id, balance) VALUES (?, ?)',
        [result.lastID, 1000.0]
      );

      return this.findById(result.lastID);
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    const query = `
      SELECT u.id, u.username, u.email, u.created_at, w.balance
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.id = ?
    `;
    return getAsync(query, [id]);
  }

  static async findByUsername(username) {
    return getAsync('SELECT * FROM users WHERE username = ?', [username]);
  }

  static verifyPassword(password, hashedPassword) {
    return bcrypt.compareSync(password, hashedPassword);
  }

  static async getStats(userId) {
    const query = `
      SELECT game_type, total_games, games_won, games_lost, total_wagered, total_winnings
      FROM game_stats
      WHERE user_id = ?
    `;
    return allAsync(query, [userId]);
  }

  static async updateStats(userId, gameType, won, wager, winnings) {
    const query = `
      INSERT INTO game_stats (user_id, game_type, total_games, games_won, games_lost, total_wagered, total_winnings)
      VALUES (?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(user_id, game_type) DO UPDATE SET
        total_games = total_games + 1,
        games_won = games_won + ?,
        games_lost = games_lost + ?,
        total_wagered = total_wagered + ?,
        total_winnings = total_winnings + ?
    `;
    return runAsync(query, [
      userId, gameType, won ? 1 : 0, won ? 0 : 1, wager, winnings,
      won ? 1 : 0, won ? 0 : 1, wager, winnings
    ]);
  }
}

module.exports = User;
