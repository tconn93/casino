require('dotenv').config();
const { Client } = require('pg');

async function createDatabase() {
  // Connect to the default 'postgres' database to create our database
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: 'postgres', // Connect to default postgres database
    user: process.env.POSTGRES_USER || 'casino_user',
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');

    const dbName = process.env.POSTGRES_DB || 'casino';

    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      console.log(`Creating database "${dbName}"...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully`);
    } else {
      console.log(`Database "${dbName}" already exists`);
    }
  } catch (error) {
    console.error('Error creating database:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createDatabase()
  .then(() => {
    console.log('Database setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create database:', error);
    process.exit(1);
  });
