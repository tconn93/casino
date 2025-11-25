const Wallet = require('../models/Wallet');
const User = require('../models/User');

class CrapsGame {
  constructor() {
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
      const betsToRemove = new Map(); // Track which bets to remove from each player
      const betOutcomes = new Map(); // Track wins/losses for each player

      for (const [socketId, playerBets] of this.bets.entries()) {
              let winnings = 0;
              const removeIndices = []; // Indices of bets to remove for this player
              const outcomes = { won: [], lost: [] };

              // Filter out bets that need special handling
              const regularBets = [];
              const newComeBets = [];
              const newDontComeBets = [];

              for (let i = 0; i < playerBets.length; i++) {
                const bet = playerBets[i];
                if (bet.type === 'come') {
                  newComeBets.push({ bet, index: i });
                } else if (bet.type === 'dontCome') {
                  newDontComeBets.push({ bet, index: i });
                } else {
                  regularBets.push(bet);
                }
              }

              // Evaluate regular bets
              for (const bet of regularBets) {
                const result = this.evaluateBet(bet, roll);
                if (result.win === true) {
                  winnings += bet.amount * result.payout;
                  outcomes.won.push({ type: bet.type, amount: bet.amount });
                } else if (result.win === false) {
                  outcomes.lost.push({ type: bet.type, amount: bet.amount });
                }
              }

      //     // Handle new Come bets
      //     for (const { bet, index } of newComeBets) {
      //       const result = this.evaluateComeBet(bet, roll, socketId, betMovements);
      //       if (result.win !== null) {
      //         // Bet resolved (win or loss) - mark for removal
      //         removeIndices.push(index);
      //         if (result.win) {
      //           winnings += bet.amount * result.payout;
      //           outcomes.won.push({ type: 'come', amount: bet.amount });
      //         } else {
      //           outcomes.lost.push({ type: 'come', amount: bet.amount });
      //         }
      //       } else {
      //         // Bet moved to a number - mark for removal from regular bets
      //         removeIndices.push(index);
      //       }
      //     }

      //     // Handle new Don't Come bets
      //     for (const { bet, index } of newDontComeBets) {
      //       const result = this.evaluateDontComeBet(bet, roll, socketId, betMovements);
      //       if (result.win !== null) {
      //         // Bet resolved - mark for removal
      //         removeIndices.push(index);
      //         if (result.win) {
      //           winnings += bet.amount * result.payout;
      //           outcomes.won.push({ type: 'dontCome', amount: bet.amount });
      //         } else {
      //           outcomes.lost.push({ type: 'dontCome', amount: bet.amount });
      //         }
      //         if (result.win === null && roll.total === 12) {
      //           winnings += bet.amount; // Push - return stake
      //         }
      //       } else {
      //         // Bet moved to a number - mark for removal
      //         removeIndices.push(index);
      //       }
      //     }

      //     betsToRemove.set(socketId, removeIndices);
      //     results.set(socketId, winnings);
      //     betOutcomes.set(socketId, outcomes);
      // }

      // // Remove come/dontCome bets that were moved or resolved
      // for (const [socketId, indices] of betsToRemove.entries()) {
      //   if (indices.length > 0) {
      //     const playerBets = this.bets.get(socketId);
      //     // Remove in reverse order to maintain indices
      //     for (let i = indices.length - 1; i >= 0; i--) {
      //       playerBets.splice(indices[i], 1);
      //     }
      //   }
      // }

    // Evaluate existing Come bets that have numbers
    const remainingComeBets = [];
    for (const comeBet of this.comeBets) {
      if (roll.total === comeBet.number) {
        // Win! Add profit (stake + win = amount * 2, but since stake debited, credit full)
        const currentWinnings = results.get(comeBet.socketId) || 0;
        results.set(comeBet.socketId, currentWinnings + comeBet.amount * 2);

        const outcomes = betOutcomes.get(comeBet.socketId) || { won: [], lost: [] };
        outcomes.won.push({ type: `come-${comeBet.number}`, amount: comeBet.amount });
        betOutcomes.set(comeBet.socketId, outcomes);
      } else if (roll.total === 7) {
        // Lose - no credit
        const outcomes = betOutcomes.get(comeBet.socketId) || { won: [], lost: [] };
        outcomes.lost.push({ type: `come-${comeBet.number}`, amount: comeBet.amount });
        betOutcomes.set(comeBet.socketId, outcomes);
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

        const outcomes = betOutcomes.get(dontComeBet.socketId) || { won: [], lost: [] };
        outcomes.won.push({ type: `dontcome-${dontComeBet.number}`, amount: dontComeBet.amount });
        betOutcomes.set(dontComeBet.socketId, outcomes);
      } else if (roll.total === dontComeBet.number) {
        // Lose - no credit
        const outcomes = betOutcomes.get(dontComeBet.socketId) || { won: [], lost: [] };
        outcomes.lost.push({ type: `dontcome-${dontComeBet.number}`, amount: dontComeBet.amount });
        betOutcomes.set(dontComeBet.socketId, outcomes);
      } else {
        remainingDontComeBets.push(dontComeBet);
      }
    }
    this.dontComeBets = remainingDontComeBets;

          // Remove come/dontCome bets that were moved or resolved
      for (const [socketId, indices] of betsToRemove.entries()) {
        if (indices.length > 0) {
          const playerBets = this.bets.get(socketId);
          // Remove in reverse order to maintain indices
          for (let i = indices.length - 1; i >= 0; i--) {
            playerBets.splice(indices[i], 1);
          }
        }
      }

                // Handle new Come bets
          for (const { bet, index } of newComeBets) {
            const result = this.evaluateComeBet(bet, roll, socketId, betMovements);
            if (result.win !== null) {
              // Bet resolved (win or loss) - mark for removal
              removeIndices.push(index);
              if (result.win) {
                winnings += bet.amount * result.payout;
                outcomes.won.push({ type: 'come', amount: bet.amount });
              } else {
                outcomes.lost.push({ type: 'come', amount: bet.amount });
              }
            } else {
              // Bet moved to a number - mark for removal from regular bets
              removeIndices.push(index);
            }
          }

          // Handle new Don't Come bets
          for (const { bet, index } of newDontComeBets) {
            const result = this.evaluateDontComeBet(bet, roll, socketId, betMovements);
            if (result.win !== null) {
              // Bet resolved - mark for removal
              removeIndices.push(index);
              if (result.win) {
                winnings += bet.amount * result.payout;
                outcomes.won.push({ type: 'dontCome', amount: bet.amount });
              } else {
                outcomes.lost.push({ type: 'dontCome', amount: bet.amount });
              }
              if (result.win === null && roll.total === 12) {
                winnings += bet.amount; // Push - return stake
              }
            } else {
              // Bet moved to a number - mark for removal
              removeIndices.push(index);
            }
          }

          betsToRemove.set(socketId, removeIndices);
          results.set(socketId, winnings);
          betOutcomes.set(socketId, outcomes);
      }

      return { results, betMovements, betOutcomes };
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
      table.gameState = new CrapsGame();
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
    const { results, betMovements, betOutcomes } = game.evaluateBets(roll);

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

    // Remove resolved bets from each player's bet array
    for (const [socketId, playerBets] of game.bets.entries()) {
      const unresolvedBets = playerBets.filter(bet => {
        // Come and Don't Come bets should have already been handled and removed
        // Skip them here to avoid incorrect evaluation
        if (bet.type === 'come' || bet.type === 'dontCome') {
          return false; // Remove these if they somehow remain
        }

        const result = game.evaluateBet(bet, roll);
        // Keep bet if it's not resolved (win: null means bet continues)
        return result.win === null;
      });

      if (unresolvedBets.length > 0) {
        game.bets.set(socketId, unresolvedBets);
      } else {
        game.bets.delete(socketId);
      }
    }

    // Update game phase
    const wasPointPhase = game.phase === 'point';
    if (game.phase === 'comeOut') {
      if (![2, 3, 7, 11, 12].includes(total)) {
        game.point = total;
        game.phase = 'point';
        // Pass/don't pass bets stay in bets Map (already handled above)
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
        // Point made - new come-out
        game.phase = 'comeOut';
        game.point = null;
        // Resolved bets already removed above
      }
    }

    // Prepare current active bets for each player
    const currentBets = new Map();
    for (const [socketId, playerBets] of game.bets.entries()) {
      const betsByType = {};
      for (const bet of playerBets) {
        betsByType[bet.type] = (betsByType[bet.type] || 0) + bet.amount;
      }
      currentBets.set(socketId, betsByType);
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
      dontComeBets: game.dontComeBets,
      currentBets: Array.from(currentBets.entries()).map(([socketId, bets]) => ({ socketId, bets })),
      betOutcomes: betOutcomes ? Array.from(betOutcomes.entries()).map(([socketId, outcomes]) => ({ socketId, outcomes })) : []
    };
  }

  return null;
}

module.exports = {
  handleAction
};
