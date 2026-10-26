import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    required = false,
    type = 'text',
    icon: Icon = null,
    className = '',
    id,
    ...props
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-ink mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-slate-400 transition duration-150 focus:outline-none focus:ring-4 focus:border-primary-500 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-muted disabled:cursor-not-allowed ${
            Icon ? 'pl-10' : ''
          } ${isPassword ? 'pr-10' : ''} ${
            error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-line'
          } ${className}`}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-ink focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-muted">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Input;
