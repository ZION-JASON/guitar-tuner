import React from 'react';
import './TunerDisplay.css';

const TunerDisplay = ({ note, cents, frequency }) => {
  const rotation = (cents * 180) / 50;
  const inTune = Math.abs(cents) < 5 && note !== '-';

  return (
    <div className={`tuner-container ${inTune ? 'in-tune' : ''}`}>
      <div className="hud-side left">
        <span className="hud-val">{frequency > 0 ? frequency.toFixed(1) : '0.0'}</span>
        <small>HZ</small>
      </div>

      <div className="needle-orbit" style={{ transform: `rotate(${rotation}deg)` }}>
        <div className="laser-needle"></div>
      </div>

      <div className="note-name">{note}</div>

      <div className="hud-side right">
        <span className="hud-val">{Math.round(cents)}</span>
        <small>CENTS</small>
      </div>
    </div>
  );
};

export default TunerDisplay;