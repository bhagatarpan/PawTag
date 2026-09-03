import React from 'react';

/* ------------------------------------------------------------------ */
/*  API / Data Types                                                   */
/* ------------------------------------------------------------------ */

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  SummaryCards                                                        */
/* ------------------------------------------------------------------ */

export interface SummaryCardData {
  label: string;
  value?: number;
  icon: React.ReactNode;
  onClick?: () => void;
  clickable?: boolean;
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

/* ------------------------------------------------------------------ */
/*  DataTable                                                           */
/* ------------------------------------------------------------------ */

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  hideOnSmall?: boolean;
  render: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  getKey: (item: T) => string;
  skeletonCount?: number;
}

/* ------------------------------------------------------------------ */
/*  DetailDrawer                                                        */
/* ------------------------------------------------------------------ */

export interface DrawerTab {
  key: string;
  label: string;
  count?: number;
}

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  tabs?: DrawerTab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}

/* ------------------------------------------------------------------ */
/*  FilterChips                                                         */
/* ------------------------------------------------------------------ */

export interface FilterChipData {
  key: string;
  label: string;
}

export interface FilterChipsProps {
  chips: FilterChipData[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
  clearLabel?: string;
}

/* ------------------------------------------------------------------ */
/*  SearchBar                                                           */
/* ------------------------------------------------------------------ */

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Pagination                                                          */
/* ------------------------------------------------------------------ */

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/* ------------------------------------------------------------------ */
/*  EmptyState / ErrorState                                              */
/* ------------------------------------------------------------------ */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/* ------------------------------------------------------------------ */
/*  StatusBadge                                                         */
/* ------------------------------------------------------------------ */

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'primary';

export interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  ConfirmDialog                                                       */
/* ------------------------------------------------------------------ */

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  /** Predefined reasons to choose from. Renders a select dropdown. */
  reasons?: string[];
  /** Currently selected reason. */
  selectedReason?: string;
  /** Called when the user picks a different reason. */
  onReasonChange?: (reason: string) => void;
  /** Placeholder for the reason select. */
  reasonPlaceholder?: string;
  /** Free-text notes. Rendered as a textarea. */
  notes?: string;
  /** Called when notes change. */
  onNotesChange?: (notes: string) => void;
  /** Show the notes textarea. Typically enabled when "Other" is selected. */
  showNotes?: boolean;
  /** Mark notes as required. Confirm is disabled until filled. */
  notesRequired?: boolean;
  /** Label for the notes textarea. */
  notesLabel?: string;
  /** Placeholder for the notes textarea. */
  notesPlaceholder?: string;
  /** Optional footnote content rendered below the message (e.g. "What happens next?"). */
  footnote?: React.ReactNode;
  /** Optional custom content rendered inside the dialog body (after notes). */
  children?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  AddressAutocomplete                                                 */
/* ------------------------------------------------------------------ */

export interface AddressComponents {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface AddressAutocompleteProps {
  /** Called when user selects an address from the dropdown */
  onAddressSelect: (address: AddressComponents) => void;
  /** Current value of the input */
  value: string;
  /** Called when input value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** ISO country code to bias results (default: 'NZ'). Not a restriction — international addresses still work. */
  defaultCountry?: string;
  /** Additional CSS classes for the input */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  OrderDetailView                                                     */
/* ------------------------------------------------------------------ */

export interface OrderItemData {
  productName: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  petName?: string;
  tagId?: string;
  image?: string;
  customizationTotal?: number;
}

export interface OrderData {
  _id: string;
  orderNumber?: string;
  status: string;
  items: OrderItemData[];
  totalAmount: number;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  discount?: {
    percent: number;
    amount: number;
    reason: string;
  };
  payment?: {
    amount: number;
    currency: string;
    status: string;
    method?: string;
    stripePaymentIntentId?: string;
    cardBrand?: string;
    cardLast4?: string;
  };
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  cancellationReason?: string;
  cancellationNotes?: string;
  cancelledBy?: string;
  cancelledByType?: string;
  cancelledByPortal?: 'customer-web' | 'customer-mobile' | 'admin-web' | 'system';
  cancelledByDescription?: string;
  cancelledAt?: string;
  refundId?: string;
  refundArn?: string;
  refundStatus?: 'pending' | 'succeeded' | 'failed' | 'canceled';
  refundExpectedArrival?: string;
  refundSettledAt?: string;
  refundLastSyncedAt?: string;
  refundFailureReason?: string;
  refundAttemptCount?: number;
  createdAt: string;
  updatedAt?: string;
  activity?: Array<{
    type: string;
    message: string;
    timestamp: string;
    actor: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface InvoiceData {
  _id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
}

export interface OrderDetailViewProps {
  order: OrderData;
  invoice?: InvoiceData | null;
  onViewInvoice?: () => void;
  onRequestReturn?: () => void;
  onCancelOrder?: () => void;
  onBackToOrders?: () => void;
  contactPhone?: string;
  contactEmail?: string;
  className?: string;
}
