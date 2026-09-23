import React from 'react';

export interface PriceDisplayProps {
  price: number;
  currency?: string;
  monthlyPrice?: number;
  annualPrice?: number;
  planType?: 'annual' | 'monthly';
  freePeriodMonths?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PriceDisplay({
  price,
  currency = 'NZD',
  monthlyPrice,
  annualPrice,
  planType = 'monthly',
  freePeriodMonths = 12,
  size = 'md',
  className = '',
}: PriceDisplayProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  const isAnnual = planType === 'annual';
  const displayPrice = isAnnual ? (annualPrice || (monthlyPrice || 0) * 12) : (monthlyPrice || price);
  const priceLabel = isAnnual ? '/yr' : '/mo';

  return (
    <div className={className}>
      <div className="flex items-baseline gap-1">
        <span className={`${sizeClasses[size]} font-bold text-primary-700`}>
          ${displayPrice.toFixed(2)}
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
