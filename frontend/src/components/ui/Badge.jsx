import React from 'react';

export default function Badge({
  children,
  variant = 'neutral', // 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral'
  size = 'md',        // 'sm' | 'md'
  icon: Icon = null,
  className = ''
}) {
  const variantStyles = {
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-[#DCFCE7] text-[#15803D]',
    warning: 'bg-[#FEF3C7] text-[#B45309]',
    danger: 'bg-[#FEE2E2] text-[#B91C1C]',
    info: 'bg-[#DBEAFE] text-[#1D4ED8]',
    purple: 'bg-[#EDE9FE] text-[#6D28D9]',
    neutral: 'bg-[#F1F5F9] text-[#475569]'
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5'
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${
        sizeStyles[size] || sizeStyles.md
      } ${variantStyles[variant] || variantStyles.neutral} ${className}`}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{children}</span>
    </span>
  );
}
