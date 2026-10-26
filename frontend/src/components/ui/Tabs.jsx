import React from 'react';

export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  tabClassName = ''
}) {
  return (
    <div className={`flex border-b border-line gap-2 overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const id = typeof tab === 'object' ? tab.id : tab;
        const label = typeof tab === 'object' ? tab.label : tab;
        const count = typeof tab === 'object' ? tab.count : undefined;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition duration-150 whitespace-nowrap -mb-[2px] ${
              isActive
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-muted hover:text-ink hover:border-slate-300'
            } ${tabClassName}`}
          >
            <span>{label}</span>
            {count !== undefined && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  isActive
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-slate-100 text-muted'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
