import React from 'react';
import type { SummaryCardData } from '../types';

const colorClasses: Record<string, string> = {
  default: '',
  primary: 'text-primary-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  danger: 'text-red-500',
};

function SummaryCard({ label, value, icon, onClick, clickable, color = 'default' }: SummaryCardData) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm transition-colors ${
        clickable ? 'cursor-pointer hover:border-primary-300 hover:bg-primary-50/30' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        <span className={colorClasses[color]}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {value === undefined ? (
          <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
        ) : (
          value.toLocaleString()
        )}
      </div>
    </div>
  );
}

export function SummaryCards({ cards }: { cards: SummaryCardData[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <SummaryCard key={i} {...card} />
      ))}
    </div>
  );
}
