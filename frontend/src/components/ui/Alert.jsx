import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function Alert({
  type = 'info', // 'success' | 'warning' | 'danger' | 'info'
  title,
  children,
  onClose = null,
  className = ''
}) {
  const styles = {
    success: {
      container: 'bg-[#DCFCE7]/70 border-[#86EFAC] text-[#15803D]',
      icon: CheckCircle2
    },
    warning: {
      container: 'bg-[#FEF3C7]/70 border-[#FDE68A] text-[#B45309]',
      icon: AlertTriangle
    },
    danger: {
      container: 'bg-[#FEE2E2]/70 border-[#FCA5A5] text-[#B91C1C]',
      icon: AlertCircle
    },
    info: {
      container: 'bg-[#DBEAFE]/70 border-[#93C5FD] text-[#1D4ED8]',
      icon: Info
    }
  };

  const current = styles[type] || styles.info;
  const Icon = current.icon;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${current.container} ${className}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <h5 className="font-semibold mb-0.5">{title}</h5>}
        <div className="leading-relaxed opacity-95">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-black/5 rounded-lg transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
