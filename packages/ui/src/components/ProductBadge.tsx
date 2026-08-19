import React from 'react';

export interface ProductBadgeProps {
  label: string;
  variant?: 'essential' | 'popular' | 'premium' | 'primary' | 'success' | 'warning' | 'error';
  className?: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  essential: 'bg-blue-100 text-blue-700',
  popular: 'bg-amber-100 text-amber-700',
  premium: 'bg-purple-100 text-purple-700',
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
};

export function ProductBadge({ label, variant = 'primary', className = '' }: ProductBadgeProps) {
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {label}
    </span>
  );
}

export function getProductBadgeVariant(sku: string): { label: string; variant: ProductBadgeProps['variant'] } | null {
  const badges: Record<string, { label: string; variant: ProductBadgeProps['variant'] }> = {
    'PT-SCAN-001': { label: 'Essential', variant: 'essential' },
    'PT-CLASSIC-001': { label: 'Most Ordered', variant: 'popular' },
    'PT-PLUS-001': { label: 'Premium', variant: 'premium' },
  };
  return badges[sku] || null;
}
