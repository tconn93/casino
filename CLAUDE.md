# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Casino is a full-stack web application that enables users to play casino games with fake money. Users can play against the house or compete with friends in multiplayer games. The app includes 5 casino games: Texas Hold'em Poker, Blackjack, Roulette, Craps, and Baccarat.

## Technology Stack

**Backend:**
- Express.js - REST API and WebSocket server
- Socket.io - Real-time game communication
- better-sqlite3 - SQLite database for user data, wallets, stats
- JWT - User authentication
- bcryptjs - Password hashing

**Frontend:**
- React 18 - UI framework
- Vite - Build tool and dev server
- React Router - Client-side routing
- Socket.io-client - Real-time game updates

## Project Structure

```
casino/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Request handlers (auth, wallet)
│   │   ├── game-logic/       # Game engine for each casino game
│   │   ├── middleware/       # Auth middleware
│   │   ├── models/          # Database models (User, Wallet)
│   │   ├── routes/          # API routes
│   │   ├── sockets/         # Socket.io game handler
│   │   ├── utils/           # Database initialization
│   │   └── server.js        # Express server entry point
│   ├── package.json
│   └── .env                 # Environment configuration
└── frontend/
    ├── src/
    │   ├── components/      # Reusable components (Card, GameLayout)
    │   ├── context/         # React context (AuthContext)
    │   ├── pages/           # Page components (games, dashboard)
    │   ├── services/        # API and Socket services
    │   ├── App.jsx          # Main app with routing
    │   └── main.jsx         # React entry point
    ├── package.json
    └── index.html
```

## Development Commands

### First-Time Setup

```bash
# Install backend dependencies
cd backend
npm install

# Create and initialize database
cp .env.example .env
# Edit .env and set JWT_SECRET to a secure random string
npm run init-db

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the Application

**Backend (from backend/ directory):**
```bash
npm run dev          # Start with nodemon (auto-reload)
npm start            # Start without auto-reload
npm run init-db      # Reinitialize database (WARNING: deletes all data)
```

**Frontend (from frontend/ directory):**
```bash
npm run dev          # Start dev server on http://localhost:5173
npm run build        # Production build
npm run preview      # Preview production build
```

**Running both servers:** Open two terminal windows and run backend and frontend dev servers simultaneously.

## Architecture

### Authentication Flow

1. User registers/logs in via REST API (`/api/auth/register` or `/api/auth/login`)
2. Backend generates JWT token and creates wallet with initial balance ($1000)
3. Frontend stores token in localStorage and includes it in API requests
4. For Socket.io connections, token is passed in handshake auth

### Game Flow

1. User selects game from dashboard, navigates to game page with unique tableId
2. Frontend connects to Socket.io and joins table with `joinTable` event
3. User places bets via `gameAction` socket events
4. Backend game logic processes actions, updates balances, and emits `gameUpdate` events
5. Frontend updates UI based on game updates
6. When game ends, backend credits/debits wallets and updates user stats

### Database Schema

**users:** id, username, password (hashed), email, created_at
**wallets:** id, user_id, balance
**game_stats:** id, user_id, game_type, total_games, games_won, games_lost, total_wagered, total_winnings
**transactions:** id, user_id, amount, type, game_type, description, created_at

### Game Logic Architecture

Each game has its own module in `backend/src/game-logic/`:
- **poker.js** - Texas Hold'em with betting rounds, hand evaluation
- **blackjack.js** - Hit/stand/double down vs dealer
- **roulette.js** - Multiple bet types (color, odd/even, numbers, dozens)
- **craps.js** - Pass line, field bets, point system
- **baccarat.js** - Player/banker/tie bets with traditional drawing rules

All games support:
- **vs_house mode:** Single player against dealer/house
- **multiplayer mode:** Multiple players at same table (Poker requires this)

### Real-time Communication

Socket.io events:
- `joinTable` - Join a game table
- `leaveTable` - Leave current table
- `gameAction` - Perform game action (bet, hit, stand, etc.)
- `tableUpdate` - Players joined/left table
- `gameUpdate` - Game state changed
- `error` - Error occurred

### State Management

- **Backend:** Game state stored in-memory in gameTables Map, persisted to DB on game completion
- **Frontend:** Auth state in React Context, game state in component state, synced via Socket.io

## Key Files to Understand

- `backend/src/server.js` - Express server setup, routes registration
- `backend/src/sockets/gameHandler.js` - Socket.io event handling, table management
- `backend/src/game-logic/*` - Individual game implementations
- `backend/src/models/User.js` - User CRUD, stats updates
- `backend/src/models/Wallet.js` - Balance management, transactions
- `frontend/src/context/AuthContext.jsx` - Authentication state and methods
- `frontend/src/services/socket.js` - Socket.io connection wrapper
- `frontend/src/pages/*Game.jsx` - Individual game UI components

## Common Development Tasks

### Adding a new game

1. Create game logic in `backend/src/game-logic/newgame.js` with `handleAction` export
2. Import and add to gameHandler.js switch statement
3. Create UI component in `frontend/src/pages/NewGame.jsx`
4. Add route in `frontend/src/App.jsx`
5. Add game card to Dashboard.jsx

### Modifying game rules

Edit the corresponding file in `backend/src/game-logic/`

### Adding API endpoints

1. Create controller in `backend/src/controllers/`
2. Create route file in `backend/src/routes/`
3. Register route in `backend/src/server.js`

### Database changes

Modify `backend/src/utils/initDb.js` and run `npm run init-db` (WARNING: deletes all data)
