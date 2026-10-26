import React, { useState } from 'react';

export default function Tooltip({ text, children, position = 'top', className = '' }) {
  const [visible, setVisible] = useState(false);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && text && (
        <div
          className={`absolute z-50 whitespace-nowrap px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-lg shadow-lg pointer-events-none transition-all duration-150 animate-fadeIn ${positionStyles[position] || positionStyles.top}`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
