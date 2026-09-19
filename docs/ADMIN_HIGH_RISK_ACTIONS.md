# Admin High-Risk Actions Inventory

> Work Packet 9.1 — Inventory of all admin actions that can affect money, users, orders, or production configuration.
>
> **Purpose:** Use this document to find gaps in confirmation, audit, and authorization. Do not treat documentation as the safety mechanism.

---

## Refund Money

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Refund order | `POST /api/admin/orders/:id/refund` | `order.update` | No (reason required) | CRITICAL | Yes (via Stripe) |
| Cancel order (with refund) | `POST /api/admin/orders/:id/cancel` | `order.update` | No (reason required) | HIGH | Partial |
| Retry refund | `POST /api/admin/commerce/refunds/:orderId/retry` | `order.update` | No | **NO** | Yes |
| Sync refund | `POST /api/admin/commerce/refunds/:orderId/sync` | `order.update` | No | **NO** | Yes |
| Reconcile refunds | `POST /api/admin/commerce/refunds/reconcile` | `order.update` | No | **NO** | N/A |

**Gaps:** Refund retry and sync have no audit logging at route level.

---

## Cancel an Order

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Cancel order | `POST /api/admin/orders/:id/cancel` | `order.update` | No (reason required) | HIGH | Partial (refund if paid) |
| Update order status | `PUT /api/admin/orders/:id/status` | `order.update` | No | HIGH | Status-transition validated |

**Gaps:** No confirmation dialogs on either endpoint.

---

## Change Payment Configuration

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Update any setting | `PUT /api/admin/settings/:key` | `setting.update` | No | HIGH | Yes |
| Update commerce settings | `PUT /api/admin/commerce/settings` | `setting.update` | No | MEDIUM | Yes |
| Create setting | `POST /api/admin/settings` | `setting.create` | No | HIGH | Yes |
| Delete setting | `DELETE /api/admin/settings/:key` | `setting.update` | No | HIGH | **NO** (hard-delete) |
| Connect Xero | `GET /api/admin/commerce/accounting/connect/xero` | `order.update` | No | **NO** | Yes |
| Disconnect Xero | `DELETE /api/admin/commerce/accounting/disconnect/xero` | `order.update` | No | **NO** | Yes |

**Gaps:** Generic setting update can modify ANY setting including payment config. Xero connect/disconnect has no audit logging.

---

## Activate/Deactivate Subscription

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Update subscription status | `PUT /api/admin/subscriptions/:id/status` | `subscription.update` | No | **NO** (non-cancel) | Yes |
| Extend subscription | `POST /api/admin/subscriptions/:id/extend` | `subscription.update` | No | **NO** | Yes |
| Gold subscribe | `POST /api/admin/subscriptions/gold/subscribe` | `subscription.update` | No | **NO** | Yes |

**Gaps:** All three subscription mutation endpoints lack explicit audit logging at route level.

---

## Change Role/Permission

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Set user role | `PUT /api/admin/users/:id/role` | `user.assign_role` | No | HIGH | Yes |
| Create role | `POST /api/admin/rbac/roles` | `role.create` | No | HIGH | Yes |
| Update role | `PUT /api/admin/rbac/roles/:id` | `role.update` | No | HIGH | Yes |
| Delete role | `DELETE /api/admin/rbac/roles/:id` | `role.delete` | No | HIGH | Blocked for system roles |
| Assign permission | `POST /api/admin/rbac/roles/:id/permissions` | `role.assign_permission` | No | HIGH | Yes |
| Remove permission | `DELETE /api/admin/rbac/roles/:roleId/permissions/:permId` | `role.remove_permission` | No | HIGH | Yes |
| Assign user role | `POST /api/admin/rbac/users/:userId/roles` | `user.assign_role` | No | HIGH | Yes |
| Remove user role | `DELETE /api/admin/rbac/users/:userId/roles/:roleId` | `user.remove_role` | No | HIGH | Blocked for last super_admin |

**Gaps:** No confirmation dialogs. Safety guards exist for system roles and last super_admin.

---

## Change User/Account State

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Update user status | `PUT /api/admin/users/:id/status` | `user.update` | No | HIGH | Yes |
| Lock account | `PUT /api/admin/users/:id/lock` | `user.deactivate` | No | HIGH (SECURITY) | Yes |
| Unlock account | `PUT /api/admin/users/:id/unlock` | `user.activate` | No | HIGH (SECURITY) | Yes |
| Reset password | `POST /api/admin/users/:id/reset-password` | `user.reset_password` | No | HIGH (AUTH) | Yes (new password) |
| Delete user | `DELETE /api/admin/users/:id` | `user.delete` | No | HIGH | Soft-delete |
| Skip invoice OTP | `PUT /api/admin/users/:id/skip-invoice-otp` | `user.update` | No | MEDIUM | Time-limited (24h) |

**Gaps:** No confirmation dialogs. Skip-invoice-otp weakens a security control.

---

## Alter a Tag

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Create tag | `POST /api/admin/tags` | `tag.create` | No | MEDIUM | Yes |
| Update tag | `PUT /api/admin/tags/:id` | `tag.update` | No | MEDIUM | Yes |
| Delete tag | `DELETE /api/admin/tags/:id` | `tag.delete` | No | HIGH | Soft-delete |

**Gaps:** No confirmation dialogs. Tag updates can change pet linkage and ownership.

---

## Publish CMS Content

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Create content | `POST /api/admin/content` | `content.create` | No | MEDIUM | Yes |
| Update content | `PUT /api/admin/content/:id` | `content.update` | No | MEDIUM | Yes |
| Delete content | `DELETE /api/admin/content/:id` | `content.delete` | No | MEDIUM | **NO** (hard-delete) |

**Gaps:** No confirmation dialogs. Content deletion is permanent.

---

## Alter Site Availability

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Update site status | `PUT /api/admin/site-availability/status` | `setting.update` | No | CRITICAL | Yes |

**Gaps:** No confirmation dialog. Setting `offlineMode: true` takes the entire site offline.

---

## Export Sensitive Data

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Export refunds | `GET /api/admin/commerce/refunds/export` | `order.read` | No | **NO** | N/A |

**Gaps:** Exposes customer PII (names, emails) and financial data with no audit logging.

---

## Delete/Soft-Delete Important Data

| Action | Endpoint | Permission | Confirmation | Audit | Reversible |
|--------|----------|------------|-------------|-------|------------|
| Delete user | `DELETE /api/admin/users/:id` | `user.delete` | No | HIGH | Soft-delete |
| Delete pet | `DELETE /api/admin/pets/:id` | `pet.delete` | No | HIGH | Soft-delete |
| Delete tag | `DELETE /api/admin/tags/:id` | `tag.delete` | No | HIGH | Soft-delete |
| Delete product | `DELETE /api/admin/products/:id` | `product.delete` | No | HIGH | **NO** (hard-delete) |
| Delete content | `DELETE /api/admin/content/:id` | `content.delete` | No | MEDIUM | **NO** (hard-delete) |
| Delete setting | `DELETE /api/admin/settings/:key` | `setting.update` | No | HIGH | **NO** (hard-delete) |
| Delete feature flag | `DELETE /api/admin/feature-flags/:key` | `feature_flag.delete` | No | CRITICAL | **NO** (hard-delete) |

**Gaps:** No confirmation dialogs. Products, content, settings, and feature flags are permanently deleted.

---

## Highest-Risk Endpoints (Priority Order)

| Priority | Endpoint | Risk | Audit Level |
|----------|----------|------|-------------|
| 1 | `PUT /api/admin/site-availability/status` | Can take entire site offline | CRITICAL |
| 2 | `POST /api/admin/orders/:id/refund` | Financial refund | CRITICAL |
| 3 | `PUT /api/admin/feature-flags/:key` | Toggle production features | CRITICAL |
| 4 | `DELETE /api/admin/feature-flags/:key` | Permanent feature flag deletion | CRITICAL |
| 5 | `POST /api/admin/settings` | Create arbitrary system settings | HIGH |
| 6 | `PUT /api/admin/settings/:key` | Modify any setting including payment config | HIGH |
| 7 | `PUT /api/admin/users/:id/role` | Change user authorization | HIGH |
| 8 | `POST /api/admin/users/:id/reset-password` | Admin password reset | HIGH |
| 9 | `POST /api/admin/orders/:id/cancel` | Cancel with inline refund | HIGH |

---

## Summary of Gaps

### Audit Gaps (no route-level logging)
- `/api/admin/commerce/refunds/:orderId/retry`
- `/api/admin/commerce/refunds/:orderId/sync`
- `/api/admin/commerce/refunds/export`
- `/api/admin/commerce/refunds/reconcile`
- `/api/admin/commerce/accounting/connect/xero`
- `/api/admin/commerce/accounting/disconnect/xero`
- `/api/admin/subscriptions/:id/status` (non-cancel)
- `/api/admin/subscriptions/:id/extend`
- `/api/admin/subscriptions/gold/subscribe`
- `/api/admin/commerce/inventory/:productId/adjust`

### Confirmation Dialog Gaps
**Zero confirmation dialogs** exist across all admin routes. All destructive/financial actions execute immediately on API call.

### Hard-Delete Risks
- Products, content, settings, feature flags are permanently deleted
- No soft-delete mechanism for these entities

---

## Route Organization (Future Improvements)

The following workflows in `admin.ts` should be moved to domain-specific files when they are next modified:

| Workflow | Current Location | Target File | Reason |
|----------|-----------------|-------------|--------|
| Refund order | `admin.ts` (L2718-2881) | `admin-refunds.ts` | Reduce duplicate refund logic, consolidate audit |
| Cancel order | `admin.ts` (L2551-2716) | `admin-commerce.ts` or new `admin-orders.ts` | Centralize order lifecycle management |
| Subscription status | `admin-subscriptions.ts` | Already in domain file | Add missing audit logging |
| Inventory adjust | `admin-commerce.ts` | Already in domain file | Add missing audit logging |

**Rule:** Do not refactor for aesthetics. Only move workflows when fixing them for other reasons (audit gaps, bug fixes, feature additions).
