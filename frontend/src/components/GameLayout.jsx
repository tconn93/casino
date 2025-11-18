import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './GameLayout.css';

function GameLayout({ title, children, balance }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="game-layout">
      <header className="game-header">
        <button onClick={() => navigate('/dashboard')} className="btn-back">← Back to Lobby</button>
        <h1>{title}</h1>
        <div className="balance-display">
          Balance: ${balance !== undefined ? balance.toFixed(2) : user?.balance?.toFixed(2) || '0.00'}
        </div>
      </header>
      <div className="game-content">
        {children}
      </div>
    </div>
  );
}

export default GameLayout;
