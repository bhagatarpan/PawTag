import React from 'react';

export interface PriceDisplayProps {
  price: number;
  currency?: string;
  monthlyPrice?: number;
  freePeriodMonths?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PriceDisplay({
  price,
  currency = 'NZD',
  monthlyPrice,
  freePeriodMonths = 12,
  size = 'md',
  className = '',
}: PriceDisplayProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  return (
    <div className={className}>
      <div className="flex items-baseline gap-1">
        <span className={`${sizeClasses[size]} font-bold text-primary-700`}>
          ${price.toFixed(2)}
        </span>
        <span className="text-sm text-gray-500">{currency}</span>
      </div>
      {monthlyPrice != null && monthlyPrice > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          + ${monthlyPrice.toFixed(2)}/mo after {freePeriodMonths} months free
        </p>
      )}
    </div>
  );
}
