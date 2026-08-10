import React from 'react';
import { X } from 'lucide-react';
import type { FilterChipsProps } from '../types';

export function FilterChips({
  chips,
  onRemove,
  onClearAll,
  clearLabel = 'Clear All',
}: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200"
        >
          {chip.label}
          <button
            onClick={() => onRemove(chip.key)}
            className="hover:bg-primary-200 rounded-full p-0.5 transition-colors"
            aria-label={`Remove filter: ${chip.label}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
}
