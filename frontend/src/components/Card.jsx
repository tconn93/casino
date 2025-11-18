import React from 'react';
import './Card.css';

function Card({ card, hidden }) {
  if (hidden || !card) {
    return <div className="card card-back">🂠</div>;
  }

  const suitSymbols = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div className={`card ${isRed ? 'red' : 'black'}`}>
      <div className="card-rank">{card.rank}</div>
      <div className="card-suit">{suitSymbols[card.suit]}</div>
    </div>
  );
}

export default Card;
