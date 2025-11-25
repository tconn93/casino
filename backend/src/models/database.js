const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'casino',
  user: process.env.POSTGRES_USER || 'casino_user',
  password: process.env.POSTGRES_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Execute a query that modifies data (INSERT, UPDATE, DELETE)
const runAsync = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return {
      lastID: result.rows[0]?.id, // For INSERT queries that return id
      changes: result.rowCount,
      rows: result.rows
    };
  } finally {
    client.release();
  }
};

// Get a single row
const getAsync = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows[0];
  } finally {
    client.release();
  }
};

// Get all matching rows
const allAsync = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
};

// Execute raw SQL (for migrations, etc.)
const execAsync = async (sql) => {
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  runAsync,
  getAsync,
  allAsync,
  execAsync
};
