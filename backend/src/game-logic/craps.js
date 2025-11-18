const Wallet = require('../models/Wallet');
const User = require('../models/User');

class CrapsGame {
  constructor(table) {
    this.table = table;
    this.phase = 'comeOut'; // comeOut or point
    this.point = null;
    this.bets = new Map(); // socketId -> array of bets
    this.comeBets = []; // { socketId, amount, number } - Come bets that have moved to a number
    this.dontComeBets = []; // { socketId, amount, number } - Don't Come bets that have moved to a number
  }

    rollDice() {
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      return { die1, die2, total: die1 + die2 };
    }

    placeBet(socketId, betType, amount) {
      if (!this.bets.has(socketId)) {
        this.bets.set(socketId, []);
      }
      this.bets.get(socketId).push({ type: betType, amount });
    }

    evaluateBets(roll) {
      const results = new Map();
      const betMovements = []; // Track Come/Don't Come bets that moved to numbers

      for (const [socketId, playerBets] of this.bets.entries()) {
              let winnings = 0;

              // Filter out bets that need special handling
              const regularBets = [];
              const newComeBets = [];
              const newDontComeBets = [];

              for (const bet of playerBets) {
                if (bet.type === 'come') {
                  newComeBets.push(bet);
                } else if (bet.type === 'dontCome') {
                  newDontComeBets.push(bet);
                } else {
                  regularBets.push(bet);
                }
              }

              // Evaluate regular bets
              for (const bet of regularBets) {
                const result = this.evaluateBet(bet, roll);
                if (result.win) {
                  winnings += bet.amount * result.payout;
                }
              }

          // Handle new Come bets
          for (const bet of newComeBets) {
            const result = this.evaluateComeBet(bet, roll, socketId, betMovements);
            if (result.win !== null) {
              if (result.win) {
                winnings += bet.amount * result.payout; // Add full payout
              } // For loss, nothing - stake lost
            } // For move, null, bet stays in comeBets
          }

          // Handle new Don't Come bets
          for (const bet of newDontComeBets) {
            const result = this.evaluateDontComeBet(bet, roll, socketId, betMovements);
            if (result.win !== null) {
              if (result.win) {
                winnings += bet.amount * result.payout; // Add full payout
              } // For loss or push, handle accordingly
              if (result.win === null && total === 12) {
                winnings += bet.amount; // Push - return stake
              }
            }
          }

              results.set(socketId, winnings);
      }

    // Evaluate existing Come bets that have numbers
    const remainingComeBets = [];
    for (const comeBet of this.comeBets) {
      if (roll.total === comeBet.number) {
        // Win! Add profit (stake + win = amount * 2, but since stake debited, credit full)
        const currentWinnings = results.get(comeBet.socketId) || 0;
        results.set(comeBet.socketId, currentWinnings + comeBet.amount * 2);
      } else if (roll.total === 7) {
        // Lose - no credit
      } else {
        remainingComeBets.push(comeBet);
      }
    }
    this.comeBets = remainingComeBets;

    // Evaluate existing Don't Come bets that have numbers
    const remainingDontComeBets = [];
    for (const dontComeBet of this.dontComeBets) {
      if (roll.total === 7) {
        // Win! Add full payout
        const currentWinnings = results.get(dontComeBet.socketId) || 0;
        results.set(dontComeBet.socketId, currentWinnings + dontComeBet.amount * 2);
      } else if (roll.total === dontComeBet.number) {
        // Lose - no credit
      } else {
        remainingDontComeBets.push(dontComeBet);
      }
    }
    this.dontComeBets = remainingDontComeBets;

      return { results, betMovements };
    }

    evaluateComeBet(bet, roll, socketId, betMovements) {
      const { total } = roll;

      // First roll of a Come bet
      if (total === 7 || total === 11) {
        return { win: true, payout: 2 };
      }
      if (total === 2 || total === 3 || total === 12) {
        return { win: false, payout: 0 };
      }

      // Move bet to this number
      this.comeBets.push({ socketId, amount: bet.amount, number: total });
      betMovements.push({ socketId, type: 'come', amount: bet.amount, number: total });
      return { win: null, payout: 0 }; // Bet moves, not resolved
    }

    evaluateDontComeBet(bet, roll, socketId, betMovements) {
      const { total } = roll;

      // First roll of a Don't Come bet
      if (total === 2 || total === 3) {
        return { win: true, payout: 2 };
      }
      if (total === 7 || total === 11) {
        return { win: false, payout: 0 };
      }
      if (total === 12) {
        return { win: null, payout: 0 }; // Push - return the bet
      }

      // Move bet to this number
      this.dontComeBets.push({ socketId, amount: bet.amount, number: total });
      betMovements.push({ socketId, type: 'dontCome', amount: bet.amount, number: total });
      return { win: null, payout: 0 }; // Bet moves, not resolved
    }

  evaluateBet(bet, roll) {
    const { total } = roll;

    if (this.phase === 'comeOut') {
      if (bet.type === 'pass') {
        if (total === 7 || total === 11) return { win: true, payout: 2 };
        if (total === 2 || total === 3 || total === 12) return { win: false, payout: 0 };
        // Point established - bet stays, no resolution
        return { win: null, payout: 0 };
      }
      if (bet.type === 'dontPass') {
        if (total === 2 || total === 3) return { win: true, payout: 2 };
        if (total === 7 || total === 11) return { win: false, payout: 0 };
        if (total === 12) return { win: null, payout: 0 }; // Push
        // Point established - bet stays
        return { win: null, payout: 0 };
      }
    } else {
      // Point phase
      if (bet.type === 'pass') {
        if (total === this.point) return { win: true, payout: 2 };
        if (total === 7) return { win: false, payout: 0 };
        // Otherwise, bet stays
        return { win: null, payout: 0 };
      }
      if (bet.type === 'dontPass') {
        if (total === 7) return { win: true, payout: 2 };
        if (total === this.point) return { win: false, payout: 0 };
        // Otherwise, bet stays
        return { win: null, payout: 0 };
      }
    }

    // Field bet - always resolves
    if (bet.type === 'field') {
      if ([3, 4, 9, 10, 11].includes(total)) return { win: true, payout: 2 };
      if (total === 2) return { win: true, payout: 3 };
      if (total === 12) return { win: true, payout: 3 };
      return { win: false, payout: 0 };
    }

    // Any 7 - resolves on 7
    if (bet.type === 'any7') {
      if (total === 7) return { win: true, payout: 5 };
      return { win: false, payout: 0 };
    }

    // Any Craps - resolves on craps
    if (bet.type === 'anyCraps' && [2, 3, 12].includes(total)) {
      return { win: true, payout: 8 };
    }
    if (bet.type === 'anyCraps') return { win: false, payout: 0 };

    // Specific craps/yo - resolve on their number
    if (bet.type === 'craps2' && total === 2) return { win: true, payout: 31 };
    if (bet.type === 'craps2') return { win: false, payout: 0 };
    if (bet.type === 'craps3' && total === 3) return { win: true, payout: 16 };
    if (bet.type === 'craps3') return { win: false, payout: 0 };
    if (bet.type === 'yo11' && total === 11) return { win: true, payout: 16 };
    if (bet.type === 'yo11') return { win: false, payout: 0 };
    if (bet.type === 'craps12' && total === 12) return { win: true, payout: 31 };
    if (bet.type === 'craps12') return { win: false, payout: 0 };

    // Place bets - resolve on number or 7
      if (bet.type.startsWith('place')) {
        const number = parseInt(bet.type.replace('place', ''));
        if (total === number) {
          if (number === 4 || number === 10) return { win: true, payout: 2.8 }; // Full return: stake + 1.8 win
          if (number === 5 || number === 9) return { win: true, payout: 2.4 }; // stake + 1.4
          if (number === 6 || number === 8) return { win: true, payout: 2.166 }; // stake + 1.166
        }
        if (total === 7) return { win: false, payout: 0 };
        // Otherwise, bet stays
        return { win: null, payout: 0 };
      }

    // Hardways - resolve on hard number, 7, or easy number
    if (bet.type.startsWith('hard')) {
      const number = parseInt(bet.type.replace('hard', ''));
      if (roll.die1 === roll.die2 && total === number) {
        if (number === 4 || number === 10) return { win: true, payout: 8 }; // 7:1
        if (number === 6 || number === 8) return { win: true, payout: 10 }; // 9:1
      }
      if (total === 7 || (roll.die1 !== roll.die2 && total === number)) return { win: false, payout: 0 };
      // Otherwise, bet stays
      return { win: null, payout: 0 };
    }

    return { win: false, payout: 0 };
  }
}

async function handleAction(table, socket, data) {
  const { action, betType, amount } = data;

  if (action === 'placeBet') {
    if (!Wallet.canAfford(socket.userId, amount)) {
      throw new Error('Insufficient funds');
    }

    if (!table.gameState) {
      table.gameState = new CrapsGame(table);
    }



    await Wallet.debit(socket.userId, amount, 'craps', `Craps bet: ${betType}`);
    table.gameState.placeBet(socket.id, betType, amount);

    return {
      type: 'betPlaced',
      player: socket.username,
      betType,
      amount,
      phase: table.gameState.phase
    };
  }

  if (action === 'roll') {
    if (!table.gameState || table.gameState.bets.size === 0) {
      throw new Error('No bets placed');
    }

    const game = table.gameState;
    const roll = game.rollDice();
    const { total } = roll;

    // Evaluate all bets
    const { results, betMovements } = game.evaluateBets(roll);

// Process winnings and update stats only for resolved bets
  const playerResults = [];
  const isResolution = (game.phase === 'comeOut' && (total === 7 || total === game.point)); // Seven out or point made
  for (const player of table.players) {
    let playerWinAmount = 0;
    let playerTotalBet = 0;
    let resolved = false;

    if (results.has(player.socketId)) {
      playerWinAmount = results.get(player.socketId);
      const playerBets = game.bets.get(player.socketId) || [];
      playerTotalBet = playerBets.reduce((sum, bet) => sum + bet.amount, 0);

        // Check if this roll resolves the player's bets (e.g., pass line resolved, or all bets evaluated as win/loss)
        const hasOngoingBets = playerBets.some(bet => game.evaluateBet(bet, roll).win === null);
        resolved = isResolution || !hasOngoingBets || playerWinAmount > 0 || playerTotalBet > 0;

      if (resolved) {
        if (playerWinAmount > 0) {
          await Wallet.credit(player.userId, playerWinAmount, 'craps', 'Craps win');
          await User.updateStats(player.userId, 'craps', true, playerTotalBet, playerWinAmount - playerTotalBet); // Pass net win
        } else if (playerTotalBet > 0) {
          await User.updateStats(player.userId, 'craps', false, playerTotalBet, 0);
        }
      }
    }

    playerResults.push({
      username: player.username,
      bets: game.bets.get(player.socketId) || [],
      winAmount: playerWinAmount,
      netProfit: playerWinAmount - playerTotalBet,
      resolved
    });
  }

    // Update game phase and persist ongoing bets
    const wasPointPhase = game.phase === 'point';
    if (game.phase === 'comeOut') {
      if (![2, 3, 7, 11, 12].includes(total)) {
        game.point = total;
        game.phase = 'point';
        // Pass/don't pass bets stay in bets Map
      } else {
        // Resolution in comeOut - clear bets
        game.bets.clear();
      }
    } else {
      if (total === 7) {
        // Seven out - full reset
        game.phase = 'comeOut';
        game.point = null;
        game.bets.clear();
        game.comeBets = [];
        game.dontComeBets = [];
      } else if (total === game.point) {
        // Point made - new come-out, clear resolved bets but keep ongoing like place/come
        game.phase = 'comeOut';
        game.point = null;
        // Remove resolved pass/don't pass from bets, but keep place/hardway/come (come already handled)
        for (const [socketId, playerBets] of game.bets.entries()) {
          game.bets.set(socketId, playerBets.filter(bet => !['pass', 'dontPass'].includes(bet.type)));
        }
        // comeBets and dontComeBets persist
      } else {
        // Non-resolution roll in point phase - bets stay
      }
    }

    // If phase changed to comeOut and not seven out, persist place bets etc.
    if (game.phase === 'comeOut' && wasPointPhase && total !== 7) {
      // Place bets, hardways stay active
    }

    return {
      type: 'rollComplete',
      roll: {
        die1: roll.die1,
        die2: roll.die2,
        total: roll.total
      },
      phase: game.phase,
      point: game.point,
      playerResults,
      betMovements,
      comeBets: game.comeBets,
      dontComeBets: game.dontComeBets
    };
  }

  return null;
}

module.exports = {
  handleAction
};
