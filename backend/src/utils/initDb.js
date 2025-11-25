require('dotenv').config();
const { pool } = require('../models/database');

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    console.log('Initializing PostgreSQL database...');

    // Drop existing tables (in reverse order of dependencies)
    await client.query('DROP TABLE IF EXISTS transactions CASCADE');
    await client.query('DROP TABLE IF EXISTS game_stats CASCADE');
    await client.query('DROP TABLE IF EXISTS wallets CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    // Create users table
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created users table');

    // Create wallets table
    await client.query(`
      CREATE TABLE wallets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        balance DECIMAL(10, 2) DEFAULT 1000.00,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Created wallets table');

    // Create game_stats table
    await client.query(`
      CREATE TABLE game_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        game_type VARCHAR(50) NOT NULL,
        total_games INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        games_lost INTEGER DEFAULT 0,
        total_wagered DECIMAL(10, 2) DEFAULT 0,
        total_winnings DECIMAL(10, 2) DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, game_type)
      )
    `);
    console.log('Created game_stats table');

    // Create transactions table
    await client.query(`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        type VARCHAR(50) NOT NULL,
        game_type VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Created transactions table');

    // Create indexes for better query performance
    await client.query('CREATE INDEX idx_wallets_user_id ON wallets(user_id)');
    await client.query('CREATE INDEX idx_game_stats_user_id ON game_stats(user_id)');
    await client.query('CREATE INDEX idx_transactions_user_id ON transactions(user_id)');
    await client.query('CREATE INDEX idx_transactions_created_at ON transactions(created_at)');
    console.log('Created indexes');

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

initializeDatabase();
