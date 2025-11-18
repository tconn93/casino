import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Dashboard.css';

function Dashboard() {
  const { user, logout, loadUser } = useAuth();
  const [stats, setStats] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const profile = await api.getProfile();
      setStats(profile.stats || []);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const games = [
    { id: 'poker', name: 'Texas Hold\'em Poker', icon: '🃏', color: '#e74c3c' },
    { id: 'blackjack', name: 'Blackjack', icon: '🎴', color: '#3498db' },
    { id: 'roulette', name: 'Roulette', icon: '🎰', color: '#2ecc71' },
    { id: 'craps', name: 'Craps', icon: '🎲', color: '#f39c12' },
    { id: 'baccarat', name: 'Baccarat', icon: '🎯', color: '#9b59b6' }
  ];

  const handleAddFunds = async () => {
    const amount = prompt('Enter amount to add:');
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
      try {
        await api.addFunds(parseFloat(amount));
        await loadUser();
      } catch (error) {
        alert('Failed to add funds: ' + error.message);
      }
    }
  };

  const handleJoinGame = (gameId) => {
    navigate(`/lobby/${gameId}`);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Casino</h1>
        <div className="user-info">
          <span className="username">{user?.username}</span>
          <span className="balance">${user?.balance?.toFixed(2) || '0.00'}</span>
          <button onClick={handleAddFunds} className="btn-add-funds">Add Funds</button>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="games-section">
          <h2>Select a Game</h2>
          <div className="games-grid">
            {games.map(game => (
              <div
                key={game.id}
                className="game-card"
                style={{ borderColor: game.color }}
                onClick={() => handleJoinGame(game.id)}
              >
                <div className="game-icon" style={{ color: game.color }}>{game.icon}</div>
                <h3>{game.name}</h3>
                <button className="btn-play" style={{ background: game.color }}>Play Now</button>
              </div>
            ))}
          </div>
        </section>

        {stats.length > 0 && (
          <section className="stats-section">
            <h2>Your Stats</h2>
            <div className="stats-grid">
              {stats.map(stat => (
                <div key={stat.game_type} className="stat-card">
                  <h3>{stat.game_type}</h3>
                  <div className="stat-item">
                    <span>Total Games:</span>
                    <span>{stat.total_games}</span>
                  </div>
                  <div className="stat-item">
                    <span>Won:</span>
                    <span className="win">{stat.games_won}</span>
                  </div>
                  <div className="stat-item">
                    <span>Lost:</span>
                    <span className="loss">{stat.games_lost}</span>
                  </div>
                  <div className="stat-item">
                    <span>Win Rate:</span>
                    <span>{((stat.games_won / stat.total_games) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="stat-item">
                    <span>Total Wagered:</span>
                    <span>${stat.total_wagered.toFixed(2)}</span>
                  </div>
                  <div className="stat-item">
                    <span>Total Won:</span>
                    <span className="win">${stat.total_winnings.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
