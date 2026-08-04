# PawTag — Database Schema Reference

All models live in `packages/db/src/models/` and are exported from `packages/db/src/index.ts`.

---

## Core Business Models

### User (`User.ts`)
Core user account with auth, roles, profile, and notification preferences.
- **Indexes:** `email` (unique), `phoneNumber`, `roles`, `status`, `deletedAt`
- **Key fields:** `email`, `passwordHash`, `fullName`, `phoneNumber`, `role` (legacy), `roles` (RBAC refs), `status`, `emailVerified`, `phoneVerified`, `address`, `emergencyContact`, `notificationPreferences`

### Pet (`Pet.ts`)
Pet profile with full health records (vaccinations, microchips, medications, allergies, surgeries, vet details, weight history, health conditions, desexing).
- **Indexes:** `petId` (unique), `ownerId`, `status`, `petType`, `deletedAt`, compound: `{ ownerId, deletedAt, createdAt }`, `{ status, deletedAt }`, `{ status, foundByFinderAt, deletedAt }`
- **Key fields:** `petId`, `ownerId`, `name`, `petType`, `species`, `breed`, `gender`, `color`, `status`, `photos`, `isNeutered`, `lostCount`, `vaccinations`, `microchips`, `medications`, `allergies`, `vetDetails`, `surgeries`, `healthConditions`, `desexing`

### Tag (`Tag.ts`)
Physical QR/NFC tags linked to pets and owners with subscription status and scan tracking.
- **Indexes:** `tagId` (unique), `tagType`, `petId`, `ownerId`, `deletedAt`, compound: `{ petId, deletedAt }`, `{ ownerId, deletedAt }`
- **Key fields:** `tagId`, `tagType`, `petId`, `ownerId`, `status`, `subscriptionStatus`, `subscriptionId`, `lastScannedAt`, `lastScanLocation`, `activatedAt`

### Subscription (`Subscription.ts`)
Pet tag subscriptions with billing periods, Stripe integration, grace periods, and renewal reminders.
- **Indexes:** `userId`, `tagId`, `status`, `startDate`, `currentPeriodEnd`, `stripeSubscriptionId`, compound: `{ userId, tagId }`, `{ status, currentPeriodEnd }`, `{ status, gracePeriodEndsAt }`, `{ userId, status, currentPeriodEnd }`, `{ status, currentPeriodEnd, autoRenew, deletedAt }`
- **Key fields:** `userId`, `tagId`, `orderId`, `planId`, `planType`, `status`, `price`, `startDate`, `currentPeriodStart`, `currentPeriodEnd`, `gracePeriodEndsAt`, `autoRenew`, `stripeSubscriptionId`, `reminderStates`, `totalScans`

---

## Commerce Models

### Product (`Product.ts`)
Shop product catalog with variants, pricing, subscription config, and text search.
- **Indexes:** `sku` (unique), `category`, `isActive`, `isSubscription`, text index on `{ name, description }`
- **Key fields:** `name`, `description`, `price`, `sku`, `category`, `stock`, `variants`, `isActive`, `customizable`, `isSubscription`, `subscriptionConfig`, `images`

### Cart (`Cart.ts`)
Single shopping cart per user with product line items.
- **Indexes:** `userId` (unique)
- **Key fields:** `userId`, `items` (subdocument array: `productId`, `sku`, `unitPrice`, `quantity`, `petName`)

### Order (`Order.ts`)
E-commerce order records with items, payment, shipping, and status tracking.
- **Indexes:** `orderNumber` (unique), `userId`, `status`, `deletedAt`, `createdAt` (desc), compound: `{ userId, createdAt }`, `{ status, createdAt }`
- **Key fields:** `orderNumber`, `userId`, `items`, `status`, `payment`, `shippingAddress`, `trackingNumber`, `discount`, `referredByCode`

### Invoice (`Invoice.ts`)
Subscription invoices with Stripe integration and payment status.
- **Indexes:** `subscriptionId`, `userId`, `invoiceNumber` (unique), `status`, compound: `{ userId, status }`, `{ subscriptionId, createdAt }`, `{ userId, subscriptionId, createdAt }`
- **Key fields:** `subscriptionId`, `userId`, `invoiceNumber`, `amount`, `status`, `billingPeriod`, `dueDate`, `stripeInvoiceId`

### InvoiceAccessToken (`InvoiceAccessToken.ts`)
Secure token-based access to view invoices with OTP verification and auto-expiry.
- **Indexes:** `invoiceId`, `userId`, `tokenHash`, compound: `{ invoiceId, userId }`, TTL on `expiresAt`
- **Key fields:** `invoiceId`, `userId`, `tokenHash`, `expiresAt`, `otpHash`, `otpAttempts`

---

## Referral Models

### Referral (`Referral.ts`)
Tracks referral relationships between referrer and referee with reward status.
- **Indexes:** `referrerId`, `refereeId`, `referralCode`, compound: `{ orderId, status }`, `{ referrerId, status }`
- **Key fields:** `referrerId`, `refereeId`, `referralCode`, `status`, `referrerRewardMonths`, `refereeRewardMonths`, `orderId`

### ReferralCode (`ReferralCode.ts`)
Unique 8-character referral codes assigned one-per-user.
- **Indexes:** `code` (unique), `userId` (unique)
- **Key fields:** `userId`, `code`, `isActive`

---

## Finder & Location Models

### FinderScan (`FinderScan.ts`)
Records every QR/NFC tag scan event by finders with location and consent data.
- **Indexes:** `tagId`, `petId`, compound: `{ tagId, createdAt }`, `{ petId, action, notifiedAt }`, `createdAt` (desc)
- **Key fields:** `tagId`, `petId`, `action`, `location`, `finderPhone`, `finderEmail`, `finderName`, `consent`, `contactAttempted`

### LocationEvent (`LocationEvent.ts`)
Records GPS/QR/NFC location events for pets from various sources.
- **Indexes:** `tagId`, `petId`, `ownerId`, compound: `{ tagId, timestamp }`
- **Key fields:** `tagId`, `petId`, `ownerId`, `location` (lat/lng/accuracy/source), `finderId`

### TagExpiryNotification (`TagExpiryNotification.ts`)
Tracks expiry warning notifications sent to tag owners with acknowledgement.
- **Indexes:** compound: `{ subscriptionId, notifiedAt }`, `{ acknowledged, createdAt }`, `{ acknowledged, daysUntilExpiry }`
- **Key fields:** `subscriptionId`, `tagId`, `ownerId`, `daysUntilExpiry`, `notifiedAt`, `acknowledged`

---

## Auth & Session Models

### RefreshToken (`RefreshToken.ts`)
JWT refresh tokens with expiry and revocation tracking for session management.
- **Indexes:** `userId`, `tokenHash` (unique), TTL on `expiresAt`
- **Key fields:** `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `deviceInfo`

### VerificationToken (`VerificationToken.ts`)
Stores hashed tokens for email verification, phone OTP, and password reset with rate limiting.
- **Indexes:** compound: `{ userId, type }`, `{ tokenHash, type }`, TTL on `expiresAt`
- **Key fields:** `userId`, `type`, `tokenHash`, `expiresAt`, `usedAt`, `attempts`, `resendCount`

### PushToken (`PushToken.ts`)
Stores push notification tokens (web/ios/android) for each user.
- **Indexes:** `token` (unique), compound: `{ userId, isActive }`
- **Key fields:** `userId`, `token`, `platform`, `isActive`, `lastUsedAt`

### Notification (`Notification.ts`)
In-app notification records for users across multiple channels and priority levels.
- **Indexes:** compound: `{ userId, read }`, `{ userId, createdAt }`
- **Key fields:** `userId`, `type`, `title`, `message`, `read`, `priority`, `channel`, `actionUrl`

---

## RBAC Models

### Role (`Role.ts`)
RBAC roles (system or custom) including super-admin flag.
- **Indexes:** `name` (unique), `isActive`, `isSuperAdmin`
- **Key fields:** `name`, `displayName`, `roleType`, `isSystemRole`, `isSuperAdmin`, `isActive`

### UserRole (`UserRole.ts`)
Join table assigning roles to users with optional expiry and active/inactive state.
- **Indexes:** compound: `{ userId, roleId }` (unique), `userId`, `roleId`, `isActive`, `expiresAt`
- **Key fields:** `userId`, `roleId`, `assignedBy`, `expiresAt`, `isActive`

### Permission (`Permission.ts`)
Individual RBAC permissions (resource + action) grouped under permission groups.
- **Indexes:** `name` (unique), compound: `{ resource, action }`, `permissionGroupId`, `isActive`
- **Key fields:** `name`, `resource`, `action`, `permissionGroupId`, `isActive`

### PermissionGroup (`PermissionGroup.ts`)
Groups related permissions for UI display and organizational purposes.
- **Indexes:** `name` (unique), `sortOrder`, `isActive`
- **Key fields:** `name`, `displayName`, `sortOrder`, `isActive`

### PermissionScope (`PermissionScope.ts`)
Defines permission scopes (e.g., own, team, all) that can be attached to role-permission assignments.
- **Indexes:** `code` (unique), `isActive`
- **Key fields:** `code`, `name`, `isActive`

### RolePermission (`RolePermission.ts`)
Join table linking roles to permissions with optional scope overrides.
- **Indexes:** compound: `{ roleId, permissionId }` (unique), `roleId`, `permissionId`, `scopeId`
- **Key fields:** `roleId`, `permissionId`, `scopeId`

---

## Audit & System Models

### AuditLog (`AuditLog.ts`)
Records admin/system audit trail for all user and entity changes.
- **Indexes:** `userId`, `action`, `entity`, compound: `{ entity, entityId }`, `createdAt` (desc)
- **Key fields:** `userId`, `action`, `entity`, `entityId`, `changes`, `ipAddress`, `userAgent`

### Setting (`Setting.ts`)
Key-value system settings organized by category.
- **Indexes:** `key` (unique), `category`
- **Key fields:** `key`, `value`, `category`, `description`, `updatedBy`

### FeatureFlag (`FeatureFlag.ts`)
Feature flags for toggling system features by role and percentage rollout.
- **Indexes:** `key` (unique)
- **Key fields:** `key`, `name`, `isEnabled`, `allowedRoles`, `percentage`

---

## CMS Models

### CmsPage (`CmsPage.ts`)
CMS-managed pages with sections, SEO metadata, scheduling, and versioning.
- **Indexes:** `slug` (unique), `status`, `template`, `deletedAt`, compound: `{ scheduledPublishAt, status }`
- **Key fields:** `slug`, `title`, `template`, `sections`, `status`, `version`, SEO meta fields

### CmsPageVersion (`CmsPageVersion.ts`)
Stores versioned snapshots of CMS pages for rollback.
- **Indexes:** `pageId`, compound: `{ pageId, version }` (desc)
- **Key fields:** `pageId`, `version`, `snapshot`, `createdBy`

### CmsAnnouncement (`CmsAnnouncement.ts`)
CMS-managed announcements (banners, popups, maintenance, promotions) with scheduling.
- **Indexes:** `type`, `priority`, `status`, `startsAt`, `deletedAt`, compound: `{ status, startsAt, endsAt }`
- **Key fields:** `title`, `message`, `type`, `status`, `priority`, `startsAt`, `endsAt`, `targetAudience`, `dismissible`

### CmsAuthPage (`CmsAuthPage.ts`)
CMS-managed content for authentication pages (login, register, password reset).
- **Indexes:** `pageType` (unique), `isActive`
- **Key fields:** `pageType`, `title`, `content`, `isActive`

### CmsEmailTemplate (`CmsEmailTemplate.ts`)
CMS-managed email templates with variables, sender config, and status.
- **Indexes:** `slug` (unique), `status`, `deletedAt`
- **Key fields:** `slug`, `subject`, `body`, `senderEmail`, `senderName`, `variables`, `status`

### CmsSmsTemplate (`CmsSmsTemplate.ts`)
CMS-managed SMS message templates with variables and status.
- **Indexes:** `slug` (unique), `status`, `deletedAt`
- **Key fields:** `slug`, `message`, `variables`, `status`

### CmsFooter (`CmsFooter.ts`)
CMS-managed footer content with grouped links and social media URLs.
- **Indexes:** `deletedAt`
- **Key fields:** `name`, `groups`, `socialLinks`, `status`

### CmsHomepageSection (`CmsHomepageSection.ts`)
CMS-managed homepage sections (hero, how-it-works, testimonials, FAQ) with ordering.
- **Indexes:** compound: `{ sectionType, order }`, `isActive`
- **Key fields:** `sectionType`, `title`, `content`, `order`, `isActive`

### CmsMedia (`CmsMedia.ts`)
CMS media library for uploaded files with folder organization and deduplication by hash.
- **Indexes:** `filename`, `mimeType`, `folder`, `hash`, `tags`, `deletedAt`
- **Key fields:** `filename`, `url`, `mimeType`, `size`, `hash`, `folder`, `tags`, `thumbnails`, `uploadedBy`

### CmsNavigation (`CmsNavigation.ts`)
CMS-managed navigation menus (header, footer, sidebar, mobile) with nested items.
- **Indexes:** `slug` (unique), `location`, `status`, `deletedAt`
- **Key fields:** `slug`, `location`, `items`, `status`

### CmsPetReference (`CmsPetReference.ts`)
Reference data for pet types, breeds, colors, patterns, genders, and vaccines.
- **Indexes:** `type`, `petSpecies`, `isActive`, `deletedAt`, compound: `{ type, petSpecies, value }` (unique, partial filter on `deletedAt`)
- **Key fields:** `type`, `petSpecies`, `label`, `value`, `order`, `isActive`

### CmsRedirect (`CmsRedirect.ts`)
CMS-managed URL redirects (temporary/permanent) with hit counting.
- **Indexes:** `from` (unique), `status`, `deletedAt`
- **Key fields:** `from`, `to`, `type`, `status`, `hitCount`

### CmsShopPage (`CmsShopPage.ts`)
CMS-managed shop-related pages with content and SEO fields.
- **Indexes:** `slug` (unique), `isActive`
- **Key fields:** `slug`, `title`, `content`, `metaTitle`, `metaDescription`, `isActive`

### SiteContent (`SiteContent.ts`)
Simple CMS for static site content pages (terms, privacy, about, etc.).
- **Indexes:** `slug` (unique), `status`
- **Key fields:** `slug`, `title`, `body`, `status`, `metaTitle`, `metaDescription`

---

**Total: 41 models**
