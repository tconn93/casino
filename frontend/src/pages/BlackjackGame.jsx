import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import api from '../services/api';
import GameLayout from '../components/GameLayout';
import Card from '../components/Card';
import './Game.css';
import './BlackjackGame.css';

function BlackjackGame() {
  const { tableId } = useParams();
  const { user, updateBalance } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [totalBet, setTotalBet] = useState(0);
  const [chipValue, setChipValue] = useState(10);
  const [currentBet, setCurrentBet] = useState(0);
  const [message, setMessage] = useState('Place your bet to start');
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);

  useEffect(() => {
    socket.joinTable('blackjack', tableId, 'vs_house');

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

    if (data.type === 'gameStarted') {
      const myPlayer = data.players.find(p => p.username === user.username);
      setPlayerHand(myPlayer.hand);
      setPlayerValue(myPlayer.value);
      setDealerHand(data.dealerHand);
      setDealerValue(data.dealerValue);
      setMessage('Your turn! Hit or Stand?');
      setGameState('playing');
    } else if (data.type === 'cardDealt') {
      if (data.player === user.username) {
        setPlayerHand(data.hand);
        setPlayerValue(data.value);
        if (data.busted) {
          setMessage('Busted! You lose.');
        }
      }
    } else if (data.type === 'gameEnded') {
      setDealerHand(data.dealerHand);
      setDealerValue(data.dealerValue);

      const myResult = data.results.find(r => r.username === user.username);
      if (myResult) {
        setPlayerHand(myResult.hand);
        setPlayerValue(myResult.value);

        if (myResult.result === 'win') {
          setMessage(`You win $${myResult.winAmount.toFixed(2)}!`);
        } else if (myResult.result === 'lose') {
          setMessage('You lose!');
        } else {
          setMessage('Push! Bet returned.');
        }
      }

      // Refresh balance from server
      try {
        const balanceData = await api.getBalance();
        updateBalance(balanceData.balance);
      } catch (error) {
        console.error('Failed to update balance:', error);
      }

      setGameState('ended');
      setTimeout(() => {
        setGameState(null);
        setPlayerHand([]);
        setDealerHand([]);
        setMessage('Place your bet to start a new game');
      }, 5000);
    }
  };

  const handleError = (error) => {
    setMessage(`Error: ${error.message}`);
  };

const placeBet = () => {
  const amount = totalBet;
  if (amount > user.balance) {
    setMessage('Insufficient funds!');
    return;
  }

  socket.gameAction('bet', { bet: amount });
  setCurrentBet(amount);
  setTotalBet(0);
  setMessage('Dealing cards...');
};

  const hit = () => {
    socket.gameAction('hit');
  };

  const stand = () => {
    socket.gameAction('stand');
  };

const doubleDown = () => {
  if (currentBet > user.balance) {
    setMessage('Insufficient funds for double down!');
    return;
  }
  socket.gameAction('double');
};

  return (
    <GameLayout title="Blackjack">
      <div className="game-container">
<div className="game-area">
  <div className="dealer-area">
    <h3>Dealer {dealerValue > 0 && `(${dealerValue})`}</h3>
    <div className="card-container">
      {dealerHand.map((card, i) => (
        <Card key={i} card={card} hidden={card.hidden} />
      ))}
    </div>
  </div>

  {!gameState && (
    <div className="table-felt">
      <div 
        className="bet-area" 
        onClick={() => {
          if (totalBet + chipValue > user.balance) {
            setMessage('Insufficient funds!');
            return;
          }
          setTotalBet(prev => prev + chipValue);
        }}
        style={{
          cursor: 'pointer', 
          border: '2px dashed #ffd700', 
          padding: '40px', 
          margin: '0 auto', 
          textAlign: 'center', 
          backgroundColor: 'rgba(0,0,0,0.3)', 
          borderRadius: '10px',
          width: '200px',
          color: 'white'
        }}
      >
        <div style={{fontSize: '1.2em', marginBottom: '10px'}}>YOUR BET</div>
        {totalBet > 0 && <div className="bet-chip" style={{fontSize: '1.5em', color: '#000', background: 'radial-gradient(circle, #ffd700, #ffed4e)', borderRadius: '50%', width: '60px', height: '60px', display: 'block', margin: '0 auto', alignItems: 'center', justifyContent: 'center'}}>${totalBet}</div>}
      </div>
    </div>
  )}

  <div className="message-area">
    <h2>{message}</h2>
  </div>

  <div className="player-area">
    <h3>{user?.username} {playerValue > 0 && `(${playerValue})`}</h3>
    <div className="card-container">
      {playerHand.map((card, i) => (
        <Card key={i} card={card} />
      ))}
    </div>
  </div>
</div>

<div className="controls">
  {!gameState && (
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
      {totalBet > 0 && (
        <button onClick={() => setTotalBet(0)} className="btn-action btn-clear">
          Clear Bet
        </button>
      )}
      <button 
        onClick={placeBet} 
        disabled={totalBet === 0}
        className="btn-action"
      >
        Place Bet
      </button>
    </>
  )}

  {gameState === 'playing' && (
    <div className="action-buttons">
      <button onClick={hit} className="btn-action">Hit</button>
      <button onClick={stand} className="btn-action">Stand</button>
      {playerHand.length === 2 && (
        <button onClick={doubleDown} className="btn-action">Double Down</button>
      )}
    </div>
  )}
</div>
      </div>
    </GameLayout>
  );
}

export default BlackjackGame;
