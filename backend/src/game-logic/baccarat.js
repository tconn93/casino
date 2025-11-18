const { createDeck, shuffleDeck } = require('./cardUtils');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

class BaccaratGame {
  constructor(table) {
    this.table = table;
    this.deck = shuffleDeck(createDeck());
    this.playerHand = [];
    this.bankerHand = [];
    this.bets = new Map(); // socketId -> { type, amount }
  }

  placeBet(socketId, betType, amount) {
    this.bets.set(socketId, { type: betType, amount });
  }

  getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.rank)) return 0;
    if (card.rank === 'A') return 1;
    return parseInt(card.rank);
  }

  calculateHandValue(hand) {
    const sum = hand.reduce((total, card) => total + this.getCardValue(card), 0);
    return sum % 10;
  }

  dealInitialCards() {
    this.playerHand = [this.deck.pop(), this.deck.pop()];
    this.bankerHand = [this.deck.pop(), this.deck.pop()];
  }

  shouldPlayerDrawThird() {
    const playerValue = this.calculateHandValue(this.playerHand);
    return playerValue <= 5;
  }

  shouldBankerDrawThird(playerThirdCard) {
    const bankerValue = this.calculateHandValue(this.bankerHand);

    if (bankerValue <= 2) return true;
    if (bankerValue >= 7) return false;

    if (!playerThirdCard) {
      return bankerValue <= 5;
    }

    const thirdValue = this.getCardValue(playerThirdCard);

    if (bankerValue === 3) return thirdValue !== 8;
    if (bankerValue === 4) return [2, 3, 4, 5, 6, 7].includes(thirdValue);
    if (bankerValue === 5) return [4, 5, 6, 7].includes(thirdValue);
    if (bankerValue === 6) return [6, 7].includes(thirdValue);

    return false;
  }

  play() {
    this.dealInitialCards();

    let playerThirdCard = null;

    // Natural check (8 or 9)
    const playerValue = this.calculateHandValue(this.playerHand);
    const bankerValue = this.calculateHandValue(this.bankerHand);

    if (playerValue >= 8 || bankerValue >= 8) {
      // Natural, no more cards
      return this.determineWinner();
    }

    // Player draws third card if needed
    if (this.shouldPlayerDrawThird()) {
      playerThirdCard = this.deck.pop();
      this.playerHand.push(playerThirdCard);
    }

    // Banker draws third card if needed
    if (this.shouldBankerDrawThird(playerThirdCard)) {
      this.bankerHand.push(this.deck.pop());
    }

    return this.determineWinner();
  }

  determineWinner() {
    const playerValue = this.calculateHandValue(this.playerHand);
    const bankerValue = this.calculateHandValue(this.bankerHand);

    if (playerValue > bankerValue) return 'player';
    if (bankerValue > playerValue) return 'banker';
    return 'tie';
  }

  calculateWinnings(socketId, winner) {
    const bet = this.bets.get(socketId);
    if (!bet) return 0;

    if (bet.type === winner) {
      if (winner === 'player') return bet.amount * 2;
      if (winner === 'banker') return bet.amount * 1.95; // 5% commission
      if (winner === 'tie') return bet.amount * 9;
    }

    if (winner === 'tie' && bet.type !== 'tie') {
      return bet.amount; // Push
    }

    return 0;
  }
}

async function handleAction(table, socket, data) {
  const { action, betType, amount } = data;

  if (action === 'placeBet') {
    if (!Wallet.canAfford(socket.userId, amount)) {
      throw new Error('Insufficient funds');
    }

    if (!['player', 'banker', 'tie'].includes(betType)) {
      throw new Error('Invalid bet type');
    }

    if (!table.gameState) {
      table.gameState = new BaccaratGame(table);
    }

    Wallet.debit(socket.userId, amount, 'baccarat', `Baccarat bet on ${betType}`);
    table.gameState.placeBet(socket.id, betType, amount);

    return {
      type: 'betPlaced',
      player: socket.username,
      betType,
      amount
    };
  }

  if (action === 'deal') {
    if (!table.gameState || table.gameState.bets.size === 0) {
      throw new Error('No bets placed');
    }

    const game = table.gameState;
    const winner = game.play();

    // Process winnings for all players
    const playerResults = [];
    for (const player of table.players) {
      if (game.bets.has(player.socketId)) {
        const winAmount = game.calculateWinnings(player.socketId, winner);
        const bet = game.bets.get(player.socketId);

        if (winAmount > bet.amount) {
          Wallet.credit(player.userId, winAmount, 'baccarat', 'Baccarat win');
          User.updateStats(player.userId, 'baccarat', true, bet.amount, winAmount);
        } else if (winAmount === bet.amount) {
          // Push
          Wallet.credit(player.userId, winAmount, 'baccarat', 'Baccarat push');
        } else {
          User.updateStats(player.userId, 'baccarat', false, bet.amount, 0);
        }

        playerResults.push({
          username: player.username,
          bet: bet,
          winAmount,
          netProfit: winAmount - bet.amount
        });
      }
    }

    const playerValue = game.calculateHandValue(game.playerHand);
    const bankerValue = game.calculateHandValue(game.bankerHand);

    table.gameState = null;

    return {
      type: 'gameComplete',
      winner,
      playerHand: game.playerHand,
      bankerHand: game.bankerHand,
      playerValue,
      bankerValue,
      playerResults
    };
  }

  return null;
}

module.exports = {
  handleAction
};
