import { CardBrandIcon } from './CardBrandIcon';

/**
 * "We accept" row for the payment step: Visa, Mastercard and American
 * Express marks with a plain-text label.
 *
 * The icons are decorative (aria-hidden); the brand names are always
 * available to assistive tech via the visible text. Server-side, PawTag
 * only offers `card` payment methods (see PAWTAG_PAYMENT_METHOD_TYPES),
 * and Stripe accepts all three brands under that single type.
 */

const ACCEPTED_BRANDS = [
  { brand: 'visa', label: 'Visa' },
  { brand: 'mastercard', label: 'Mastercard' },
  { brand: 'amex', label: 'American Express' },
] as const;

export interface AcceptedCardsProps {
  className?: string;
}

export function AcceptedCards({ className = '' }: AcceptedCardsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 ${className}`}>
      <span>We accept</span>
      <span className="flex items-center gap-2" aria-hidden="true">
        {ACCEPTED_BRANDS.map(({ brand }) => (
          <CardBrandIcon key={brand} brand={brand} width={32} height={20} />
        ))}
      </span>
      <span className="sr-only">Visa, Mastercard and American Express</span>
    </div>
  );
}

export default AcceptedCards;
