const { runAsync, getAsync, allAsync } = require('./database');
const bcrypt = require('bcryptjs');

class User {
  static async create(username, password, email = null) {
    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
      const result = await runAsync(
        'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id',
        [username, hashedPassword, email]
      );

      const userId = result.rows[0].id;

      // Create wallet for new user with initial balance
      await runAsync(
        'INSERT INTO wallets (user_id, balance) VALUES ($1, $2)',
        [userId, 1000.0]
      );

      return this.findById(userId);
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    const query = `
      SELECT u.id, u.username, u.email, u.created_at, w.balance
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.id = $1
    `;
    const user = await getAsync(query, [id]);
    if (user && user.balance !== null) {
      user.balance = parseFloat(user.balance);
    }
    return user;
  }

  static async findByUsername(username) {
    return getAsync('SELECT * FROM users WHERE username = $1', [username]);
  }

  static verifyPassword(password, hashedPassword) {
    return bcrypt.compareSync(password, hashedPassword);
  }

  static async getStats(userId) {
    const query = `
      SELECT game_type, total_games, games_won, games_lost, total_wagered, total_winnings
      FROM game_stats
      WHERE user_id = $1
    `;
    const stats = await allAsync(query, [userId]);
    // Convert numeric strings to numbers
    return stats.map(stat => ({
      ...stat,
      total_wagered: parseFloat(stat.total_wagered),
      total_winnings: parseFloat(stat.total_winnings)
    }));
  }

  static async updateStats(userId, gameType, won, wager, winnings) {
    const query = `
      INSERT INTO game_stats (user_id, game_type, total_games, games_won, games_lost, total_wagered, total_winnings)
      VALUES ($1, $2, 1, $3, $4, $5, $6)
      ON CONFLICT(user_id, game_type) DO UPDATE SET
        total_games = game_stats.total_games + 1,
        games_won = game_stats.games_won + $7,
        games_lost = game_stats.games_lost + $8,
        total_wagered = game_stats.total_wagered + $9,
        total_winnings = game_stats.total_winnings + $10
    `;
    return runAsync(query, [
      userId, gameType, won ? 1 : 0, won ? 0 : 1, wager, winnings,
      won ? 1 : 0, won ? 0 : 1, wager, winnings
    ]);
  }
}

module.exports = User;
