import React from 'react';

export default function PageHeader({
  title,
  subtitle,
  actions = null,
  action = null,
  badge = null,
  className = ''
}) {
  const renderedActions = actions || action;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-6 border-b border-line ${className}`}>
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {renderedActions && <div className="flex items-center gap-3 shrink-0">{renderedActions}</div>}
    </div>
  );
}
