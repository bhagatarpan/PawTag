import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Check, CheckCircle, BadgeCheck, ShieldCheck, Shield,
  Truck, Package, Clock, RefreshCw, MapPin,
  Star, Award, Zap, Target, Heart,
  Phone, Mail, MessageSquare, Bell, Send,
  Tag, ShoppingCart, CreditCard, Gift, Percent,
  Eye, Lock, Key, Leaf, Flame,
  Compass, Sparkles, PawPrint, Home, User,
  Settings, Activity, Info, Globe, BarChart3,
  FileText, Users, ClipboardList, ShoppingBag,
  Headphones, Wallet, Receipt, Search,
  type LucideIcon,
} from 'lucide-react';
import type { IconPickerProps } from '../types';

/* ------------------------------------------------------------------ */
/*  Icon Registry — curated set organized by category                  */
/* ------------------------------------------------------------------ */

interface IconEntry {
  name: string;
  label: string;
  Icon: LucideIcon;
  category: string;
}

const ICON_REGISTRY: IconEntry[] = [
  // Shipping & Delivery
  { name: 'Truck', label: 'Truck', Icon: Truck, category: 'Shipping' },
  { name: 'Package', label: 'Package', Icon: Package, category: 'Shipping' },
  { name: 'Clock', label: 'Clock', Icon: Clock, category: 'Shipping' },
  { name: 'RefreshCw', label: 'Refresh', Icon: RefreshCw, category: 'Shipping' },
  { name: 'MapPin', label: 'Map Pin', Icon: MapPin, category: 'Shipping' },
  { name: 'Headphones', label: 'Support', Icon: Headphones, category: 'Shipping' },

  // Quality & Trust
  { name: 'Shield', label: 'Shield', Icon: Shield, category: 'Quality' },
  { name: 'ShieldCheck', label: 'Shield Check', Icon: ShieldCheck, category: 'Quality' },
  { name: 'Check', label: 'Check', Icon: Check, category: 'Quality' },
  { name: 'CheckCircle', label: 'Check Circle', Icon: CheckCircle, category: 'Quality' },
  { name: 'BadgeCheck', label: 'Badge Check', Icon: BadgeCheck, category: 'Quality' },
  { name: 'Star', label: 'Star', Icon: Star, category: 'Quality' },
  { name: 'Award', label: 'Award', Icon: Award, category: 'Quality' },

  // Communication
  { name: 'Phone', label: 'Phone', Icon: Phone, category: 'Communication' },
  { name: 'Mail', label: 'Mail', Icon: Mail, category: 'Communication' },
  { name: 'MessageSquare', label: 'Message', Icon: MessageSquare, category: 'Communication' },
  { name: 'Bell', label: 'Bell', Icon: Bell, category: 'Communication' },
  { name: 'Send', label: 'Send', Icon: Send, category: 'Communication' },
  { name: 'Globe', label: 'Globe', Icon: Globe, category: 'Communication' },

  // Commerce
  { name: 'Tag', label: 'Tag', Icon: Tag, category: 'Commerce' },
  { name: 'ShoppingCart', label: 'Cart', Icon: ShoppingCart, category: 'Commerce' },
  { name: 'CreditCard', label: 'Credit Card', Icon: CreditCard, category: 'Commerce' },
  { name: 'Gift', label: 'Gift', Icon: Gift, category: 'Commerce' },
  { name: 'Percent', label: 'Percent', Icon: Percent, category: 'Commerce' },
  { name: 'Wallet', label: 'Wallet', Icon: Wallet, category: 'Commerce' },
  { name: 'Receipt', label: 'Receipt', Icon: Receipt, category: 'Commerce' },

  // General
  { name: 'Zap', label: 'Lightning', Icon: Zap, category: 'General' },
  { name: 'Target', label: 'Target', Icon: Target, category: 'General' },
  { name: 'Eye', label: 'Eye', Icon: Eye, category: 'General' },
  { name: 'Lock', label: 'Lock', Icon: Lock, category: 'General' },
  { name: 'Key', label: 'Key', Icon: Key, category: 'General' },
  { name: 'Heart', label: 'Heart', Icon: Heart, category: 'General' },
  { name: 'Leaf', label: 'Leaf', Icon: Leaf, category: 'General' },
  { name: 'Flame', label: 'Flame', Icon: Flame, category: 'General' },
  { name: 'Compass', label: 'Compass', Icon: Compass, category: 'General' },
  { name: 'Sparkles', label: 'Sparkles', Icon: Sparkles, category: 'General' },
  { name: 'PawPrint', label: 'Paw Print', Icon: PawPrint, category: 'General' },
  { name: 'Home', label: 'Home', Icon: Home, category: 'General' },
  { name: 'User', label: 'User', Icon: User, category: 'General' },
  { name: 'Settings', label: 'Settings', Icon: Settings, category: 'General' },
  { name: 'Activity', label: 'Activity', Icon: Activity, category: 'General' },
  { name: 'Info', label: 'Info', Icon: Info, category: 'General' },
  { name: 'BarChart3', label: 'Chart', Icon: BarChart3, category: 'General' },
  { name: 'FileText', label: 'Document', Icon: FileText, category: 'General' },
  { name: 'Users', label: 'Users', Icon: Users, category: 'General' },
  { name: 'ClipboardList', label: 'Clipboard', Icon: ClipboardList, category: 'General' },
  { name: 'ShoppingBag', label: 'Shopping Bag', Icon: ShoppingBag, category: 'General' },
];

/** Flat lookup map for resolving icon name → component (used by consumers) */
export const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_REGISTRY.map(({ name, Icon }) => [name, Icon])
);

/* ------------------------------------------------------------------ */
/*  Category labels                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_ORDER = ['Shipping', 'Quality', 'Communication', 'Commerce', 'General'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function IconPicker({ value, onChange, className = '' }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedEntry = ICON_REGISTRY.find((e) => e.name === value);
  const SelectedIcon = selectedEntry?.Icon;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape, focus search on open
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', handleKey);
    searchRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Filter icons by search
  const filteredBySearch = useMemo(() => {
    if (!search.trim()) return ICON_REGISTRY;
    const q = search.toLowerCase();
    return ICON_REGISTRY.filter(
      (e) => e.name.toLowerCase().includes(q) || e.label.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
    );
  }, [search]);

  // Group filtered icons by category
  const groupedIcons = useMemo(() => {
    const groups: Record<string, IconEntry[]> = {};
    for (const entry of filteredBySearch) {
      if (!groups[entry.category]) groups[entry.category] = [];
      groups[entry.category].push(entry);
    }
    return CATEGORY_ORDER.filter((cat) => groups[cat]?.length > 0).map((cat) => ({
      category: cat,
      icons: groups[cat],
    }));
  }, [filteredBySearch]);

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white"
      >
        {SelectedIcon ? (
          <SelectedIcon size={16} className="text-primary-600 shrink-0" />
        ) : (
          <div className="w-4 h-4 rounded border border-gray-300 shrink-0" />
        )}
        <span className="flex-1 text-left truncate text-gray-700">
          {selectedEntry?.label || 'Select icon...'}
        </span>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 p-0.5 -mr-1"
            title="Clear selection"
          >
            &times;
          </button>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search icons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* Icon grid */}
          <div className="max-h-72 overflow-y-auto p-2">
            {groupedIcons.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">
                No icons matching &ldquo;{search}&rdquo;
              </div>
            ) : (
              groupedIcons.map(({ category, icons }) => (
                <div key={category} className="mb-2">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">
                    {category}
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {icons.map((entry) => {
                      const Icon = entry.Icon;
                      const isSelected = value === entry.name;
                      return (
                        <button
                          key={entry.name}
                          type="button"
                          onClick={() => handleSelect(entry.name)}
                          className={`p-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                            isSelected
                              ? 'bg-primary-50 text-primary-600 ring-1 ring-primary-200'
                              : 'hover:bg-gray-50 text-gray-600'
                          }`}
                          title={entry.label}
                        >
                          <Icon size={16} />
                          <span className="text-[8px] leading-tight truncate w-full text-center">
                            {entry.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between">
            <span>{ICON_REGISTRY.length} icons available</span>
            <span>ESC to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
