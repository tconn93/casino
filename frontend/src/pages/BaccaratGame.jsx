import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import api from '../services/api';
import GameLayout from '../components/GameLayout';
import Card from '../components/Card';
import './Game.css';
import './BaccaratGame.css';

function BaccaratGame() {
  const { tableId } = useParams();
  const location = useLocation();
  const { user, updateBalance } = useAuth();
  const [chipValue, setChipValue] = useState(10);
  const [activeBets, setActiveBets] = useState({player: 0, banker: 0, tie: 0});
  const [playerHand, setPlayerHand] = useState([]);
  const [bankerHand, setBankerHand] = useState([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [bankerValue, setBankerValue] = useState(0);
  const [winner, setWinner] = useState(null);
  const [message, setMessage] = useState('Place your bets: Player, Banker, or Tie');

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const seatNumber = searchParams.get('seat') ? parseInt(searchParams.get('seat')) : null;

    socket.joinTable('baccarat', tableId, 'multiplayer', seatNumber);

    socket.on('gameUpdate', handleGameUpdate);
    socket.on('error', handleError);

    return () => {
      socket.off('gameUpdate', handleGameUpdate);
      socket.off('error', handleError);
      socket.leaveTable();
    };
  }, [tableId, location.search]);

const handleGameUpdate = async (data) => {
  console.log('Game update:', data);

  if (data.type === 'betPlaced') {
    if (data.player === user.username) {
      setMessage(`$${data.amount} on ${data.betType.toUpperCase()} placed! Add more or Deal.`);
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
      setPlayerHand([]);
      setBankerHand([]);
      setWinner(null);
      setActiveBets({player: 0, banker: 0, tie: 0});
      setMessage('Place your bets for the next round');
    }, 5000);
  }
};

  const handleError = (error) => {
    setMessage(`Error: ${error.message}`);
    setGameActive(false);
  };

const placeBet = (betType) => {
  const totalCurrent = Object.values(activeBets).reduce((sum, val) => sum + val, 0);
  if (totalCurrent + chipValue > user.balance) {
    setMessage('Insufficient funds!');
    return;
  }

  socket.gameAction('placeBet', { betType, amount: chipValue });
  setActiveBets(prev => ({ ...prev, [betType]: prev[betType] + chipValue }));
  setMessage(`$${chipValue} on ${betType.toUpperCase()} placed! Add more or Deal.`);
};

const deal = () => {
  const total = Object.values(activeBets).reduce((sum, val) => sum + val, 0);
  if (total === 0) {
    setMessage('Place at least one bet!');
    return;
  }
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

  {playerHand.length === 0 && (
    <div className="table-felt">
      <div className="bet-areas">
  <div 
    className={`bet-area player ${activeBets.player > 0 ? 'active' : ''}`}
    onClick={() => placeBet('player')}
  >
    <div>PLAYER</div>
    <div>1:1</div>
    {activeBets.player > 0 && <div className="bet-chip">${activeBets.player}</div>}
  </div>
  <div 
    className={`bet-area tie ${activeBets.tie > 0 ? 'active' : ''}`}
    onClick={() => placeBet('tie')}
  >
    <div>TIE</div>
    <div>8:1</div>
    {activeBets.tie > 0 && <div className="bet-chip">${activeBets.tie}</div>}
  </div>
  <div 
    className={`bet-area banker ${activeBets.banker > 0 ? 'active' : ''}`}
    onClick={() => placeBet('banker')}
  >
    <div>BANKER</div>
    <div>0.95:1</div>
    {activeBets.banker > 0 && <div className="bet-chip">${activeBets.banker}</div>}
  </div>
</div>
<div style={{textAlign: 'center', color: 'white', margin: '10px'}}>
  Total Bet: <strong>${Object.values(activeBets).reduce((sum, val) => sum + val, 0)}</strong>
</div>
</div>
)}
</div>

<div className="controls">
  {playerHand.length === 0 && (
    <>
      <div className="chip-selector">
        <label>Select Chip:</label>
        <div className={`chip-option ${chipValue === 5 ? 'selected' : ''}`} onClick={() => setChipValue(5)} data-value="5">$5</div>
        <div className={`chip-option ${chipValue === 10 ? 'selected' : ''}`} onClick={() => setChipValue(10)} data-value="10">$10</div>
        <div className={`chip-option ${chipValue === 25 ? 'selected' : ''}`} onClick={() => setChipValue(25)} data-value="25">$25</div>
        <div className={`chip-option ${chipValue === 100 ? 'selected' : ''}`} onClick={() => setChipValue(100)} data-value="100">$100</div>
        <div className={`chip-option ${chipValue === 500 ? 'selected' : ''}`} onClick={() => setChipValue(500)} data-value="500">$500</div>
        <div className={`chip-option ${chipValue === 1000 ? 'selected' : ''}`} onClick={() => setChipValue(1000)} data-value="1000">$1000</div>
      </div>
      {Object.values(activeBets).reduce((sum, val) => sum + val, 0) > 0 && (
        <button onClick={() => setActiveBets({player: 0, banker: 0, tie: 0})} className="btn-action btn-clear">
          Clear Bets
        </button>
      )}
      <button 
        onClick={deal} 
        disabled={Object.values(activeBets).reduce((sum, val) => sum + val, 0) === 0}
        className="btn-action"
      >
        Deal Cards
      </button>
    </>
  )}
</div>
      </div>
    </GameLayout>
  );
}

export default BaccaratGame;
