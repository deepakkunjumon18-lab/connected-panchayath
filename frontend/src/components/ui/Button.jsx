import React from 'react';
import Spinner from './Spinner';

export default function Button({
  children,
  type = 'button',
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size = 'md',        // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  icon: Icon = null,
  iconPosition = 'left',
  className = '',
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-5 py-3 gap-2.5'
  };

  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-soft-sm focus:ring-primary-100 active:bg-primary-800',
    secondary: 'bg-white border border-line text-ink hover:bg-slate-50 focus:ring-primary-100 shadow-soft-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-soft-sm focus:ring-red-100 active:bg-red-800',
    ghost: 'text-muted hover:text-ink hover:bg-slate-100 focus:ring-slate-100',
    outline: 'border border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-100'
  };

  const isActuallyDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isActuallyDisabled}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
      {...props}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} color={variant === 'secondary' || variant === 'ghost' ? 'text-primary-600' : 'text-white'} />
      ) : (
        Icon && iconPosition === 'left' && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
      )}
      <span>{children}</span>
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
      )}
    </button>
  );
}
