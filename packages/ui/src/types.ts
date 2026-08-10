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
}
