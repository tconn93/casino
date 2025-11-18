import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import api from '../services/api';
import GameLayout from '../components/GameLayout';
import './Game.css';
import './CrapsGame.css';

function CrapsGame() {
  const { tableId } = useParams();
  const location = useLocation();
  const { user, updateBalance } = useAuth();
  const [bets, setBets] = useState([]);
  const [chipValue, setChipValue] = useState(10);
  const [dice, setDice] = useState({ die1: null, die2: null, total: null });
  const [phase, setPhase] = useState('comeOut');
  const [point, setPoint] = useState(null);
  const [message, setMessage] = useState('Place your bets');
  const [rolling, setRolling] = useState(false);
  const [activeBets, setActiveBets] = useState({});
  const [comeBets, setComeBets] = useState([]); // Come bets that have moved to numbers
  const [dontComeBets, setDontComeBets] = useState([]); // Don't Come bets that have moved to numbers

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const seatNumber = searchParams.get('seat') ? parseInt(searchParams.get('seat')) : null;

    socket.joinTable('craps', tableId, 'multiplayer', seatNumber);

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
        setMessage('Bet placed! Add more or roll the dice.');
      }
    } else if (data.type === 'rollComplete') {
      setRolling(false);
      setDice(data.roll);
      setPhase(data.phase);
      setPoint(data.point);

      // Update Come/Don't Come bets
      if (data.comeBets) setComeBets(data.comeBets);
      if (data.dontComeBets) setDontComeBets(data.dontComeBets);

      const myResult = data.playerResults.find(r => r.username === user.username);

      // Update active bets from backend
      if (data.currentBets) {
        const myCurrentBets = data.currentBets.find(cb => cb.socketId === socket.id);
        if (myCurrentBets) {
          setActiveBets(myCurrentBets.bets);
        } else {
          // No active bets for this player
          setActiveBets({});
        }
      }

      // Build color-coded message
      const messageParts = [];

      // Always show the roll in yellow
      messageParts.push({ text: `You rolled ${data.roll.total}`, color: '#ffd700' });

      // Check for bet movements FIRST (Come/Don't Come bets moving to numbers)
      // These should show in yellow and NOT be treated as wins
      if (data.betMovements && data.betMovements.length > 0) {
        const myMovements = data.betMovements.filter(m => m.socketId === socket.id);
        if (myMovements.length > 0) {
          myMovements.forEach(movement => {
            const moveText = movement.type === 'come'
              ? `Come $${movement.amount} moved to ${movement.number}`
              : `Don't Come $${movement.amount} moved to ${movement.number}`;
            messageParts.push({ text: moveText, color: '#ffd700' });
          });
        }
      }

      // Get my bet outcomes
      const myOutcomes = data.betOutcomes?.find(bo => bo.socketId === socket.id)?.outcomes;

      if (myOutcomes) {
        // Show wins in green
        if (myOutcomes.won.length > 0) {
          const wonText = myOutcomes.won.map(bet => {
            const betName = getBetName(bet.type);
            return `${betName} $${bet.amount} WON`;
          }).join(', ');
          messageParts.push({ text: wonText, color: '#51cf66' });
        }

        // Show losses in red
        if (myOutcomes.lost.length > 0) {
          const lostText = myOutcomes.lost.map(bet => {
            const betName = getBetName(bet.type);
            return `${betName} $${bet.amount} LOST`;
          }).join(', ');
          messageParts.push({ text: lostText, color: '#ff6b6b' });
        }
      }

      // Create formatted message
      const formattedMessage = messageParts.map((part, i) => (
        <span key={i} style={{ color: part.color }}>{part.text}{i < messageParts.length - 1 ? ' | ' : ''}</span>
      ));

      setMessage(formattedMessage);

      if (myResult) {
        // Refresh balance from server
        try {
          const balanceData = await api.getBalance();
          updateBalance(balanceData.balance);
        } catch (error) {
          console.error('Failed to update balance:', error);
        }
      }
    }
  };

  const getBetName = (betType) => {
    const betNames = {
      'pass': 'Pass Line',
      'dontPass': 'Don\'t Pass',
      'come': 'Come',
      'dontCome': 'Don\'t Come',
      'field': 'Field',
      'any7': 'Any 7',
      'anyCraps': 'Any Craps',
      'craps2': 'Snake Eyes (2)',
      'craps3': 'Ace Deuce (3)',
      'yo11': 'Yo (11)',
      'craps12': 'Boxcars (12)'
    };

    // Handle place bets
    if (betType.startsWith('place')) {
      return `Place ${betType.replace('place', '')}`;
    }

    // Handle hardways
    if (betType.startsWith('hard')) {
      return `Hard ${betType.replace('hard', '')}`;
    }

    // Handle come bets on numbers
    if (betType.startsWith('come-')) {
      return `Come on ${betType.replace('come-', '')}`;
    }

    // Handle don't come bets on numbers
    if (betType.startsWith('dontcome-')) {
      return `Don't Come on ${betType.replace('dontcome-', '')}`;
    }

    return betNames[betType] || betType;
  };

  const handleError = (error) => {
    setMessage(`Error: ${error.message}`);
    setRolling(false);
  };

const placeBet = (betType, betLabel) => {
  if (chipValue > user.balance) {
    setMessage('Insufficient funds!');
    return;
  }



  socket.gameAction('placeBet', { betType, amount: chipValue });
  setBets(prev => [...prev, { betType, amount: chipValue, label: betLabel, resolved: false }]);

  // Track active bets for visual feedback - only for new bets, persist ongoing
  setActiveBets(prev => ({
    ...prev,
    [betType]: (prev[betType] || 0) + chipValue
  }));
};

  const roll = () => {
    if (bets.length === 0) {
      setMessage('Place at least one bet!');
      return;
    }

    setRolling(true);
    setMessage('Rolling dice...');
    socket.gameAction('roll');
  };

  // Helper to get moved bets for a specific number
  const getMovedBetsForNumber = (number) => {
    const socketId = socket.id;

    const myComeBets = comeBets.filter(b => b.number === number && b.socketId === socketId);
    const myDontComeBets = dontComeBets.filter(b => b.number === number && b.socketId === socketId);

    return { comeBets: myComeBets, dontComeBets: myDontComeBets };
  };

  return (
    <GameLayout title="Craps">
      <div className="game-container">
        <div className="game-info-craps">
          <div className="info-item">
            <div className="label">Phase</div>
            <div className="value">{phase === 'comeOut' ? 'Come Out' : 'Point'}</div>
          </div>
          {point && (
            <div className="info-item">
              <div className="label">Point</div>
              <div className="value point-marker">{point}</div>
            </div>
          )}
          {dice.total && (
            <div className="info-item">
              <div className="label">Last Roll</div>
              <div className="dice-container">
                <div className="die">{dice.die1}</div>
                <div className="die">{dice.die2}</div>
              </div>
              <div className="value">{dice.total}</div>
            </div>
          )}
        </div>

        <div className="message-area">
          <h2>{message}</h2>
        </div>

        <div className="craps-table-container">
          <div className="table-felt">
            {/* Don't Pass Bar (top) */}
            <div className="dont-pass-container">
              {/* <div
                className={`dont-pass-corner ${activeBets['dontPass'] ? 'active' : ''}`}
                onClick={() => placeBet('dontPass', "Don't Pass")}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>DON'T PASS BAR</div>
                {activeBets['dontPass'] > 0 && <div className="bet-chip">${activeBets['dontPass']}</div>}
              </div> */}
              <div
                className={`dont-pass-main ${activeBets['dontPass'] ? 'active' : ''}`}
                onClick={() => placeBet('dontPass', "Don't Pass")}
              >
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>DON'T PASS BAR</div>
                <div style={{ fontSize: '0.85rem', color: '#ddd', marginTop: '5px' }}>Pays 1:1</div>
                {activeBets['dontPass'] > 0 && <div className="bet-chip">${activeBets['dontPass']}</div>}
              </div>
              {/* <div
                className={`dont-pass-corner ${activeBets['dontPass'] ? 'active' : ''}`}
                onClick={() => placeBet('dontPass', "Don't Pass")}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>DON'T PASS BAR</div>
                {activeBets['dontPass'] > 0 && <div className="bet-chip">${activeBets['dontPass']}</div>}
              </div> */}
            </div>

            <div className="craps-layout">
              {/* Left Section - Come & One Roll Bets */}
              <div className="left-section">
                <div
                  className={`come-area ${activeBets['come'] ? 'active' : ''}`}
                  onClick={() => placeBet('come', 'Come')}
                >
                  COME
                  {activeBets['come'] > 0 && <div className="bet-chip">${activeBets['come']}</div>}
                </div>

                <div className="prop-section">
                  <div className="prop-label">ONE ROLL BETS</div>
                  <div className="prop-bets-grid">
                    <div className={`prop-bet-box ${activeBets['any7'] ? 'active' : ''}`} onClick={() => placeBet('any7', 'Any 7')}>
                      <div className="prop-bet-label">Any 7</div>
                      <div className="prop-bet-payout">4:1</div>
                      {activeBets['any7'] > 0 && <div className="bet-chip">${activeBets['any7']}</div>}
                    </div>
                    <div className={`prop-bet-box ${activeBets['anyCraps'] ? 'active' : ''}`} onClick={() => placeBet('anyCraps', 'Any Craps')}>
                      <div className="prop-bet-label">Any Craps</div>
                      <div className="prop-bet-payout">7:1</div>
                      {activeBets['anyCraps'] > 0 && <div className="bet-chip">${activeBets['anyCraps']}</div>}
                    </div>
                    <div className={`prop-bet-box ${activeBets['craps2'] ? 'active' : ''}`} onClick={() => placeBet('craps2', 'Snake Eyes')}>
                      <div className="prop-bet-label">2</div>
                      <div className="prop-bet-payout">30:1</div>
                      {activeBets['craps2'] > 0 && <div className="bet-chip">${activeBets['craps2']}</div>}
                    </div>
                    <div className={`prop-bet-box ${activeBets['craps3'] ? 'active' : ''}`} onClick={() => placeBet('craps3', 'Ace Deuce')}>
                      <div className="prop-bet-label">3</div>
                      <div className="prop-bet-payout">15:1</div>
                      {activeBets['craps3'] > 0 && <div className="bet-chip">${activeBets['craps3']}</div>}
                    </div>
                    <div className={`prop-bet-box ${activeBets['yo11'] ? 'active' : ''}`} onClick={() => placeBet('yo11', 'Yo')}>
                      <div className="prop-bet-label">11 (Yo)</div>
                      <div className="prop-bet-payout">15:1</div>
                      {activeBets['yo11'] > 0 && <div className="bet-chip">${activeBets['yo11']}</div>}
                    </div>
                    <div className={`prop-bet-box ${activeBets['craps12'] ? 'active' : ''}`} onClick={() => placeBet('craps12', 'Boxcars')}>
                      <div className="prop-bet-label">12</div>
                      <div className="prop-bet-payout">30:1</div>
                      {activeBets['craps12'] > 0 && <div className="bet-chip">${activeBets['craps12']}</div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Section - Place Bets & Field */}
              <div className="center-section">
                <div className="place-bets-section-center">
                  <div className="place-bets-label">PLACE BETS</div>
                  <div className="place-numbers-horizontal">
                    {[4, 5, 6, 8, 9, 10].map(number => {
                      const moved = getMovedBetsForNumber(number);
                      const payouts = { 4: '9:5', 5: '7:5', 6: '7:6', 8: '7:6', 9: '7:5', 10: '9:5' };
                      return (
                    <div key={number} className={`place-bet-box-horiz ${activeBets[`place${number}`] ? 'active' : ''} ${point === number ? 'is-point' : ''}`} onClick={() => placeBet(`place${number}`, `Place ${number}`)}>
                      {point === number && <div className="point-puck">ON</div>}
                      <div className="place-number">{number}</div>
                      <div className="place-payout">{payouts[number]}</div>
                      {activeBets[`place${number}`] > 0 && <div className="bet-chip">${activeBets[`place${number}`]}</div>}
                    {moved.comeBets.map((bet, i) => (
                      <div key={`come-${number}-${i}`} className="bet-chip come-bet-chip">
                        ${bet.amount}
                      </div>
                    ))}
                    {moved.dontComeBets.map((bet, i) => (
                      <div key={`dontcome-${number}-${i}`} className="bet-chip dontcome-bet-chip">
                        ${bet.amount}
                      </div>
                    ))}
                    </div>
                      );
                    })}
                  </div>
                </div>

                <div className="field-container" onClick={() => placeBet('field', 'Field')}>
                  <div className="field-label">FIELD</div>
                  <div className="field-numbers-horizontal">
                    <div className="field-number double">2</div>
                    <div className="field-number">3</div>
                    <div className="field-number">4</div>
                    <div className="field-number">9</div>
                    <div className="field-number">10</div>
                    <div className="field-number">11</div>
                    <div className="field-number double">12</div>
                  </div>
                  {activeBets['field'] > 0 && <div className="bet-chip">${activeBets['field']}</div>}
                </div>
              </div>

              {/* Right Section - Don't Come & Hardways */}
              <div className="right-section">
                <div
                  className={`dont-come-area ${activeBets['dontCome'] ? 'active' : ''}`}
                  onClick={() => placeBet('dontCome', "Don't Come")}
                >
                  DON'T COME
                  {activeBets['dontCome'] > 0 && <div className="bet-chip">${activeBets['dontCome']}</div>}
                </div>

                <div className="hardways-section">
                  <div className="hardways-label">HARDWAYS</div>
                  <div className="hardways-grid">
                    <div className={`hardway-box ${activeBets['hard4'] ? 'active' : ''}`} onClick={() => placeBet('hard4', 'Hard 4')}>
                      <div style={{ fontWeight: 700 }}>Hard 4</div>
                      <div style={{ fontSize: '0.8rem' }}>7:1</div>
                      {activeBets['hard4'] > 0 && <div className="bet-chip">${activeBets['hard4']}</div>}
                    </div>
                    <div className={`hardway-box ${activeBets['hard6'] ? 'active' : ''}`} onClick={() => placeBet('hard6', 'Hard 6')}>
                      <div style={{ fontWeight: 700 }}>Hard 6</div>
                      <div style={{ fontSize: '0.8rem' }}>9:1</div>
                      {activeBets['hard6'] > 0 && <div className="bet-chip">${activeBets['hard6']}</div>}
                    </div>
                    <div className={`hardway-box ${activeBets['hard8'] ? 'active' : ''}`} onClick={() => placeBet('hard8', 'Hard 8')}>
                      <div style={{ fontWeight: 700 }}>Hard 8</div>
                      <div style={{ fontSize: '0.8rem' }}>9:1</div>
                      {activeBets['hard8'] > 0 && <div className="bet-chip">${activeBets['hard8']}</div>}
                    </div>
                    <div className={`hardway-box ${activeBets['hard10'] ? 'active' : ''}`} onClick={() => placeBet('hard10', 'Hard 10')}>
                      <div style={{ fontWeight: 700 }}>Hard 10</div>
                      <div style={{ fontSize: '0.8rem' }}>7:1</div>
                      {activeBets['hard10'] > 0 && <div className="bet-chip">${activeBets['hard10']}</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pass Line (bottom) */}
            <div className="pass-line-container">
              <div></div>
              {/* <div
                className={`pass-line-corner ${activeBets['pass'] ? 'active' : ''}`}
                onClick={() => placeBet('pass', 'Pass Line')}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffd700' }}>PASS LINE</div>
                {activeBets['pass'] > 0 && <div className="bet-chip">${activeBets['pass']}</div>}
              </div> */}
              <div
                className={`pass-line-main ${activeBets['pass'] ? 'active' : ''}`}
                onClick={() => placeBet('pass', 'Pass Line')}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffd700' }}>PASS LINE</div>
                <div style={{ fontSize: '0.9rem', color: '#fff', marginTop: '5px' }}>Pays 1:1</div>
                {activeBets['pass'] > 0 && <div className="bet-chip">${activeBets['pass']}</div>}
              </div>
              {/* <div
                className={`pass-line-corner ${activeBets['pass'] ? 'active' : ''}`}
                onClick={() => placeBet('pass', 'Pass Line')}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffd700' }}>PASS LINE</div>
                {activeBets['pass'] > 0 && <div className="bet-chip">${activeBets['pass']}</div>}
              </div> */}
              <div></div>
            </div>

            {Object.keys(activeBets).length > 0 && (
              <div className="your-bets">
                <h3>Your Active Bets:</h3>
                {Object.entries(activeBets).map(([betType, amount]) => (
                  <span key={betType} className="bet-chip">
                    {getBetName(betType)}: ${amount}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="controls">
          <div className="chip-selector">
            <label>Select Chip:</label>
            <div className={`chip-option ${chipValue === 5 ? 'selected' : ''}`} onClick={() => setChipValue(5)} data-value="5">$5</div>
            <div className={`chip-option ${chipValue === 10 ? 'selected' : ''}`} onClick={() => setChipValue(10)} data-value="10">$10</div>
            <div className={`chip-option ${chipValue === 25 ? 'selected' : ''}`} onClick={() => setChipValue(25)} data-value="25">$25</div>
            <div className={`chip-option ${chipValue === 100 ? 'selected' : ''}`} onClick={() => setChipValue(100)} data-value="100">$100</div>
            <div className={`chip-option ${chipValue === 500 ? 'selected' : ''}`} onClick={() => setChipValue(500)} data-value="500">$500</div>
            <div className={`chip-option ${chipValue === 1000 ? 'selected' : ''}`} onClick={() => setChipValue(1000)} data-value="1000">$1000</div>
          </div>

          <button onClick={roll} disabled={rolling || bets.length === 0} className="btn-action">
            {rolling ? 'Rolling...' : 'Roll Dice'}
          </button>

          {Object.keys(activeBets).length > 0 && (
            <button
              onClick={() => {
                setBets([]);
                setMessage('Note: Can only clear bets before rolling. Ongoing bets will continue.');
              }}
              className="btn-action btn-clear"
            >
              Clear New Bets
            </button>
          )}
        </div>
      </div>
    </GameLayout>
  );
}

export default CrapsGame;
