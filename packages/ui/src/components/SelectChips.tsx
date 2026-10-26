export interface SelectChipOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SelectChipsProps<T extends string = string> {
  options: ReadonlyArray<SelectChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the chip group (e.g. "Filter activity"). */
  ariaLabel?: string;
  className?: string;
}

/**
 * Single-select chip row (concept boards: All / Orders / Pets / Account).
 * Buttons expose `aria-pressed` for screen readers; the row scrolls
 * horizontally on phones instead of wrapping into dense stacks.
 * Distinct from `FilterChips`, which renders removable filter tokens.
 */
export function SelectChips<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SelectChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-11 shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1 ${
              selected
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-700'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
