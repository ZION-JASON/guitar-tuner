import React from 'react';

const ChromaTunerLogo = ({ className = 'w-6 h-6', pixel = false }) => {
  if (pixel) {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        shapeRendering="crispEdges"
        aria-hidden="true"
        className={className}
      >
        {/* Pixelated T tuning fork handle & crossbar */}
        <rect x="2" y="4" width="2" height="8" fill="#f8fafc" />
        <rect x="4" y="7" width="3" height="2" fill="#f8fafc" />
        {/* Pixelated C yoke & twin tines */}
        <rect x="7" y="5" width="2" height="6" fill="#22d3ee" />
        <rect x="9" y="3" width="5" height="2" fill="#22d3ee" />
        <rect x="9" y="11" width="5" height="2" fill="#22d3ee" />
      </svg>
    );
  }

  return (
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
};

export default ChromaTunerLogo;
