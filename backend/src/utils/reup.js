const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../casino.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  db.exec(`
   UPDATE WALLETS SET BALANCE = 10000 WHERE ID = 1;
  `, (err) => {
    if (err) {
      console.error('Error creating tables:', err.message);
      process.exit(1);
    } else {
      console.log('Database initialized successfully');
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        }
        process.exit(0);
      });
    }
  });
});