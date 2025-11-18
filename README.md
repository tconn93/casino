# Casino

Casino is a full-stack web application where users can play casino games with fake money, either against the house or with friends.

## Features

- **5 Casino Games:** Texas Hold'em Poker, Blackjack, Roulette, Craps, and Baccarat
- **User Authentication:** Secure JWT-based authentication
- **Virtual Wallet:** Each user starts with $1000 fake money
- **Game Modes:** Play against the house or multiplayer with friends
- **Real-time Gameplay:** Socket.io for instant game updates
- **Statistics Tracking:** Track wins, losses, and earnings for each game

## Tech Stack

- **Backend:** Express.js, Socket.io, SQLite (better-sqlite3), JWT
- **Frontend:** React, Vite, React Router, Socket.io-client

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd casino
```

2. Install backend dependencies
```bash
cd backend
npm install
cp .env.example .env
# Edit .env and set a secure JWT_SECRET
npm run init-db
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

### Running the Application

1. Start the backend server (from backend/ directory):
```bash
npm run dev
```

2. Start the frontend (from frontend/ directory):
```bash
npm run dev
```

3. Open http://localhost:5173 in your browser

## How to Play

1. Register a new account or login
2. You'll receive $1000 in your virtual wallet
3. Select a game from the dashboard
4. Place your bets and play!
5. Add more funds anytime from the dashboard

## Game Rules

- **Blackjack:** Get as close to 21 as possible without going over
- **Roulette:** Bet on numbers, colors, or ranges
- **Poker:** Texas Hold'em with standard betting rounds
- **Craps:** Dice game with various betting options
- **Baccarat:** Bet on Player, Banker, or Tie

## License

MIT License - See LICENSE file for details

