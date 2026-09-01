// Types
export type {
  PaginatedData,
  ApiResponse,
  SummaryCardData,
  DataTableColumn,
  DataTableProps,
  DrawerTab,
  DetailDrawerProps,
  FilterChipData,
  FilterChipsProps,
  SearchBarProps,
  PaginationProps,
  EmptyStateProps,
  ErrorStateProps,
  BadgeVariant,
  StatusBadgeProps,
  ConfirmDialogProps,
  AddressComponents,
  AddressAutocompleteProps,
  OrderItemData,
  OrderData,
  InvoiceData,
  OrderDetailViewProps,
} from './types';

export type { ProductCardProduct, ProductCardProps } from './components/ProductCard';
export type { PriceDisplayProps } from './components/PriceDisplay';
export type { ProductBadgeProps } from './components/ProductBadge';
export type { CartItem, CartDrawerProps } from './components/CartDrawer';
export type { OrderProgressStepperProps } from './components/OrderProgressStepper';
export type { OrderStatusBannerProps } from './components/OrderStatusBanner';

// Components
export { SummaryCards } from './components/SummaryCards';
export { DataTable } from './components/DataTable';
export { DetailDrawer, Section, DetailRow } from './components/DetailDrawer';
export { FilterChips } from './components/FilterChips';
export { SearchBar } from './components/SearchBar';
export { Pagination } from './components/Pagination';
export { EmptyState, ErrorState } from './components/EmptyState';
export { StatusBadge } from './components/StatusBadge';
export { ConfirmDialog } from './components/ConfirmDialog';
export { AddressAutocomplete } from './components/AddressAutocomplete';
export { OrderDetailView } from './components/OrderDetailView';
export { OrderProgressStepper, ORDER_STATUS_STEPS, STEP_LABELS } from './components/OrderProgressStepper';
export { OrderStatusBanner } from './components/OrderStatusBanner';

// Commerce components
export { ProductCard } from './components/ProductCard';
export { PriceDisplay } from './components/PriceDisplay';
export { ProductBadge, getProductBadgeVariant } from './components/ProductBadge';
export { CartDrawer } from './components/CartDrawer';

// Animation components
export { FadeIn } from './components/FadeIn';
