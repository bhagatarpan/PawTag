import { describe, it, expect } from 'vitest';
import { buildChangeRows, formatAuditValue } from '../../apps/admin/src/lib/audit-diff';

describe('formatAuditValue', () => {
  it('renders empty values as a dash and preserves redaction markers', () => {
    expect(formatAuditValue(null)).toBe('—');
    expect(formatAuditValue(undefined)).toBe('—');
    expect(formatAuditValue('')).toBe('—');
    expect(formatAuditValue('[REDACTED]')).toBe('[REDACTED]');
  });

  it('renders booleans, numbers and objects readably', () => {
    expect(formatAuditValue(true)).toBe('Yes');
    expect(formatAuditValue(false)).toBe('No');
    expect(formatAuditValue(42)).toBe('42');
    expect(formatAuditValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe('buildChangeRows', () => {
  it('uses explicit changedFields and flags actual changes', () => {
    const rows = buildChangeRows({
      changedFields: [
        { field: 'status', before: 'pending', after: 'approved' },
        { field: 'note', before: 'same', after: 'same' },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ field: 'status', before: 'pending', after: 'approved', changed: true });
    expect(rows[1]).toMatchObject({ field: 'note', changed: false });
  });

  it('marks sensitive fields even when values were not redacted upstream', () => {
    const rows = buildChangeRows({
      changedFields: [{ field: 'passwordHash', before: 'x', after: 'y' }],
    });
    expect(rows[0].sensitive).toBe(true);
  });

  it('diffs before/after snapshots when changedFields are absent', () => {
    const rows = buildChangeRows({
      beforeState: { name: 'Old', city: 'Auckland' },
      afterState: { name: 'New', city: 'Auckland' },
    });
    const changed = rows.find((r) => r.field === 'name');
    const unchanged = rows.find((r) => r.field === 'city');
    expect(changed).toMatchObject({ before: 'Old', after: 'New', changed: true });
    expect(unchanged).toMatchObject({ changed: false });
    expect(rows[0].field).toBe('name'); // changed rows sort first
  });

  it('handles delete-style events with only a before snapshot', () => {
    const rows = buildChangeRows({ beforeState: { title: 'Gone' } });
    expect(rows).toEqual([{ field: 'title', before: 'Gone', after: '—', sensitive: false, changed: true }]);
  });

  it('returns an empty list when there is no state at all', () => {
    expect(buildChangeRows({})).toEqual([]);
  });
});
