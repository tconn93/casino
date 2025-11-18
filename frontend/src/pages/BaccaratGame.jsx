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
  const [chipValue, setChipValue] = useState(10);
  const [activeBets, setActiveBets] = useState({player: 0, banker: 0, tie: 0});
  const [playerHand, setPlayerHand] = useState([]);
  const [bankerHand, setBankerHand] = useState([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [bankerValue, setBankerValue] = useState(0);
  const [winner, setWinner] = useState(null);
  const [message, setMessage] = useState('Place your bets: Player, Banker, or Tie');

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
    <div className="table-felt" style={{backgroundColor: '#0a3d0a', padding: '20px', margin: '10px 0', borderRadius: '10px', position: 'relative'}}>
      <div className="baccarat-bet-areas" style={{display: 'flex', justifyContent: 'space-around', margin: '20px 0'}}>
        <div 
          className="bet-area player"
          onClick={() => placeBet('player')}
          style={{
            cursor: 'pointer', 
            border: '2px solid #4a90e2', 
            padding: '20px', 
            margin: '5px', 
            textAlign: 'center', 
            backgroundColor: activeBets.player > 0 ? '#4a90e2' : 'rgba(0,0,0,0.3)', 
            color: activeBets.player > 0 ? 'white' : '#fff',
            minWidth: '120px',
            borderRadius: '8px'
          }}
        >
          <div style={{fontSize: '1.1em', fontWeight: 'bold'}}>PLAYER</div>
          <div style={{marginTop: '5px'}}>1:1</div>
          {activeBets.player > 0 && <div className="bet-chip" style={{fontSize: '1.2em', color: '#fff', background: 'radial-gradient(circle, #4a90e2, #357abd)', borderRadius: '50%', width: '50px', height: '50px', display: 'block', margin: '0 auto', alignItems: 'center', justifyContent: 'center'}}>${activeBets.player}</div>}
        </div>
        <div 
          className="bet-area tie"
          onClick={() => placeBet('tie')}
          style={{
            cursor: 'pointer', 
            border: '2px solid #ff6b6b', 
            padding: '20px', 
            margin: '5px', 
            textAlign: 'center', 
            backgroundColor: activeBets.tie > 0 ? '#ff6b6b' : 'rgba(0,0,0,0.3)', 
            color: activeBets.tie > 0 ? 'white' : '#fff',
            minWidth: '120px',
            borderRadius: '8px'
          }}
        >
          <div style={{fontSize: '1.1em', fontWeight: 'bold'}}>TIE</div>
          <div style={{marginTop: '5px'}}>8:1</div>
          {activeBets.tie > 0 && <div className="bet-chip" style={{fontSize: '1.2em', color: '#fff', background: 'radial-gradient(circle, #ff6b6b, #ee5a52)', borderRadius: '50%', width: '50px', height: '50px', display: 'block', margin: '0 auto', alignItems: 'center', justifyContent: 'center'}}>${activeBets.tie}</div>}
        </div>
        <div 
          className="bet-area banker"
          onClick={() => placeBet('banker')}
          style={{
            cursor: 'pointer', 
            border: '2px solid #ffd700', 
            padding: '20px', 
            margin: '5px', 
            textAlign: 'center', 
            backgroundColor: activeBets.banker > 0 ? '#ffd700' : 'rgba(0,0,0,0.3)', 
            color: activeBets.banker > 0 ? 'black' : '#fff',
            minWidth: '120px',
            borderRadius: '8px'
          }}
        >
          <div style={{fontSize: '1.1em', fontWeight: 'bold'}}>BANKER</div>
          <div style={{marginTop: '5px'}}>0.95:1</div>
          {activeBets.banker > 0 && <div className="bet-chip" style={{fontSize: '1.2em', color: '#000', background: 'radial-gradient(circle, #ffd700, #ffed4e)', borderRadius: '50%', width: '50px', height: '50px', display: 'block', margin: '0 auto', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>${activeBets.banker}</div>}
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
  <div className="baccarat-controls">
<div className="chip-selector">
  <label>Select Chip:</label>
  <div className={`chip-option ${chipValue === 5 ? 'selected' : ''}`} onClick={() => setChipValue(5)}>$5</div>
  <div className={`chip-option ${chipValue === 10 ? 'selected' : ''}`} onClick={() => setChipValue(10)}>$10</div>
  <div className={`chip-option ${chipValue === 25 ? 'selected' : ''}`} onClick={() => setChipValue(25)}>$25</div>
  <div className={`chip-option ${chipValue === 100 ? 'selected' : ''}`} onClick={() => setChipValue(100)}>$100</div>
  <div className={`chip-option ${chipValue === 500 ? 'selected' : ''}`} onClick={() => setChipValue(500)}>$500</div>
  <div className={`chip-option ${chipValue === 1000 ? 'selected' : ''}`} onClick={() => setChipValue(1000)}>$1000</div>
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
  </div>
)}
        </div>
      </div>
    </GameLayout>
  );
}

export default BaccaratGame;
