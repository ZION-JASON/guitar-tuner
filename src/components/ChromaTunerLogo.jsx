import React from 'react';

const ChromaTunerLogo = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    {/* T: Machined tuning fork base & stem */}
    <path
      d="M5 10.5V21.5M5 16H11.5"
      stroke="#f8fafc"
      strokeWidth="2.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
    {/* C: Angular geometric yoke & twin tines */}
    <path
      d="M27 9.5H16.5L13 13V19L16.5 22.5H27"
      stroke="#22d3ee"
      strokeWidth="2.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
  </svg>
);

export default ChromaTunerLogo;
