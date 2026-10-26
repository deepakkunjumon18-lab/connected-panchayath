import React, { forwardRef } from 'react';

const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    helperText,
    required = false,
    rows = 3,
    className = '',
    id,
    ...props
  },
  ref
) {
  const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-ink mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-slate-400 transition duration-150 focus:outline-none focus:ring-4 focus:border-primary-500 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-muted disabled:cursor-not-allowed ${
          error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-line'
        } ${className}`}
        {...props}
      />

      {error ? (
        <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-muted">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Textarea;
