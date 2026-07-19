import { userHasPermission } from '../services/authorization.service';

type OwnerField = 'ownerId' | 'userId';

interface ScopeFilterResult {
  allowed: boolean;
  filter: Record<string, any>;
  scope?: string | null;
}

/**
 * Checks if a user has a permission and returns the appropriate Mongoose filter
 * based on the scope (OWN, ALL, GLOBAL, ASSIGNED).
 *
 * Usage in route handlers:
 *   const scopeFilter = await enforceScope(req.user!.id, 'pet.read', 'ownerId');
 *   if (!scopeFilter.allowed) return res.status(403)...;
 *   const pets = await Pet.find({ ...query, ...scopeFilter.filter });
 */
export async function enforceScope(
  userId: string,
  permissionName: string,
  ownerField: OwnerField = 'ownerId',
): Promise<ScopeFilterResult> {
  const result = await userHasPermission(userId, permissionName);

  if (!result.allowed) {
    return { allowed: false, filter: {} };
  }

  // Super Admin or no scope = full access
  if (!result.scope || result.scope === 'GLOBAL' || result.scope === 'ALL') {
    return { allowed: true, filter: {} };
  }

  // OWN scope = only user's own records
  if (result.scope === 'OWN') {
    return { allowed: true, filter: { [ownerField]: userId } };
  }

  // ASSIGNED scope = records assigned to this user
  if (result.scope === 'ASSIGNED') {
    return { allowed: true, filter: { assignedTo: userId } };
  }

  // Unknown scope = deny
  return { allowed: false, filter: {} };
}

/**
 * Middleware-style helper that checks permission and returns 403 if not allowed.
 * Use this when you want to check permission and get scope filter in one step.
 */
export async function requireScope(
  userId: string,
  permissionName: string,
  ownerField: OwnerField = 'ownerId',
): Promise<ScopeFilterResult> {
  return enforceScope(userId, permissionName, ownerField);
}
