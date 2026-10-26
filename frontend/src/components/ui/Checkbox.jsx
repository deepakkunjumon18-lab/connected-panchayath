import React, { forwardRef } from 'react';

const Checkbox = forwardRef(function Checkbox(
  {
    label,
    description,
    error,
    className = '',
    id,
    ...props
  },
  ref
) {
  const checkboxId = id || (label ? `cb-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`flex items-start ${className}`}>
      <div className="flex items-center h-5">
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className="w-4 h-4 text-primary-600 bg-white border-line rounded focus:ring-primary-500 focus:ring-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          {...props}
        />
      </div>
      {label && (
        <div className="ml-2.5 text-sm">
          <label htmlFor={checkboxId} className="font-medium text-ink cursor-pointer select-none">
            {label}
          </label>
          {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
          {error && <p className="text-xs text-red-600 font-medium mt-0.5">{error}</p>}
        </div>
      )}
    </div>
  );
});

export default Checkbox;
