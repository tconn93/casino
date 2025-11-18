const { createDeck, shuffleDeck, calculateHandValue } = require('./cardUtils');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

class BlackjackGame {
  constructor(table, mode) {
    this.table = table;
    this.mode = mode;
    this.deck = shuffleDeck(createDeck());
    this.dealerHand = [];
    this.playerHands = new Map();
    this.playerBets = new Map();
    this.playerStanding = new Set();
  }

  dealInitialCards() {
    // Deal to players
    for (const player of this.table.players) {
      const hand = [this.deck.pop(), this.deck.pop()];
      this.playerHands.set(player.socketId, hand);
    }

    // Deal to dealer
    this.dealerHand = [this.deck.pop(), this.deck.pop()];
  }

  dealerPlay() {
    while (calculateHandValue(this.dealerHand) < 17) {
      this.dealerHand.push(this.deck.pop());
    }
  }

  determineWinner(playerHand, dealerValue, playerValue) {
    if (playerValue > 21) return 'lose';
    if (dealerValue > 21) return 'win';
    if (playerValue > dealerValue) return 'win';
    if (playerValue < dealerValue) return 'lose';
    return 'push';
  }
}

async function handleAction(table, socket, data) {
  const { action, bet } = data;

  if (!table.gameState) {
    if (action === 'bet') {
      const canAfford = await Wallet.canAfford(socket.userId, bet);
      if (!canAfford) {
        throw new Error('Insufficient funds');
      }

      // Initialize game if first bet
      if (!table.gameState) {
        table.gameState = new BlackjackGame(table, table.mode);
      }

      await Wallet.debit(socket.userId, bet, 'blackjack', 'Blackjack bet');

      // Find player in table to use correct socketId
      const player = table.players.find(p => p.socketId === socket.id);
      if (player) {
        table.gameState.playerBets.set(player.socketId, bet);
      }

      // Check if all players have bet (or if vs_house mode with single player)
      if (table.mode === 'vs_house' || table.gameState.playerBets.size === table.players.length) {
        table.gameState.dealInitialCards();

        return {
          type: 'gameStarted',
          players: table.players.map(p => ({
            username: p.username,
            hand: table.gameState.playerHands.get(p.socketId),
            value: calculateHandValue(table.gameState.playerHands.get(p.socketId))
          })),
          dealerHand: [table.gameState.dealerHand[0], { hidden: true }],
          dealerValue: calculateHandValue([table.gameState.dealerHand[0]])
        };
      }

      return {
        type: 'betPlaced',
        player: socket.username,
        bet
      };
    }
    return null;
  }

  const game = table.gameState;
  const player = table.players.find(p => p.socketId === socket.id);
  if (!player) {
    throw new Error('Player not found');
  }

  const playerHand = game.playerHands.get(player.socketId);

  switch (action) {
    case 'hit':
      playerHand.push(game.deck.pop());
      const newValue = calculateHandValue(playerHand);

      if (newValue >= 21) {
        game.playerStanding.add(player.socketId);
      }

      // Check if all players are standing
      if (game.playerStanding.size === table.players.length) {
        return await endGame(table, game, socket);
      }

      return {
        type: 'cardDealt',
        player: socket.username,
        hand: playerHand,
        value: newValue,
        busted: newValue > 21
      };

    case 'stand':
      game.playerStanding.add(player.socketId);

      if (game.playerStanding.size === table.players.length) {
        return await endGame(table, game, socket);
      }

      return {
        type: 'playerStanding',
        player: socket.username
      };

    case 'double':
      const doubleBet = game.playerBets.get(player.socketId);
      const canAffordDouble = await Wallet.canAfford(socket.userId, doubleBet);
      if (!canAffordDouble) {
        throw new Error('Insufficient funds for double down');
      }

      await Wallet.debit(socket.userId, doubleBet, 'blackjack', 'Blackjack double down');
      game.playerBets.set(player.socketId, doubleBet * 2);

      playerHand.push(game.deck.pop());
      game.playerStanding.add(player.socketId);

      const doubleValue = calculateHandValue(playerHand);

      if (game.playerStanding.size === table.players.length) {
        return await endGame(table, game, socket);
      }

      return {
        type: 'doubleDown',
        player: socket.username,
        hand: playerHand,
        value: doubleValue
      };
  }
}

async function endGame(table, game, socket) {
  // Dealer plays
  game.dealerPlay();
  const dealerValue = calculateHandValue(game.dealerHand);

  const results = [];

  for (const player of table.players) {
    const playerHand = game.playerHands.get(player.socketId);
    const playerValue = calculateHandValue(playerHand);
    const bet = game.playerBets.get(player.socketId) || 0;

    const result = game.determineWinner(playerHand, dealerValue, playerValue);

    let winAmount = 0;
    if (result === 'win') {
      // Check for blackjack (pays 3:2)
      if (playerValue === 21 && playerHand.length === 2) {
        winAmount = bet * 2.5;
      } else {
        winAmount = bet * 2;
      }
      await Wallet.credit(player.userId, winAmount, 'blackjack', 'Blackjack win');
      await User.updateStats(player.userId, 'blackjack', true, bet, winAmount);
    } else if (result === 'push') {
      winAmount = bet;
      await Wallet.credit(player.userId, winAmount, 'blackjack', 'Blackjack push');
    } else {
      await User.updateStats(player.userId, 'blackjack', false, bet, 0);
    }

    results.push({
      username: player.username,
      hand: playerHand,
      value: playerValue,
      result,
      winAmount
    });
  }

  table.gameState = null;

  return {
    type: 'gameEnded',
    dealerHand: game.dealerHand,
    dealerValue,
    results
  };
}

module.exports = {
  handleAction
};
