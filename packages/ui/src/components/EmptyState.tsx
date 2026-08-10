import React from 'react';
import { Search, AlertCircle } from 'lucide-react';
import type { EmptyStateProps, ErrorStateProps } from '../types';

export function EmptyState({
  icon,
  message,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
        {icon || <Search size={20} className="text-gray-400" />}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">{message}</p>
        {description && (
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm text-primary-600 hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
      <AlertCircle size={16} />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline hover:no-underline">
          Try Again
        </button>
      )}
    </div>
  );
}
