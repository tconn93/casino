import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import api from '../services/api';
import GameLayout from '../components/GameLayout';
import './Game.css';

function RouletteGame() {
  const { tableId } = useParams();
  const { user, updateBalance } = useAuth();
  const [bets, setBets] = useState([]);
  const [betAmount, setBetAmount] = useState(10);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Place your bets');
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    socket.joinTable('roulette', tableId, 'vs_house');

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
        setMessage('Bet placed! Add more bets or spin the wheel.');
      }
    } else if (data.type === 'spinComplete') {
      setSpinning(false);
      setResult(data.result);

      const myResult = data.playerResults.find(r => r.username === user.username);
      if (myResult) {
        if (myResult.netProfit > 0) {
          setMessage(`You win $${myResult.winAmount.toFixed(2)}!`);
        } else if (myResult.netProfit < 0) {
          setMessage('You lose!');
        } else {
          setMessage('No wins this time.');
        }
      }

      // Refresh balance from server
      try {
        const balanceData = await api.getBalance();
        updateBalance(balanceData.balance);
      } catch (error) {
        console.error('Failed to update balance:', error);
      }

      setTimeout(() => {
        setBets([]);
        setResult(null);
        setMessage('Place your bets for the next spin');
      }, 5000);
    }
  };

  const handleError = (error) => {
    setMessage(`Error: ${error.message}`);
    setSpinning(false);
  };

  const placeBet = (betType, value) => {
    if (betAmount > user.balance) {
      setMessage('Insufficient funds!');
      return;
    }

    socket.gameAction('placeBet', { betType, value, amount: betAmount });
    setBets([...bets, { betType, value, amount: betAmount }]);
  };

  const spin = () => {
    if (bets.length === 0) {
      setMessage('Place at least one bet!');
      return;
    }

    setSpinning(true);
    setMessage('Spinning...');
    socket.gameAction('spin');
  };

  const betOptions = [
    { label: 'Red', type: 'color', value: 'red' },
    { label: 'Black', type: 'color', value: 'black' },
    { label: 'Odd', type: 'odd', value: null },
    { label: 'Even', type: 'even', value: null },
    { label: 'Low (1-18)', type: 'low', value: null },
    { label: 'High (19-36)', type: 'high', value: null },
    { label: '1st Dozen (1-12)', type: 'dozen1', value: null },
    { label: '2nd Dozen (13-24)', type: 'dozen2', value: null },
    { label: '3rd Dozen (25-36)', type: 'dozen3', value: null },
  ];

  return (
    <GameLayout title="Roulette">
      <div className="game-container">
        <div className="game-area">
          <div className="roulette-wheel">
            {result && (
              <div className="roulette-result" style={{
                background: result.color === 'red' ? '#e74c3c' : result.color === 'black' ? '#2c3e50' : '#2ecc71',
                color: 'white'
              }}>
                {result.number}
              </div>
            )}
          </div>

          <div className="message-area">
            <h2>{message}</h2>
          </div>

          {bets.length > 0 && (
            <div className="current-bets">
              <h3>Your Bets:</h3>
              {bets.map((bet, i) => (
                <div key={i} className="bet-item">
                  {bet.betType} {bet.value} - ${bet.amount}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="controls">
          <div className="bet-controls">
            <label>Bet Amount:</label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min="1"
              max={user?.balance || 0}
              disabled={spinning}
            />
          </div>

          <div className="betting-board">
            {betOptions.map((option, i) => (
              <div
                key={i}
                className="bet-option"
                onClick={() => !spinning && placeBet(option.type, option.value)}
              >
                {option.label}
              </div>
            ))}
          </div>

          <button onClick={spin} disabled={spinning || bets.length === 0} className="btn-action">
            {spinning ? 'Spinning...' : 'Spin Wheel'}
          </button>
        </div>
      </div>
    </GameLayout>
  );
}

export default RouletteGame;
