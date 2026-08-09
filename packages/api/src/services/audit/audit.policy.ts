import { Setting } from '@pawtag/db';

export const AUDIT_CATEGORIES = [
  'AUTH', 'AUTHZ', 'CREATE', 'UPDATE', 'DELETE', 'READ', 'EXPORT',
  'TRANSITION', 'FINANCIAL', 'SECURITY', 'ADMIN', 'SYSTEM', 'INTEGRATION', 'FILE', 'CONFIG',
] as const;

export const AUDIT_ACTORS = [
  'USER', 'ADMIN', 'SERVICE', 'SYSTEM', 'SCHEDULED_JOB', 'API_CLIENT', 'WEBHOOK', 'AI_AGENT', 'FINDER', 'UNKNOWN',
] as const;

export type AuditCategory = typeof AUDIT_CATEGORIES[number];
export type AuditActor = typeof AUDIT_ACTORS[number];

export interface AuditPolicy {
  categories: Record<AuditCategory, boolean>;
  actors: Record<AuditActor, boolean>;
}

const CACHE_TTL_MS = 5000;
let cachedPolicy: AuditPolicy | undefined;
let cachedAt = 0;

function defaults(): AuditPolicy {
  return {
    categories: Object.fromEntries(AUDIT_CATEGORIES.map((category) => [category, true])) as AuditPolicy['categories'],
    actors: Object.fromEntries(AUDIT_ACTORS.map((actor) => [actor, true])) as AuditPolicy['actors'],
  };
}

export function auditPolicyKey(kind: 'category' | 'actor', value: string): string {
  return `audit.policy.${kind}.${value.toLowerCase()}`;
}

export async function getAuditPolicy(forceRefresh = false): Promise<AuditPolicy> {
  if (!forceRefresh && cachedPolicy && Date.now() - cachedAt < CACHE_TTL_MS) return cachedPolicy;

  const policy = defaults();
  try {
    const settings = await Setting.find({ category: 'audit', key: /^audit\.policy\.(category|actor)\./ }).select('key value').lean();
    for (const setting of settings) {
      const [, , kind, value] = setting.key.split('.');
      if (kind === 'category' && value) {
        const category = value.toUpperCase() as AuditCategory;
        if (category in policy.categories) policy.categories[category] = setting.value !== 'false';
      } else if (kind === 'actor' && value) {
        const actor = value.toUpperCase() as AuditActor;
        if (actor in policy.actors) policy.actors[actor] = setting.value !== 'false';
      }
    }
  } catch {
    // Fail open so a policy database outage never silently disables auditing.
  }

  cachedPolicy = policy;
  cachedAt = Date.now();
  return policy;
}

export async function isAuditEnabled(category: string, actorType: string): Promise<boolean> {
  const policy = await getAuditPolicy();
  const categoryEnabled = policy.categories[category.toUpperCase() as AuditCategory] ?? true;
  const actorEnabled = policy.actors[actorType.toUpperCase() as AuditActor] ?? true;
  return categoryEnabled && actorEnabled;
}

export function invalidateAuditPolicyCache(): void {
  cachedPolicy = undefined;
  cachedAt = 0;
}
