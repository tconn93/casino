import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import api from '../services/api';
import GameLayout from '../components/GameLayout';
import Card from '../components/Card';
import './Game.css';

function BaccaratGame() {
  const { tableId } = useParams();
  const { user, updateBalance } = useAuth();
  const [betAmount, setBetAmount] = useState(10);
  const [betType, setBetType] = useState('player');
  const [playerHand, setPlayerHand] = useState([]);
  const [bankerHand, setBankerHand] = useState([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [bankerValue, setBankerValue] = useState(0);
  const [winner, setWinner] = useState(null);
  const [message, setMessage] = useState('Place your bet: Player, Banker, or Tie');
  const [gameActive, setGameActive] = useState(false);

  useEffect(() => {
    socket.joinTable('baccarat', tableId, 'vs_house');

    socket.on('gameUpdate', handleGameUpdate);
    socket.on('error', handleError);

    return () => {
      socket.off('gameUpdate', handleGameUpdate);
      socket.off('error', handleError);
      socket.leaveTable();
    };
  }, [tableId]);

  const handleGameUpdate = async (data) => {
    console.log('Game update:', data);

    if (data.type === 'betPlaced') {
      if (data.player === user.username) {
        setMessage('Bet placed! Click Deal to start.');
      }
    } else if (data.type === 'gameComplete') {
      setPlayerHand(data.playerHand);
      setBankerHand(data.bankerHand);
      setPlayerValue(data.playerValue);
      setBankerValue(data.bankerValue);
      setWinner(data.winner);

      const myResult = data.playerResults.find(r => r.username === user.username);
      if (myResult) {
        if (myResult.netProfit > 0) {
          setMessage(`${data.winner} wins! You win $${myResult.winAmount.toFixed(2)}!`);
        } else if (myResult.netProfit === 0) {
          setMessage(`${data.winner} wins! Push - bet returned.`);
        } else {
          setMessage(`${data.winner} wins! You lose!`);
        }

        // Refresh balance from server
        try {
          const balanceData = await api.getBalance();
          updateBalance(balanceData.balance);
        } catch (error) {
          console.error('Failed to update balance:', error);
        }
      }

      setTimeout(() => {
        setGameActive(false);
        setPlayerHand([]);
        setBankerHand([]);
        setWinner(null);
        setMessage('Place your bet for the next round');
      }, 5000);
    }
  };

  const handleError = (error) => {
    setMessage(`Error: ${error.message}`);
    setGameActive(false);
  };

  const placeBet = () => {
    if (betAmount > user.balance) {
      setMessage('Insufficient funds!');
      return;
    }

    socket.gameAction('placeBet', { betType, amount: betAmount });
    setGameActive(true);
  };

  const deal = () => {
    setMessage('Dealing cards...');
    socket.gameAction('deal');
  };

  return (
    <GameLayout title="Baccarat">
      <div className="game-container">
        <div className="game-area">
          <div className="baccarat-table">
            <div className="banker-area">
              <h3>Banker {bankerValue > 0 && `(${bankerValue})`}</h3>
              <div className="card-container">
                {bankerHand.map((card, i) => (
                  <Card key={i} card={card} />
                ))}
              </div>
            </div>

            <div className="message-area">
              <h2>{message}</h2>
              {winner && (
                <div className="winner-display">
                  <h3>{winner.toUpperCase()} WINS!</h3>
                </div>
              )}
            </div>

            <div className="player-area">
              <h3>Player {playerValue > 0 && `(${playerValue})`}</h3>
              <div className="card-container">
                {playerHand.map((card, i) => (
                  <Card key={i} card={card} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="controls">
          {!gameActive ? (
            <div className="bet-controls">
              <label>Bet On:</label>
              <select value={betType} onChange={(e) => setBetType(e.target.value)}>
                <option value="player">Player (1:1)</option>
                <option value="banker">Banker (0.95:1)</option>
                <option value="tie">Tie (8:1)</option>
              </select>
              <label>Amount:</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                min="1"
                max={user?.balance || 0}
              />
              <button onClick={placeBet} className="btn-action">Place Bet</button>
            </div>
          ) : (
            playerHand.length === 0 && (
              <button onClick={deal} className="btn-action">Deal Cards</button>
            )
          )}
        </div>
      </div>
    </GameLayout>
  );
}

export default BaccaratGame;
