import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import api from '../services/api';
import GameLayout from '../components/GameLayout';
import Card from '../components/Card';
import './Game.css';

function PokerGame() {
  const { tableId } = useParams();
  const { user, updateBalance } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myHand, setMyHand] = useState([]);
  const [communityCards, setCommunityCards] = useState([]);
  const [pot, setPot] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);
  const [round, setRound] = useState('');
  const [betAmount, setBetAmount] = useState(10);
  const [message, setMessage] = useState('Waiting for players...');
  const [canStart, setCanStart] = useState(false);

  useEffect(() => {
    socket.joinTable('poker', tableId, 'multiplayer');

    socket.on('tableUpdate', handleTableUpdate);
    socket.on('gameUpdate', handleGameUpdate);
    socket.on('error', handleError);

    return () => {
      socket.off('tableUpdate', handleTableUpdate);
      socket.off('gameUpdate', handleGameUpdate);
      socket.off('error', handleError);
      socket.leaveTable();
    };
  }, [tableId]);

  const handleTableUpdate = (data) => {
    console.log('Table update:', data);
    setPlayers(data.players);
    setCanStart(data.players.length >= 2);
    if (data.players.length < 2) {
      setMessage('Waiting for more players... (Need at least 2)');
    } else if (!gameState) {
      setMessage('Ready to start! Click "Start Game"');
    }
  };

  const handleGameUpdate = async (data) => {
    console.log('Game update:', data);

    if (data.type === 'gameStarted') {
      const myPlayer = data.players.find(p => p.username === user.username);
      if (myPlayer) {
        setMyHand(myPlayer.hand);
      }
      setPot(data.pot);
      setCurrentBet(data.currentBet);
      setMessage('Game started! Place your bets.');
      setGameState('playing');
    } else if (data.type === 'actionProcessed') {
      setPot(data.pot);
      setCurrentBet(data.currentBet);
      setRound(data.round);
      setCommunityCards(data.communityCards || []);
      setMessage(`${data.player} ${data.action}. Your turn!`);
    } else if (data.type === 'gameEnded') {
      setCommunityCards(data.communityCards || []);

      if (data.winners) {
        const isWinner = data.winners.some(w => w === user.username);
        if (isWinner) {
          setMessage(`You win $${data.winAmount.toFixed(2)}!`);
        } else {
          setMessage(`${data.winners.join(', ')} wins!`);
        }
      } else if (data.winner === user.username) {
        setMessage(`You win $${data.winAmount.toFixed(2)}!`);
      } else {
        setMessage(`${data.winner} wins!`);
      }

      // Refresh balance from server
      try {
        const balanceData = await api.getBalance();
        updateBalance(balanceData.balance);
      } catch (error) {
        console.error('Failed to update balance:', error);
      }

      setTimeout(() => {
        setGameState(null);
        setMyHand([]);
        setCommunityCards([]);
        setPot(0);
        setMessage('Ready for next game!');
      }, 5000);
    }
  };

  const handleError = (error) => {
    setMessage(`Error: ${error.message}`);
  };

  const startGame = () => {
    socket.gameAction('startGame');
  };

  const performAction = (action, amount = null) => {
    socket.gameAction(action, amount ? { amount } : {});
  };

  return (
    <GameLayout title="Texas Hold'em Poker">
      <div className="game-container">
        <div className="game-area">
          <div className="poker-table">
            <div className="pot-display">
              <h3>Pot: ${pot.toFixed(2)}</h3>
              {currentBet > 0 && <p>Current Bet: ${currentBet.toFixed(2)}</p>}
              {round && <p>Round: {round}</p>}
            </div>

            <div className="community-cards">
              <h3>Community Cards:</h3>
              <div className="card-container">
                {communityCards.map((card, i) => (
                  <Card key={i} card={card} />
                ))}
              </div>
            </div>

            <div className="message-area">
              <h2>{message}</h2>
            </div>

            <div className="player-area">
              <h3>Your Hand:</h3>
              <div className="card-container">
                {myHand.map((card, i) => (
                  <Card key={i} card={card} />
                ))}
              </div>
            </div>
          </div>

          <div className="players-list">
            {players.map((player, i) => (
              <div key={i} className="player-info">
                <h4>{player.username}</h4>
                <p>Balance: ${typeof player.balance === 'number' ? player.balance.toFixed(2) : '0.00'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="controls">
          {!gameState && canStart && (
            <button onClick={startGame} className="btn-action">Start Game</button>
          )}

          {gameState === 'playing' && (
            <>
              <div className="bet-controls">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  min={currentBet + 1}
                  max={user?.balance || 0}
                />
              </div>
              <div className="action-buttons">
                <button onClick={() => performAction('fold')} className="btn-action">Fold</button>
                <button onClick={() => performAction('check')} className="btn-action">Check</button>
                <button onClick={() => performAction('call')} className="btn-action">Call</button>
                <button onClick={() => performAction('bet', betAmount)} className="btn-action">Bet</button>
                <button onClick={() => performAction('raise', betAmount)} className="btn-action">Raise</button>
              </div>
            </>
          )}
        </div>
      </div>
    </GameLayout>
  );
}

export default PokerGame;
