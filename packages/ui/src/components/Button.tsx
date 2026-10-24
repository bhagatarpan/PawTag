import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stack edge-to-edge (mobile sticky CTAs, drawer actions). */
  full?: boolean;
  className?: string;
}

/**
 * Single source of truth for button styling. Use `buttonClassName()` when the
 * control must be a router `<Link>`; use the `Button` component otherwise —
 * never hand-roll teal/gray button classes again.
 * Touch sizes: md ≥44px, lg ≥48px; visible focus ring on every variant.
 */
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  full = false,
  className = '',
}: ButtonClassOptions = {}): string {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
    secondary: 'bg-white text-primary-700 border border-primary-200 hover:bg-primary-50',
    success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  };
  const sizes: Record<ButtonSize, string> = {
    md: 'px-4 py-2.5 text-sm min-h-11',
    lg: 'px-5 py-3.5 text-base min-h-12',
  };
  return [base, variants[variant], sizes[size], full ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  /** Decorative leading icon (lucide element); labels stay real text. */
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, full, className })}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
