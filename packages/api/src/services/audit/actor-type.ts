import type { ActorType } from '@pawtag/db';

/**
 * Map an account role to the actor type recorded in the audit trail.
 *
 * Admin-portal roles are distinct actors (CSR, Web Editor, Designer, Author)
 * so each can be toggled and filtered independently in Audit Settings.
 * Roles not listed here are treated as regular users.
 */
const ROLE_ACTOR_MAP: Record<string, ActorType> = {
  super_admin: 'ADMIN',
  admin: 'ADMIN',
  administrator: 'ADMIN',
  customer_service: 'CSR',
  csr: 'CSR',
  support: 'CSR',
  website_editor: 'WEB_EDITOR',
  web_editor: 'WEB_EDITOR',
  designer: 'DESIGNER',
  author: 'AUTHOR',
  customer: 'USER',
};

export function resolveActorType(role?: string | null): ActorType {
  if (!role) return 'UNKNOWN';
  return ROLE_ACTOR_MAP[role.toLowerCase()] ?? 'USER';
}
