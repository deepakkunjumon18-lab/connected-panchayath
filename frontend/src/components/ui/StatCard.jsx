import React from 'react';
import Card from './Card';

export default function StatCard({
  title,
  value,
  caption,
  icon: Icon,
  variant = 'primary', // 'primary' | 'success' | 'warning' | 'purple' | 'danger'
  trend = null,        // { label: string, positive?: boolean }
  onClick = null,
  className = ''
}) {
  const iconVariants = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-[#DCFCE7] text-[#15803D]',
    warning: 'bg-[#FEF3C7] text-[#B45309]',
    purple: 'bg-[#EDE9FE] text-[#6D28D9]',
    danger: 'bg-[#FEE2E2] text-[#B91C1C]'
  };

  return (
    <Card
      onClick={onClick}
      className={`transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-soft' : ''} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-ink mt-2">{value}</h3>
          {caption && <p className="text-xs text-muted mt-1">{caption}</p>}
          {trend && (
            <p className={`text-xs font-medium mt-2 flex items-center gap-1 ${trend.positive ? 'text-green-600' : 'text-slate-500'}`}>
              <span>{trend.label}</span>
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              iconVariants[variant] || iconVariants.primary
            }`}
          >
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </Card>
  );
}
