/**
 * Robust formatting utility for Connected Panchayat frontend.
 * Guards against null, undefined, NaN, and invalid dates.
 */

export function formatDate(val, options = {}) {
  if (!val) return options.fallback || '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return options.fallback || '—';

  const defaultOpts = {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  };

  return d.toLocaleDateString('en-IN', { ...defaultOpts, ...options });
}

export function formatDateTime(val, options = {}) {
  if (!val) return options.fallback || '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return options.fallback || '—';

  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
}

export function formatCurrency(val, fallback = '₹0') {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  if (isNaN(num)) return fallback;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
}

export function formatNumber(val, fallback = '0') {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  if (isNaN(num)) return fallback;

  return new Intl.NumberFormat('en-IN').format(num);
}
