import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(function Select(
  {
    label,
    error,
    helperText,
    required = false,
    options = [],
    placeholder = 'Select an option',
    className = '',
    id,
    children,
    ...props
  },
  ref
) {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-ink mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`w-full appearance-none bg-white border rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-ink transition duration-150 focus:outline-none focus:ring-4 focus:border-primary-500 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-muted disabled:cursor-not-allowed ${
            error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-line'
          } ${className}`}
          {...props}
        >
          {placeholder && !options.some((opt) => (typeof opt === 'object' ? opt.value === '' : opt === '')) && (
            <option value="">{placeholder}</option>
          )}
          {children ||
            options.map((opt) => {
              const val = typeof opt === 'object' ? opt.value : opt;
              const lbl = typeof opt === 'object' ? opt.label : opt;
              return (
                <option key={val} value={val}>
                  {lbl}
                </option>
              );
            })}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-muted">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Select;
