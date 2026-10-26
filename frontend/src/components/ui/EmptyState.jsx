import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  message = 'There are no items to display at this moment.',
  actionLabel = null,
  onAction = null,
  compact = false,
  className = ''
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-6 px-4' : 'py-12 px-6'
      } ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-muted flex items-center justify-center mb-3">
        {Icon && <Icon className="w-6 h-6 stroke-[1.5]" />}
      </div>
      <h4 className="text-base font-semibold text-ink">{title}</h4>
      {message && <p className="text-sm text-muted mt-1 max-w-sm">{message}</p>}
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
