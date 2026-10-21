/**
 * Card brand marks (Visa / Mastercard / Amex + generic fallback).
 *
 * Extracted from OrderDetailView so checkout and order surfaces share one
 * implementation. Purely decorative — call sites should mark the SVG
 * aria-hidden and provide the brand as text for assistive tech.
 */

export interface CardBrandIconProps {
  /** Stripe card brand string, e.g. 'visa', 'mastercard', 'amex' */
  brand: string;
  width?: number;
  height?: number;
}

export function CardBrandIcon({ brand, width = 32, height = 20 }: CardBrandIconProps) {
  const b = brand.toLowerCase();
  if (b === 'visa') {
    return (
      <svg viewBox="0 0 48 32" width={width} height={height} className="inline-block" aria-hidden="true">
        <rect width="48" height="32" rx="4" fill="#1A1F71" />
        <text x="24" y="20" textAnchor="middle" fill="#fff" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="700" fontStyle="italic">VISA</text>
      </svg>
    );
  }
  if (b === 'mastercard') {
    return (
      <svg viewBox="0 0 48 32" width={width} height={height} className="inline-block" aria-hidden="true">
        <rect width="48" height="32" rx="4" fill="#252525" />
        <circle cx="19" cy="16" r="9" fill="#EB001B" />
        <circle cx="29" cy="16" r="9" fill="#F79E1B" />
        <path d="M24 9.3a9 9 0 010 13.4 9 9 0 000-13.4z" fill="#FF5F00" />
      </svg>
    );
  }
  if (b === 'amex' || b === 'american_express') {
    return (
      <svg viewBox="0 0 48 32" width={width} height={height} className="inline-block" aria-hidden="true">
        <rect width="48" height="32" rx="4" fill="#006FCF" />
        <text x="24" y="20" textAnchor="middle" fill="#fff" fontFamily="system-ui,sans-serif" fontSize="9" fontWeight="700">AMEX</text>
      </svg>
    );
  }
  // Default: generic card icon
  return (
    <svg viewBox="0 0 48 32" width={width} height={height} className="inline-block" aria-hidden="true">
      <rect width="48" height="32" rx="4" fill="#6B7280" />
      <rect x="4" y="8" width="40" height="4" rx="1" fill="#fff" opacity="0.5" />
      <rect x="4" y="18" width="16" height="3" rx="1" fill="#fff" opacity="0.4" />
    </svg>
  );
}

export default CardBrandIcon;
