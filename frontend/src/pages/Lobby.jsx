import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import GameLayout from '../components/GameLayout';
import './Lobby.css';

const GAME_INFO = {
  poker: { name: 'Texas Hold\'em Poker', icon: '🃏', maxPlayers: 10 },
  blackjack: { name: 'Blackjack', icon: '🎴', maxPlayers: 6 },
  roulette: { name: 'Roulette', icon: '🎰', maxPlayers: 7 },
  craps: { name: 'Craps', icon: '🎲', maxPlayers: 12 },
  baccarat: { name: 'Baccarat', icon: '🎯', maxPlayers: 7 }
};

function Lobby() {
  const { gameType } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);

  const gameInfo = GAME_INFO[gameType];

  useEffect(() => {
    // Request lobby information
    socket.getLobby(gameType);

    // Set up event listeners
    socket.on('lobbyUpdate', handleLobbyUpdate);
    socket.on('lobbyTableAdded', handleTableAdded);
    socket.on('lobbyTableUpdated', handleTableUpdated);
    socket.on('lobbyTableRemoved', handleTableRemoved);
    socket.on('tableCreated', handleTableCreated);
    socket.on('error', handleError);

    return () => {
      socket.off('lobbyUpdate', handleLobbyUpdate);
      socket.off('lobbyTableAdded', handleTableAdded);
      socket.off('lobbyTableUpdated', handleTableUpdated);
      socket.off('lobbyTableRemoved', handleTableRemoved);
      socket.off('tableCreated', handleTableCreated);
      socket.off('error', handleError);
    };
  }, [gameType]);

  const handleLobbyUpdate = (data) => {
    if (data.gameType === gameType) {
      setTables(data.tables);
    }
  };

  const handleTableAdded = (data) => {
    if (data.gameType === gameType) {
      setTables(prev => [...prev, data.table]);
    }
  };

  const handleTableUpdated = (data) => {
    if (data.gameType === gameType) {
      setTables(prev => prev.map(table =>
        table.tableId === data.tableId
          ? { ...table, playerCount: data.playerCount, availableSeats: data.availableSeats, seats: data.seats }
          : table
      ));
    }
  };

  const handleTableRemoved = (data) => {
    if (data.gameType === gameType) {
      setTables(prev => prev.filter(table => table.tableId !== data.tableId));

      // If the selected table was removed, deselect it
      if (selectedTable?.tableId === data.tableId) {
        setSelectedTable(null);
        setSelectedSeat(null);
      }
    }
  };

  const handleTableCreated = (data) => {
    // After creating a table, join it automatically
    navigate(`/${gameType}/${data.tableId}`);
  };

  const handleError = (error) => {
    alert(`Error: ${error.message}`);
  };

  const handleCreateTable = () => {
    if (newTableName.trim()) {
      socket.createTable(gameType, newTableName.trim());
      setShowCreateModal(false);
      setNewTableName('');
    }
  };

  const handleSelectTable = (table) => {
    setSelectedTable(table);
    setSelectedSeat(null);
  };

  const handleSelectSeat = (seatIndex) => {
    if (selectedTable && selectedTable.seats[seatIndex] === null) {
      setSelectedSeat(seatIndex);
    }
  };

  const handleJoinTable = () => {
    if (selectedTable && selectedSeat !== null) {
      navigate(`/${gameType}/${selectedTable.tableId}?seat=${selectedSeat}`);
    }
  };

  const handleQuickJoin = (table) => {
    // Auto-join to first available seat
    const firstAvailableSeat = table.seats.findIndex(seat => seat === null);
    if (firstAvailableSeat !== -1) {
      navigate(`/${gameType}/${table.tableId}?seat=${firstAvailableSeat}`);
    }
  };

  return (
    <GameLayout title={`${gameInfo.name} - Lobby`}>
      <div className="lobby-container">
        <div className="lobby-header">
          <h2>{gameInfo.icon} {gameInfo.name} Lobby</h2>
          <div className="lobby-actions">
            <button onClick={() => navigate('/dashboard')} className="btn-secondary">
              Back to Dashboard
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Create New Table
            </button>
          </div>
        </div>

        <div className="lobby-content">
          <div className="tables-list">
            <h3>Available Tables ({tables.length})</h3>
            {tables.length === 0 ? (
              <div className="no-tables">
                <p>No tables available. Create one to get started!</p>
              </div>
            ) : (
              <div className="tables-grid">
                {tables.map(table => (
                  <div
                    key={table.tableId}
                    className={`table-card ${selectedTable?.tableId === table.tableId ? 'selected' : ''}`}
                    onClick={() => handleSelectTable(table)}
                  >
                    <div className="table-card-header">
                      <h4>{table.tableName}</h4>
                      <span className="player-count">
                        {table.playerCount}/{table.maxPlayers}
                      </span>
                    </div>
                    <div className="table-card-body">
                      <p className="available-seats">
                        {table.availableSeats} seat{table.availableSeats !== 1 ? 's' : ''} available
                      </p>
                      {table.availableSeats > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickJoin(table);
                          }}
                          className="btn-quick-join"
                        >
                          Quick Join
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedTable && (
            <div className="table-preview">
              <h3>Table: {selectedTable.tableName}</h3>
              <div className="seats-grid">
                {selectedTable.seats.map((seat, index) => (
                  <div
                    key={index}
                    className={`seat ${seat ? 'occupied' : 'available'} ${selectedSeat === index ? 'selected' : ''}`}
                    onClick={() => handleSelectSeat(index)}
                  >
                    <div className="seat-number">Seat {index + 1}</div>
                    {seat ? (
                      <div className="seat-player">
                        <span className="player-name">{seat.username}</span>
                        <span className="player-balance">${seat.balance?.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="seat-empty">Empty</div>
                    )}
                  </div>
                ))}
              </div>
              {selectedSeat !== null && (
                <button onClick={handleJoinTable} className="btn-join">
                  Join Table at Seat {selectedSeat + 1}
                </button>
              )}
            </div>
          )}
        </div>

        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Create New Table</h3>
              <input
                type="text"
                placeholder="Enter table name..."
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateTable()}
                autoFocus
              />
              <div className="modal-actions">
                <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleCreateTable} className="btn-primary">
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
}

export default Lobby;
