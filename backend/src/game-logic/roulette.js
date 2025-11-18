const Wallet = require('../models/Wallet');
const User = require('../models/User');

const ROULETTE_NUMBERS = [
  { number: 0, color: 'green' },
  { number: 1, color: 'red' }, { number: 2, color: 'black' }, { number: 3, color: 'red' },
  { number: 4, color: 'black' }, { number: 5, color: 'red' }, { number: 6, color: 'black' },
  { number: 7, color: 'red' }, { number: 8, color: 'black' }, { number: 9, color: 'red' },
  { number: 10, color: 'black' }, { number: 11, color: 'black' }, { number: 12, color: 'red' },
  { number: 13, color: 'black' }, { number: 14, color: 'red' }, { number: 15, color: 'black' },
  { number: 16, color: 'red' }, { number: 17, color: 'black' }, { number: 18, color: 'red' },
  { number: 19, color: 'red' }, { number: 20, color: 'black' }, { number: 21, color: 'red' },
  { number: 22, color: 'black' }, { number: 23, color: 'red' }, { number: 24, color: 'black' },
  { number: 25, color: 'red' }, { number: 26, color: 'black' }, { number: 27, color: 'red' },
  { number: 28, color: 'black' }, { number: 29, color: 'black' }, { number: 30, color: 'red' },
  { number: 31, color: 'black' }, { number: 32, color: 'red' }, { number: 33, color: 'black' },
  { number: 34, color: 'red' }, { number: 35, color: 'black' }, { number: 36, color: 'red' }
];

class RouletteGame {
  constructor() {
    this.bets = new Map(); // socketId -> array of bets
    this.spinResult = null;
  }

  placeBet(socketId, betType, value, amount) {
    if (!this.bets.has(socketId)) {
      this.bets.set(socketId, []);
    }
    this.bets.get(socketId).push({ type: betType, value, amount });
  }

  spin() {
    const randomIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
    this.spinResult = ROULETTE_NUMBERS[randomIndex];
    return this.spinResult;
  }

  checkBet(bet, result) {
    switch (bet.type) {
      case 'number':
        return bet.value === result.number;
      case 'color':
        return bet.value === result.color;
      case 'odd':
        return result.number !== 0 && result.number % 2 === 1;
      case 'even':
        return result.number !== 0 && result.number % 2 === 0;
      case 'low':
        return result.number >= 1 && result.number <= 18;
      case 'high':
        return result.number >= 19 && result.number <= 36;
      case 'dozen1':
        return result.number >= 1 && result.number <= 12;
      case 'dozen2':
        return result.number >= 13 && result.number <= 24;
      case 'dozen3':
        return result.number >= 25 && result.number <= 36;
      default:
        return false;
    }
  }

  getPayoutMultiplier(betType) {
    const payouts = {
      'number': 35,
      'color': 1,
      'odd': 1,
      'even': 1,
      'low': 1,
      'high': 1,
      'dozen1': 2,
      'dozen2': 2,
      'dozen3': 2
    };
    return payouts[betType] || 0;
  }

  calculateWinnings(socketId) {
    if (!this.bets.has(socketId)) return 0;

    let totalWin = 0;
    for (const bet of this.bets.get(socketId)) {
      if (this.checkBet(bet, this.spinResult)) {
        totalWin += bet.amount * (this.getPayoutMultiplier(bet.type) + 1);
      }
    }
    return totalWin;
  }
}

async function handleAction(table, socket, data) {
  const { action, betType, value, amount } = data;

  if (action === 'placeBet') {
    if (!Wallet.canAfford(socket.userId, amount)) {
      throw new Error('Insufficient funds');
    }

    if (!table.gameState) {
      table.gameState = new RouletteGame();
    }

    Wallet.debit(socket.userId, amount, 'roulette', `Roulette bet on ${betType}`);
    table.gameState.placeBet(socket.id, betType, value, amount);

    return {
      type: 'betPlaced',
      player: socket.username,
      betType,
      value,
      amount
    };
  }

  if (action === 'spin') {
    if (!table.gameState || table.gameState.bets.size === 0) {
      throw new Error('No bets placed');
    }

    const game = table.gameState;
    const result = game.spin();

    // Calculate winnings for all players
    const playerResults = [];
    for (const player of table.players) {
      if (game.bets.has(player.socketId)) {
        const winAmount = game.calculateWinnings(player.socketId);
        const totalBet = game.bets.get(player.socketId).reduce((sum, bet) => sum + bet.amount, 0);

        if (winAmount > 0) {
          Wallet.credit(player.userId, winAmount, 'roulette', 'Roulette win');
          User.updateStats(player.userId, 'roulette', true, totalBet, winAmount);
        } else {
          User.updateStats(player.userId, 'roulette', false, totalBet, 0);
        }

        playerResults.push({
          username: player.username,
          bets: game.bets.get(player.socketId),
          winAmount,
          netProfit: winAmount - totalBet
        });
      }
    }

    table.gameState = null;

    return {
      type: 'spinComplete',
      result: {
        number: result.number,
        color: result.color
      },
      playerResults
    };
  }

  return null;
}

module.exports = {
  handleAction
};
