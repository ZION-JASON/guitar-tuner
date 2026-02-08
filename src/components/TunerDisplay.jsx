import React from 'react';
import './TunerDisplay.css'; // We'll define the needle movement here

const TunerDisplay = ({ note, cents, frequency }) => {
  // Map -50/50 cents to -90deg/90deg rotation
  const rotation = (cents * 90) / 50;
  
  // Determine if we are "in tune" (within 5 cents of perfect)
  const inTune = Math.abs(cents) < 5 && note !== '-';

  return (
    <div className="tuner-container">
      <div className="frequency-readout">{frequency.toFixed(1)} Hz</div>
      
      <div className={`note-display ${inTune ? 'success' : ''}`}>
        {note}
      </div>

      <div className="gauge">
        <div 
          className="needle" 
          style={{ transform: `rotate(${rotation}deg)` }}
        ></div>
        <div className="center-dot"></div>
      </div>
      
      <div className="cents-display">
        {cents > 0 ? `+${cents}` : cents} cents
      </div>
    </div>
  );
};

export default TunerDisplay;