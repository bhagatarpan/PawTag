import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatCancelledBy,
  formatCancelledByDescription,
  formatCancellationPortalLabel,
  formatActivityMessage,
  formatSystemActivityMessage,
} from '../../packages/api/src/lib/actor';

describe('actor helpers — pure formatters', () => {
  describe('formatCancelledBy', () => {
    it('returns "Customer (<FullName>)" for Customer role', () => {
      expect(formatCancelledBy('Sarah Johnson', 'Customer')).toBe('Customer (Sarah Johnson)');
    });

    it('returns "<FullName> (<Role>)" for admin roles', () => {
      expect(formatCancelledBy('Dave Macenzie', 'Customer Service')).toBe('Dave Macenzie (Customer Service)');
      expect(formatCancelledBy('Jane Smith', 'Admin')).toBe('Jane Smith (Admin)');
      expect(formatCancelledBy('Bob Builder', 'Super Admin')).toBe('Bob Builder (Super Admin)');
    });
  });

  describe('formatCancellationPortalLabel', () => {
    it('maps known portal values to readable labels', () => {
      expect(formatCancellationPortalLabel('customer-web')).toBe('Customer Web Portal');
      expect(formatCancellationPortalLabel('customer-mobile')).toBe('Customer Mobile App');
      expect(formatCancellationPortalLabel('admin-web')).toBe('Admin Web Portal');
      expect(formatCancellationPortalLabel('system')).toBe('System (Auto)');
    });

    it('returns the raw portal value for unknown sources', () => {
      expect(formatCancellationPortalLabel('unknown')).toBe('unknown');
    });
  });

  describe('formatCancelledByDescription', () => {
    it('produces customer description with full name and portal', () => {
      const out = formatCancelledByDescription('customer-web', 'Sarah Johnson', 'Customer');
      expect(out).toBe('Order is Cancelled via Customer Web Portal by Sarah Johnson');
    });

    it('produces admin description with full name, role, and portal', () => {
      const out = formatCancelledByDescription('admin-web', 'Dave Macenzie', 'Customer Service');
      expect(out).toBe('Order is Cancelled via Admin Web Portal by Dave Macenzie (Customer Service)');
    });

    it('produces a system description without a person name', () => {
      const out = formatCancelledByDescription('system', '', 'System');
      expect(out).toBe('Order is auto-cancelled by System');
    });
  });

  describe('formatActivityMessage', () => {
    it('renders the canonical activity message', () => {
      const at = new Date('2026-09-01T14:23:45.000Z');
      const out = formatActivityMessage('Sarah Johnson (Customer)', 'Ordered by mistake', at);
      expect(out).toBe('Order cancelled by Sarah Johnson (Customer): Ordered by mistake : AT : 2026-09-01T14:23:45.000Z');
    });
  });

  describe('formatSystemActivityMessage', () => {
    it('renders the system-prefixed activity message', () => {
      const at = new Date('2026-09-01T15:00:00.000Z');
      const out = formatSystemActivityMessage('Auto-cancelled: no payment received within 30 minutes', at);
      expect(out).toBe('Order auto-cancelled by System: Auto-cancelled: no payment received within 30 minutes : AT : 2026-09-01T15:00:00.000Z');
    });
  });
});

describe('resolveActor', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns fallback for unknown user', async () => {
    vi.doMock('@pawtag/db', () => ({
      User: { findById: vi.fn().mockReturnValue({ select: () => ({ populate: () => ({ lean: () => Promise.resolve(null) }) }) }) },
    }));
    const { resolveActor } = await import('../../packages/api/src/lib/actor');
    const admin = await resolveActor('missing', 'admin');
    expect(admin.fullName).toBe('Unknown User');
    expect(admin.displayName).toBe('Unknown');
    expect(admin.roleName).toBe('UNKNOWN');

    const customer = await resolveActor('missing', 'customer');
    expect(customer.displayName).toBe('Customer');
    expect(customer.roleName).toBe('CUSTOMER');
  });

  it('uses the first active role from User.roles[] when present', async () => {
    vi.doMock('@pawtag/db', () => ({
      User: {
        findById: vi.fn().mockReturnValue({
          select: () => ({
            populate: () => ({
              lean: () => Promise.resolve({
                fullName: 'Dave Macenzie',
                roles: [
                  { name: 'CUSTOMER_SERVICE', displayName: 'Customer Service', isActive: true, isSuperAdmin: false, isSystemRole: true },
                ],
              }),
            }),
          }),
        }),
      },
    }));
    const { resolveActor } = await import('../../packages/api/src/lib/actor');
    const out = await resolveActor('user-1', 'admin');
    expect(out.fullName).toBe('Dave Macenzie');
    expect(out.displayName).toBe('Customer Service');
    expect(out.roleName).toBe('CUSTOMER_SERVICE');
  });

  it('prefers isSuperAdmin=true when multiple roles exist', async () => {
    vi.doMock('@pawtag/db', () => ({
      User: {
        findById: vi.fn().mockReturnValue({
          select: () => ({
            populate: () => ({
              lean: () => Promise.resolve({
                fullName: 'Jane Smith',
                roles: [
                  { name: 'CUSTOMER_SERVICE', displayName: 'Customer Service', isActive: true, isSuperAdmin: false, isSystemRole: true },
                  { name: 'SUPER_ADMIN', displayName: 'Super Admin', isActive: true, isSuperAdmin: true, isSystemRole: true },
                ],
              }),
            }),
          }),
        }),
      },
    }));
    const { resolveActor } = await import('../../packages/api/src/lib/actor');
    const out = await resolveActor('user-2', 'admin');
    expect(out.displayName).toBe('Super Admin');
    expect(out.roleName).toBe('SUPER_ADMIN');
  });

  it('falls back to legacy User.role when roles[] is empty', async () => {
    vi.doMock('@pawtag/db', () => ({
      User: {
        findById: vi.fn().mockReturnValue({
          select: () => ({
            populate: () => ({
              lean: () => Promise.resolve({ fullName: 'Legacy User', role: 'admin', roles: [] }),
            }),
          }),
        }),
      },
    }));
    const { resolveActor } = await import('../../packages/api/src/lib/actor');
    const out = await resolveActor('user-3', 'admin');
    expect(out.displayName).toBe('Admin');
    expect(out.roleName).toBe('ADMIN');
  });
});
