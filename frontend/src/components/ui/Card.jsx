import React from 'react';

export default function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-soft-sm border border-line p-5 md:p-6 transition-all duration-200 ${
        hover ? 'hover:shadow-soft hover:border-slate-300' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
