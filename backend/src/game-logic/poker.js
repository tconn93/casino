const { createDeck, shuffleDeck, getCardValue } = require('./cardUtils');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

class PokerGame {
  constructor() {
    this.deck = shuffleDeck(createDeck());
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.playerHands = new Map();
    this.playerBets = new Map();
    this.playerFolded = new Set();
    this.currentPlayerIndex = 0;
    this.round = 'preflop'; // preflop, flop, turn, river, showdown
    this.dealerIndex = 0;
  }

  dealHands(players) {
    for (const player of players) {
      const hand = [this.deck.pop(), this.deck.pop()];
      this.playerHands.set(player.socketId, hand);
      this.playerBets.set(player.socketId, 0);
    }
  }

  dealCommunityCards(count) {
    for (let i = 0; i < count; i++) {
      this.communityCards.push(this.deck.pop());
    }
  }

  evaluateHand(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    // Simplified hand evaluation - returns hand strength (0-9)
    // In production, use a proper poker hand evaluator library
    const ranks = allCards.map(c => getCardValue(c, 'poker')).sort((a, b) => b - a);
    const suits = allCards.map(c => c.suit);

    const isFlush = suits.some(suit => suits.filter(s => s === suit).length >= 5);
    const isStraight = this.checkStraight(ranks);

    if (isFlush && isStraight) return { rank: 8, name: 'Straight Flush' };
    if (this.hasNOfAKind(ranks, 4)) return { rank: 7, name: 'Four of a Kind' };
    if (this.hasFullHouse(ranks)) return { rank: 6, name: 'Full House' };
    if (isFlush) return { rank: 5, name: 'Flush' };
    if (isStraight) return { rank: 4, name: 'Straight' };
    if (this.hasNOfAKind(ranks, 3)) return { rank: 3, name: 'Three of a Kind' };
    if (this.hasTwoPair(ranks)) return { rank: 2, name: 'Two Pair' };
    if (this.hasNOfAKind(ranks, 2)) return { rank: 1, name: 'Pair' };
    return { rank: 0, name: 'High Card' };
  }

  checkStraight(ranks) {
    const unique = [...new Set(ranks)].sort((a, b) => b - a);
    for (let i = 0; i <= unique.length - 5; i++) {
      if (unique[i] - unique[i + 4] === 4) return true;
    }
    return false;
  }

  hasNOfAKind(ranks, n) {
    return ranks.some(rank => ranks.filter(r => r === rank).length === n);
  }

  hasFullHouse(ranks) {
    return this.hasNOfAKind(ranks, 3) && this.hasNOfAKind(ranks, 2);
  }

  hasTwoPair(ranks) {
    const pairs = new Set(ranks.filter(rank => ranks.filter(r => r === rank).length === 2));
    return pairs.size >= 2;
  }

  determineWinners() {
    const activePlayers = this.table.players.filter(p => !this.playerFolded.has(p.socketId));

    if (activePlayers.length === 1) {
      return [activePlayers[0]];
    }

    const playerScores = activePlayers.map(player => ({
      player,
      hand: this.evaluateHand(this.playerHands.get(player.socketId), this.communityCards)
    }));

    playerScores.sort((a, b) => b.hand.rank - a.hand.rank);
    const bestRank = playerScores[0].hand.rank;

    return playerScores.filter(ps => ps.hand.rank === bestRank).map(ps => ps.player);
  }
}

async function handleAction(table, socket, data) {
  const { action, amount } = data;

  if (!table.gameState) {
    // Start new game
    if (action === 'startGame') {
      if (table.players.length < 2) {
        throw new Error('Need at least 2 players to start');
      }

      table.gameState = new PokerGame();
      table.gameState.dealHands(table.players);

      return {
        type: 'gameStarted',
        players: table.players.map(p => ({
          username: p.username,
          hand: table.gameState.playerHands.get(p.socketId)
        })),
        currentPlayer: table.players[0].username,
        pot: 0,
        currentBet: 0
      };
    }
    return null;
  }

  const game = table.gameState;
  const player = table.players.find(p => p.socketId === socket.id);

  switch (action) {
    case 'bet':
    case 'raise':
      if (!Wallet.canAfford(socket.userId, amount)) {
        throw new Error('Insufficient funds');
      }
      Wallet.debit(socket.userId, amount, 'poker', `Poker bet`);
      game.pot += amount;
      game.playerBets.set(socket.id, (game.playerBets.get(socket.id) || 0) + amount);
      game.currentBet = Math.max(game.currentBet, game.playerBets.get(socket.id));
      break;

    case 'call':
      const callAmount = game.currentBet - (game.playerBets.get(socket.id) || 0);
      if (!Wallet.canAfford(socket.userId, callAmount)) {
        throw new Error('Insufficient funds');
      }
      Wallet.debit(socket.userId, callAmount, 'poker', `Poker call`);
      game.pot += callAmount;
      game.playerBets.set(socket.id, game.currentBet);
      break;

    case 'fold':
      game.playerFolded.add(socket.id);
      break;

    case 'check':
      // No action needed
      break;
  }

  // Move to next player or next round
  const activePlayers = table.players.filter(p => !game.playerFolded.has(p.socketId));

  if (activePlayers.length === 1) {
    // Only one player left, they win
    const winner = activePlayers[0];
    Wallet.credit(winner.userId, game.pot, 'poker', 'Poker win');
    User.updateStats(winner.userId, 'poker', true, game.playerBets.get(winner.socketId) || 0, game.pot);

    table.gameState = null;
    return {
      type: 'gameEnded',
      winner: winner.username,
      winAmount: game.pot,
      reason: 'All other players folded'
    };
  }

  // Check if all active players have matched the current bet
  const allMatched = activePlayers.every(p => game.playerBets.get(p.socketId) === game.currentBet);

  if (allMatched) {
    // Move to next round
    if (game.round === 'preflop') {
      game.round = 'flop';
      game.dealCommunityCards(3);
    } else if (game.round === 'flop') {
      game.round = 'turn';
      game.dealCommunityCards(1);
    } else if (game.round === 'turn') {
      game.round = 'river';
      game.dealCommunityCards(1);
    } else if (game.round === 'river') {
      // Showdown
      const winners = game.determineWinners();
      const winAmount = game.pot / winners.length;

      for (const winner of winners) {
        Wallet.credit(winner.userId, winAmount, 'poker', 'Poker win');
        User.updateStats(winner.userId, 'poker', true, game.playerBets.get(winner.socketId) || 0, winAmount);
      }

      // Update losers' stats
      for (const player of table.players) {
        if (!winners.includes(player)) {
          User.updateStats(player.userId, 'poker', false, game.playerBets.get(player.socketId) || 0, 0);
        }
      }

      table.gameState = null;
      return {
        type: 'gameEnded',
        winners: winners.map(w => w.username),
        winAmount,
        communityCards: game.communityCards,
        playerHands: Object.fromEntries(
          table.players.map(p => [p.username, game.playerHands.get(p.socketId)])
        )
      };
    }

    game.currentBet = 0;
    for (const player of table.players) {
      game.playerBets.set(player.socketId, 0);
    }
  }

  return {
    type: 'actionProcessed',
    pot: game.pot,
    currentBet: game.currentBet,
    round: game.round,
    communityCards: game.communityCards,
    action: action,
    player: socket.username
  };
}

module.exports = {
  handleAction
};
