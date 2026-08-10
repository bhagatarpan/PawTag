import React from 'react';
import type { StatusBadgeProps, BadgeVariant } from '../types';

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  primary: 'bg-primary-100 text-primary-700 border-primary-200',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function StatusBadge({
  label,
  variant,
  icon,
  size = 'sm',
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border ${
        variantClasses[variant]
      } ${sizeClasses[size]}`}
    >
      {icon}
      {label}
    </span>
  );
}
