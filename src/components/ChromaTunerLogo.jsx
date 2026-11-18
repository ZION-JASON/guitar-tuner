import React from 'react';

const ChromaTunerLogo = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    {/* T: Acoustic tuning fork base & stem */}
    <path
      d="M5.5 11V21M5.5 16H11.5"
      stroke="#f8fafc"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* C: Curved yoke & twin vibrating tines */}
    <path
      d="M26.5 9.5H18A6.5 6.5 0 0 0 18 22.5H26.5"
      stroke="#22d3ee"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default ChromaTunerLogo;
