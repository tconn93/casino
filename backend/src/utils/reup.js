require('dotenv').config();
const { pool } = require('../models/database');

async function reupBalance() {
  const client = await pool.connect();

  try {
    console.log('Updating wallet balance...');

    await client.query('UPDATE wallets SET balance = 10000 WHERE id = 1');

    console.log('Wallet balance updated successfully');
  } catch (error) {
    console.error('Error updating wallet balance:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

reupBalance();
