import React from 'react';
import EmptyState from './EmptyState';
import Spinner from './Spinner';

export default function Table({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  emptyTitle = 'No data available',
  emptyIcon = null,
  onRowClick = null,
  rowClassName = null,
  className = ''
}) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-line ${className}`}>
      <table className="w-full text-left text-sm text-ink border-collapse">
        <thead className="bg-slate-50/80 text-xs font-semibold text-muted uppercase tracking-wider border-b border-line">
          <tr>
            {columns.map((col, idx) => {
              const thKey = typeof col.key === 'string'
                ? col.key
                : typeof col.accessor === 'string'
                ? col.accessor
                : (col.title || col.header || idx);
              return (
                <th
                  key={thKey}
                  className={`py-3.5 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.headerClassName || ''}`}
                >
                  {col.title || col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-muted">
                <Spinner size="md" className="mx-auto mb-2 text-primary-600" />
                <p className="text-xs">Loading records...</p>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center">
                <EmptyState
                  title={emptyTitle}
                  message={emptyMessage}
                  icon={emptyIcon}
                  compact
                />
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => {
              const customRowClass = typeof rowClassName === 'function' ? rowClassName(row, rowIdx) : (rowClassName || '');
              const rowKey = row.log_id
                ? `log-${row.log_id}`
                : row.verification_id
                ? `vr-${row.verification_id}`
                : row.certificate_id
                ? `cert-${row.certificate_id}`
                : row.application_id
                ? `app-${row.application_id}`
                : row.panchayat_id && !row.user_id
                ? `panch-${row.panchayat_id}`
                : row.user_id
                ? `user-${row.user_id}`
                : row.master_id
                ? `master-${row.master_id}`
                : row.id
                ? `id-${row.id}`
                : `row-${rowIdx}`;

              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors duration-100 ${
                    customRowClass || (onRowClick ? 'cursor-pointer hover:bg-slate-50/80' : 'hover:bg-slate-50/40')
                  }`}
                >
                  {columns.map((col, colIdx) => {
                    const fieldKey = typeof col.key === 'string'
                      ? col.key
                      : typeof col.accessor === 'string'
                      ? col.accessor
                      : null;

                    let val;
                    if (typeof col.render === 'function') {
                      val = col.render(fieldKey ? row[fieldKey] : row, row, rowIdx);
                    } else if (typeof col.accessor === 'function') {
                      val = col.accessor(row, rowIdx);
                    } else if (fieldKey) {
                      val = row[fieldKey];
                    }

                    const tdKey = fieldKey || col.title || col.header || colIdx;

                    return (
                      <td
                        key={tdKey}
                        className={`py-3.5 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.cellClassName || ''}`}
                      >
                        {val !== undefined && val !== null ? val : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
