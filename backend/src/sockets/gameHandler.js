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
  // Helper function to clean up empty tables
  const cleanupEmptyTable = (gameType, tableId) => {
    const table = gameTables[gameType].get(tableId);

    // Only clean up if table is empty
    if (!table || table.players.length > 0) {
      return false;
    }

    // Check if there are other tables for this game type
    const otherTablesExist = gameTables[gameType].size > 1;

    if (otherTablesExist) {
      // Delete the empty table
      gameTables[gameType].delete(tableId);

      // Notify all clients that the table was removed
      io.emit('lobbyTableRemoved', {
        gameType,
        tableId
      });

      console.log(`Cleaned up empty table: ${tableId} (${gameType})`);
      return true;
    }

    // Keep the last table even if empty
    return false;
  };

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

    // Get lobby information for a specific game type
    socket.on('getLobby', ({ gameType }) => {
      try {
        if (!gameTables[gameType]) {
          socket.emit('error', { message: 'Invalid game type' });
          return;
        }

        const tables = Array.from(gameTables[gameType].values()).map(table => ({
          tableId: table.tableId,
          tableName: table.tableName,
          gameType: table.gameType,
          playerCount: table.players.length,
          maxPlayers: table.maxPlayers,
          availableSeats: table.seats.filter(seat => seat === null).length,
          seats: table.seats.map(seat => seat ? {
            username: seat.username,
            balance: seat.balance
          } : null),
          createdAt: table.createdAt
        }));

        socket.emit('lobbyUpdate', { gameType, tables });
      } catch (error) {
        console.error('Error getting lobby:', error);
        socket.emit('error', { message: 'Failed to get lobby information' });
      }
    });

    // Create a new table
    socket.on('createTable', ({ gameType, tableName }) => {
      try {
        if (!gameTables[gameType]) {
          socket.emit('error', { message: 'Invalid game type' });
          return;
        }

        const tableId = `${gameType}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const table = createTable(gameType, tableId, 'multiplayer', tableName);
        gameTables[gameType].set(tableId, table);

        socket.emit('tableCreated', {
          tableId: table.tableId,
          tableName: table.tableName,
          gameType: table.gameType,
          maxPlayers: table.maxPlayers
        });

        // Notify all clients in the lobby about the new table
        io.emit('lobbyTableAdded', {
          gameType,
          table: {
            tableId: table.tableId,
            tableName: table.tableName,
            gameType: table.gameType,
            playerCount: 0,
            maxPlayers: table.maxPlayers,
            availableSeats: table.maxPlayers,
            seats: table.seats.map(() => null),
            createdAt: table.createdAt
          }
        });
      } catch (error) {
        console.error('Error creating table:', error);
        socket.emit('error', { message: 'Failed to create table' });
      }
    });

    // Handle user joining a game table with seat selection
    socket.on('joinTable', async ({ gameType, tableId, mode, seatNumber }) => {
      try {
        const table = gameTables[gameType].get(tableId) || createTable(gameType, tableId, mode);

        // Get player balance
        const balance = await Wallet.getBalance(socket.userId);

        // If seat number specified, try to take that seat
        if (seatNumber !== undefined && seatNumber !== null) {
          if (seatNumber < 0 || seatNumber >= table.maxPlayers) {
            socket.emit('error', { message: 'Invalid seat number' });
            return;
          }
          if (table.seats[seatNumber] !== null) {
            socket.emit('error', { message: 'Seat is already taken' });
            return;
          }
        } else {
          // Auto-assign to first available seat
          seatNumber = table.seats.findIndex(seat => seat === null);
          if (seatNumber === -1) {
            socket.emit('error', { message: 'Table is full' });
            return;
          }
        }

        const playerInfo = {
          socketId: socket.id,
          userId: socket.userId,
          username: socket.username,
          balance: balance,
          seatNumber: seatNumber
        };

        // Add player to seat
        table.seats[seatNumber] = playerInfo;

        // Also update legacy players array for backward compatibility
        table.players.push(playerInfo);

        socket.join(tableId);
        socket.currentTable = tableId;
        socket.currentGame = gameType;
        socket.currentSeat = seatNumber;

        gameTables[gameType].set(tableId, table);

        // Notify all players at the table
        io.to(tableId).emit('tableUpdate', {
          players: table.players.map(p => ({
            username: p.username,
            balance: p.balance,
            seatNumber: p.seatNumber
          })),
          seats: table.seats.map(seat => seat ? {
            username: seat.username,
            balance: seat.balance
          } : null),
          gameState: table.gameState
        });

        // Notify lobby about updated table
        io.emit('lobbyTableUpdated', {
          gameType,
          tableId,
          playerCount: table.players.length,
          availableSeats: table.seats.filter(seat => seat === null).length,
          seats: table.seats.map(seat => seat ? {
            username: seat.username,
            balance: seat.balance
          } : null)
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
          // Remove player from seat
          if (socket.currentSeat !== undefined && socket.currentSeat !== null) {
            table.seats[socket.currentSeat] = null;
          }
          // Remove from players array
          table.players = table.players.filter(p => p.socketId !== socket.id);

          io.to(socket.currentTable).emit('tableUpdate', {
            players: table.players.map(p => ({
              username: p.username,
              balance: p.balance,
              seatNumber: p.seatNumber
            })),
            seats: table.seats.map(seat => seat ? {
              username: seat.username,
              balance: seat.balance
            } : null),
            gameState: table.gameState
          });

          // Notify lobby about updated table
          io.emit('lobbyTableUpdated', {
            gameType: socket.currentGame,
            tableId: socket.currentTable,
            playerCount: table.players.length,
            availableSeats: table.seats.filter(seat => seat === null).length,
            seats: table.seats.map(seat => seat ? {
              username: seat.username,
              balance: seat.balance
            } : null)
          });

          // Clean up empty table if there are other tables available
          cleanupEmptyTable(socket.currentGame, socket.currentTable);
        }
        socket.leave(socket.currentTable);
        socket.currentTable = null;
        socket.currentGame = null;
        socket.currentSeat = null;
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
          // Remove player from seat
          if (socket.currentSeat !== undefined && socket.currentSeat !== null) {
            table.seats[socket.currentSeat] = null;
          }
          // Remove from players array
          table.players = table.players.filter(p => p.socketId !== socket.id);

          io.to(socket.currentTable).emit('tableUpdate', {
            players: table.players.map(p => ({
              username: p.username,
              balance: p.balance,
              seatNumber: p.seatNumber
            })),
            seats: table.seats.map(seat => seat ? {
              username: seat.username,
              balance: seat.balance
            } : null),
            gameState: table.gameState
          });

          // Notify lobby about updated table
          io.emit('lobbyTableUpdated', {
            gameType: socket.currentGame,
            tableId: socket.currentTable,
            playerCount: table.players.length,
            availableSeats: table.seats.filter(seat => seat === null).length,
            seats: table.seats.map(seat => seat ? {
              username: seat.username,
              balance: seat.balance
            } : null)
          });

          // Clean up empty table if there are other tables available
          cleanupEmptyTable(socket.currentGame, socket.currentTable);
        }
      }
    });
  });
};

function createTable(gameType, tableId, mode, tableName = '') {
  const tableConfig = {
    poker: { maxPlayers: 10, minPlayers: 2 },
    blackjack: { maxPlayers: 6, minPlayers: 1 },
    roulette: { maxPlayers: 7, minPlayers: 1 },
    craps: { maxPlayers: 12, minPlayers: 1 },
    baccarat: { maxPlayers: 7, minPlayers: 1 }
  };

  const config = tableConfig[gameType];
  const seats = Array(config.maxPlayers).fill(null); // Initialize all seats as empty

  return {
    tableId,
    tableName: tableName || `Table ${tableId.substring(0, 8)}`,
    gameType,
    mode, // 'multiplayer' or 'vs_house'
    players: [], // Legacy support - keep for compatibility
    seats, // New seat-based system
    maxPlayers: config.maxPlayers,
    minPlayers: config.minPlayers,
    gameState: null,
    createdAt: Date.now()
  };
}
