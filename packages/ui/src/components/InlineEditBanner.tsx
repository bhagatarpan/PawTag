import React from 'react';
import { X } from 'lucide-react';

export interface InlineEditBannerProps {
  /** Icon displayed on the left */
  icon: React.ReactNode;
  /** Bold label text (e.g., "Pet name", "PAWTAG10") */
  label: string;
  /** Description text (e.g., "Buddy", "applied — saved NZ$4.10") */
  description?: string;
  /** Color variant — follows DESIGN.md alert tokens */
  variant?: 'success' | 'info' | 'warning';
  /** Called when Remove is clicked */
  onRemove?: () => void;
  /** Called when the banner body is clicked (for expand/collapse) */
  onExpand?: () => void;
  /** Whether the banner is expanded to show children */
  expanded?: boolean;
  /** Content shown when expanded (text inputs, etc.) */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

const variantStyles = {
  success: {
    banner: 'bg-green-50 border border-green-200',
    icon: 'text-green-600',
    label: 'text-green-700',
    description: 'text-green-600',
  },
  info: {
    banner: 'bg-blue-50 border border-blue-200',
    icon: 'text-blue-600',
    label: 'text-blue-700',
    description: 'text-blue-600',
  },
  warning: {
    banner: 'bg-amber-50 border border-amber-200',
    icon: 'text-amber-600',
    label: 'text-amber-700',
    description: 'text-amber-600',
  },
};

export function InlineEditBanner({
  icon,
  label,
  description,
  variant = 'success',
  onRemove,
  onExpand,
  expanded = false,
  children,
  className = '',
}: InlineEditBannerProps) {
  const styles = variantStyles[variant];

  return (
    <div className={`${styles.banner} rounded-lg ${className}`}>
      <div
        className={`flex items-center justify-between text-sm p-3 ${onExpand ? 'cursor-pointer' : ''}`}
        onClick={onExpand}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={styles.icon}>{icon}</span>
          <span className={`font-medium ${styles.label}`}>{label}</span>
          {description && (
            <span className={`${styles.description} truncate`}>{description}</span>
          )}
        </div>
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-xs text-gray-500 hover:text-red-500 font-medium ml-2 shrink-0"
          >
            Remove
          </button>
        )}
      </div>
      {expanded && children && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}
