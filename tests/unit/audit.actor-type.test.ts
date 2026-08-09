import { describe, it, expect } from 'vitest';
import { resolveActorType } from '../../packages/api/src/services/audit';

describe('resolveActorType', () => {
  it('maps administrator roles to ADMIN', () => {
    expect(resolveActorType('admin')).toBe('ADMIN');
    expect(resolveActorType('super_admin')).toBe('ADMIN');
    expect(resolveActorType('Administrator')).toBe('ADMIN');
  });

  it('maps support roles to CSR, never ADMIN', () => {
    expect(resolveActorType('customer_service')).toBe('CSR');
    expect(resolveActorType('support')).toBe('CSR');
    expect(resolveActorType('csr')).toBe('CSR');
  });

  it('maps CMS content roles to their own actor types', () => {
    expect(resolveActorType('website_editor')).toBe('WEB_EDITOR');
    expect(resolveActorType('web_editor')).toBe('WEB_EDITOR');
    expect(resolveActorType('designer')).toBe('DESIGNER');
    expect(resolveActorType('author')).toBe('AUTHOR');
  });

  it('maps customers and unknown roles to USER, missing role to UNKNOWN', () => {
    expect(resolveActorType('customer')).toBe('USER');
    expect(resolveActorType('some_future_role')).toBe('USER');
    expect(resolveActorType(undefined)).toBe('UNKNOWN');
    expect(resolveActorType(null)).toBe('UNKNOWN');
    expect(resolveActorType('')).toBe('UNKNOWN');
  });
});
