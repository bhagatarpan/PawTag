import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { ConfirmDialogProps } from '../types';

const variantConfig = {
  danger: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmBg: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmBg: 'bg-amber-600 hover:bg-amber-700',
  },
  primary: {
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    confirmBg: 'bg-primary-600 hover:bg-primary-700',
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  reasons,
  selectedReason,
  onReasonChange,
  reasonPlaceholder = 'Select a reason',
  notes,
  onNotesChange,
  showNotes = false,
  notesRequired = false,
  notesLabel = 'Additional notes',
  notesPlaceholder = 'Please provide more detail',
  footnote,
  children,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  const notesMissing = notesRequired && showNotes && (!notes || !notes.trim());
  const reasonMissing = !!reasons && reasons.length > 0 && !selectedReason;
  const canConfirm = !loading && !notesMissing && !reasonMissing;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4 animate-slide-up max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center shrink-0`}>
            <AlertTriangle size={20} className={config.iconColor} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
        </div>

        <div className="mt-5 overflow-y-auto flex-1 pr-1">
          {reasons && reasons.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedReason || ''}
                onChange={(e) => onReasonChange?.(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white"
              >
                <option value="" disabled>
                  {reasonPlaceholder}
                </option>
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {message && (
            <p className="text-sm text-gray-500 mt-3">{message}</p>
          )}

          {footnote && (
            <div className="mt-3 bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-900">
              {footnote}
            </div>
          )}

          {showNotes && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {notesLabel}
                {notesRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              <textarea
                value={notes || ''}
                onChange={(e) => onNotesChange?.(e.target.value)}
                disabled={loading}
                rows={3}
                placeholder={notesPlaceholder}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
              />
              {notesRequired && notesMissing && (
                <p className="text-sm text-red-600 mt-1">Please provide additional detail for this reason.</p>
              )}
            </div>
          )}

          {children}
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100 bg-white">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${config.confirmBg}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
