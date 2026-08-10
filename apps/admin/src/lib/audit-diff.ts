/**
 * Pure helpers for rendering audit event changes in a human-readable way.
 * Kept free of React/DOM so they can be unit-tested in isolation.
 */

export interface AuditChangeInput {
  changedFields?: Array<{ field: string; before: unknown; after: unknown; sensitive?: boolean }>;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

export interface AuditChangeRow {
  field: string;
  before: string;
  after: string;
  sensitive: boolean;
  changed: boolean;
}

const SENSITIVE_PATTERN = /password|passwd|secret|token|otp|api[_-]?key|private[_-]?key|credential|cvv|pin/i;

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (value === '[REDACTED]') return '[REDACTED]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function isSensitiveField(field: string): boolean {
  return SENSITIVE_PATTERN.test(field);
}

/**
 * Build display rows for the Before → After view.
 * Prefers the explicit changedFields list; falls back to a top-level
 * diff of beforeState/afterState when only snapshots exist.
 */
export function buildChangeRows(event: AuditChangeInput): AuditChangeRow[] {
  if (event.changedFields && event.changedFields.length > 0) {
    return event.changedFields.map((f) => {
      const before = formatAuditValue(f.before);
      const after = formatAuditValue(f.after);
      return {
        field: f.field,
        before,
        after,
        sensitive: Boolean(f.sensitive) || isSensitiveField(f.field),
        changed: before !== after,
      };
    });
  }

  const before = event.beforeState ?? {};
  const after = event.afterState ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((k) => !['_id', '__v', 'updatedAt'].includes(k));

  return keys
    .map((field) => {
      const b = formatAuditValue(before[field]);
      const a = formatAuditValue(after[field]);
      return { field, before: b, after: a, sensitive: isSensitiveField(field), changed: b !== a };
    })
    .filter((row) => row.before !== '—' || row.after !== '—')
    .sort((a, b) => Number(b.changed) - Number(a.changed) || a.field.localeCompare(b.field));
}
