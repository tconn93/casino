const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const poker = require('../game-logic/poker');
const blackjack = require('../game-logic/blackjack');
const roulette = require('../game-logic/roulette');
const craps = require('../game-logic/craps');
const baccarat = require('../game-logic/baccarat');

// Store active game tables
const gameTables = {
  poker: new Map(),
  blackjack: new Map(),
  roulette: new Map(),
  craps: new Map(),
  baccarat: new Map()
};

module.exports = (io) => {
  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Handle user joining a game table
    socket.on('joinTable', async ({ gameType, tableId, mode }) => {
      try {
        const table = gameTables[gameType].get(tableId) || createTable(gameType, tableId, mode);

        if (table.players.length >= table.maxPlayers) {
          socket.emit('error', { message: 'Table is full' });
          return;
        }

        // Get player balance
        const balance = await Wallet.getBalance(socket.userId);

        // Add player to table
        table.players.push({
          socketId: socket.id,
          userId: socket.userId,
          username: socket.username,
          balance: balance
        });

        socket.join(tableId);
        socket.currentTable = tableId;
        socket.currentGame = gameType;

        gameTables[gameType].set(tableId, table);

        // Notify all players at the table
        io.to(tableId).emit('tableUpdate', {
          players: table.players.map(p => ({ username: p.username, balance: p.balance })),
          gameState: table.gameState
        });
      } catch (error) {
        console.error('Error joining table:', error);
        socket.emit('error', { message: 'Failed to join table' });
      }
    });

    // Handle leaving a table
    socket.on('leaveTable', () => {
      if (socket.currentTable && socket.currentGame) {
        const table = gameTables[socket.currentGame].get(socket.currentTable);
        if (table) {
          table.players = table.players.filter(p => p.socketId !== socket.id);
          io.to(socket.currentTable).emit('tableUpdate', {
            players: table.players.map(p => ({ username: p.username, balance: p.balance })),
            gameState: table.gameState
          });
        }
        socket.leave(socket.currentTable);
        socket.currentTable = null;
        socket.currentGame = null;
      }
    });

    // Game-specific actions
    socket.on('gameAction', async (data) => {
      if (!socket.currentTable || !socket.currentGame) {
        socket.emit('error', { message: 'Not in a game' });
        return;
      }

      const table = gameTables[socket.currentGame].get(socket.currentTable);
      if (!table) {
        socket.emit('error', { message: 'Table not found' });
        return;
      }

      try {
        let result;
        switch (socket.currentGame) {
          case 'poker':
            result = await poker.handleAction(table, socket, data);
            break;
          case 'blackjack':
            result = await blackjack.handleAction(table, socket, data);
            break;
          case 'roulette':
            result = await roulette.handleAction(table, socket, data);
            break;
          case 'craps':
            result = await craps.handleAction(table, socket, data);
            break;
          case 'baccarat':
            result = await baccarat.handleAction(table, socket, data);
            break;
        }

        if (result) {
          io.to(socket.currentTable).emit('gameUpdate', result);
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username}`);
      if (socket.currentTable && socket.currentGame) {
        const table = gameTables[socket.currentGame].get(socket.currentTable);
        if (table) {
          table.players = table.players.filter(p => p.socketId !== socket.id);
          io.to(socket.currentTable).emit('tableUpdate', {
            players: table.players.map(p => ({ username: p.username, balance: p.balance })),
            gameState: table.gameState
          });
        }
      }
    });
  });
};

function createTable(gameType, tableId, mode) {
  const tableConfig = {
    poker: { maxPlayers: 8, minPlayers: 2 },
    blackjack: { maxPlayers: 5, minPlayers: 1 },
    roulette: { maxPlayers: 10, minPlayers: 1 },
    craps: { maxPlayers: 10, minPlayers: 1 },
    baccarat: { maxPlayers: 10, minPlayers: 1 }
  };

  return {
    tableId,
    gameType,
    mode, // 'multiplayer' or 'vs_house'
    players: [],
    maxPlayers: tableConfig[gameType].maxPlayers,
    minPlayers: tableConfig[gameType].minPlayers,
    gameState: null,
    createdAt: Date.now()
  };
}
