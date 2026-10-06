# Current-State Audit Synthesis

This document consolidates the verified review findings that should drive the new execution sequence. It is not a substitute for re-running Phase 00 against the exact checkout branch the agent will modify.

## Evidence problem in current status reporting

The current `docs/MVP_IMPLEMENTATION_STATUS.md` marks many work packets complete, including mobile real-device validation. However `docs/MOBILE-REAL-DEVICE-VALIDATION.md` contains an unchecked physical-device checklist. Therefore status completion must be reset to executed evidence rather than plan/checklist existence.

## Verified code-level risks from the current repository snapshot

### 1. Inventory confirmation can silently no-op

`packages/api/src/commerce/services/inventory.service.ts` uses `findOneAndUpdate()` in `confirmSale()`, but when the conditional update returns no result the function reaches the end without throwing. Checkout can therefore proceed believing stock was committed when it was not.

### 2. PendingOrder TTL can bypass reservation cleanup

`packages/db/src/models/PendingOrder.ts` uses a TTL index on `expiresAt`. MongoDB TTL deletion removes the document asynchronously without executing PawTag compensation logic. If stock/rewards are tied to that record, abandoned checkout state can disappear while reservations remain.

### 3. PawRewards “reservation” is not yet a true reservation

`checkout.service.ts` reads the current `pawRewardsBalance`, takes `Math.min(requested, available)`, discounts the total, and stores reservation-like fields, but that read does not atomically reserve the balance. Concurrent checkouts can race unless a separate atomic reservation ledger/conditional write exists.

### 4. Resend webhook path is inconsistent

The API mounts the router at `/api/webhooks/resend` while `resend-webhooks.ts` declares `router.post('/resend', ...)`, creating an effective double path. The previous review also found no provider signature verification. This must be re-verified/fixed before delivery-state webhooks are trusted.

### 5. Legacy mobile push architecture is mismatched

Current Expo code requests an Expo push token, while the API push service sends through Firebase Admin. Those token ecosystems are not interchangeable by assumption. The new web-first Capacitor plan must choose an explicit provider/token architecture.

### 6. Checkout Step 1 still breaks the intended persistent 70/30 shell

`apps/web/src/pages/Checkout.tsx` contains a `max-w-2xl` delivery region, while later sections use 12-column 8/4 layouts. This confirms the founder's observation: the checkout does not maintain one premium 70/30 structure across steps.

## Prior verified high-severity items that must be re-proven after implementation

The previous comprehensive review also identified:

- rewards/promo concurrency integrity;
- expired checkout stock/reward cleanup;
- partial paid-order/entitlement/document states;
- webhook stale-processing recovery;
- fallback shipping method identity and rate correctness;
- fake/demo shipping tracking in production;
- membership entitlement before authoritative payment;
- browser refresh-token migration completeness;
- critical email fire-and-forget behavior;
- shipping quote race/stale client fields;
- zero-total checkout behavior;
- single authoritative order creation/finalization path;
- browser E2E absence;
- saved-address and save-address checkout UX defects;
- native real-device evidence gaps.

Do not assume a historical “done” checkbox resolves these. Inspect current source and tests in the relevant phase and mark them `PROVEN` only when evidence exists.

## New strategic work introduced by today's discussion

### Web-first iOS/Android

The target is no longer a separately rendered React Native customer app. `apps/web` becomes the customer UI source; Capacitor supplies the native shell and device bridges. No Finder native app. No Admin native app in current MVP.

### DynamoDB migration

The requested persistence direction is an incremental MongoDB/Mongoose -> DynamoDB migration. It must start with access-pattern discovery and repository boundaries, not model-by-model conversion.

### Donation system

The proposed donation feature is large enough to be a financial domain. It must support supporters without pets, one-time/monthly giving, Stripe/webhooks, receipts, customer/admin portals, refunds and reconciliation. New Zealand tax-credit/donee/receipt wording is an external gate; the coding agent must not invent it.

## Technical-lead sequencing decision

Stabilize and prove the current customer/recovery/commerce platform before large persistence migration or new donation functionality. That reduces the number of simultaneous moving parts and makes later migration/donation defects distinguishable from existing MVP defects.
