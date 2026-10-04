# PawTag Membership Lifecycle System

**Last updated:** 2026-10-01
**Status:** Active — authoritative reference for membership upgrade/downgrade lifecycle
**Branch:** `feature/membership-lifecycle-system`

---

## 1. Business Rules

| Rule | Behavior |
|---|---|
| **Upgrade** | Effective immediately. Prorated charge today. New benefits activate now. |
| **Downgrade** | Effective at end of current subscription cycle. Current benefits remain until `currentPeriodEnd`. |
| **Downgrade — Guardian Points** | Points-based clawback: customer keeps points earned at lower tier rates; loses multiplier bonus earned at higher tier. |
| **Downgrade — Entitlements** | All enhanced entitlements (free shipping threshold, accessory discount, notifications, tag limit, etc.) revert at renewal. |
| **Downgrade — Consent** | Customer must see exact consequences (points lost, entitlements lost) and explicitly accept terms before confirming. |
| **Payment cards** | Saved on every payment. Visible to customer and admin. Customer can add/change/delete. Auto-renew fails gracefully if no valid card. |
| **Audit** | Every membership action logged with full context (who, what, when, from where, device). Available to CSR against customer profile. |

---

## 2. Membership Lifecycle State Machine

```
                        ┌─────────────────┐
                        │   SUBSCRIBE     │
                        │  (new member)   │
                        └────────┬────────┘
                                 │ Stripe PaymentIntent
                    ┌────────────▼────────────┐
                    │    pending_payment      │
                    └────────────┬────────────┘
                                 │ webhook confirms payment
                    ┌────────────▼────────────┐
                    │        ACTIVE           │◄──────────────────┐
                    │  currentPeriodStart     │                   │
                    │  currentPeriodEnd       │                   │
                    │  dunningStatus: active  │                   │
                    └──┬──────────┬───────────┘                   │
                       │          │                                │
            ┌──────────▼──┐  ┌────▼──────────┐  ┌────────────────▼──┐
            │  UPGRADE    │  │  DOWNGRADE    │  │     RENEWAL        │
            │  (Gold→Plat)│  │  (Plat→Gold)  │  │  (period extends)  │
            └──────────┬──┘  └────┬──────────┘  └────────────────┬──┘
                       │          │                               │
              Stripe charges    Stripe creates               Stripe charges
              proration         credit note                   renewal price
              NOW               (applied at renewal)          at currentPeriodEnd
                       │          │                               │
              ┌────────▼──┐  ┌────▼──────────┐  ┌────────────────▼──┐
              │  INVM-    │  │  Pending:     │  │     INVM-         │
              │  invoice  │  │  pendingTierId│  │     invoice       │
              │  + email  │  │  + consent    │  │  + email          │
              └───────────┘  └────┬──────────┘  │  + period ADVANCE │
                                  │              │  + downgrade exec │
                           at currentPeriodEnd    └───────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  DOWNGRADE EXECUTED       │
                    │  ├─ tierId flipped        │
                    │  ├─ points clawback       │
                    │  ├─ entitlements reverted │
                    │  ├─ cache invalidated     │
                    │  └─ email + audit         │
                    └───────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  CANCEL (cancel_at_period_end)                              │
  │  ├─ Stripe subscription cancelled at period end             │
  │  ├─ DB tier remains active until currentPeriodEnd            │
  │  ├─ Benefits continue until period end                      │
  │  └─ Then → EXPIRED                                          │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  PAYMENT FAILURE (renewal)                                  │
  │  ├─ Stripe retries automatically (up to ~4 times)           │
  │  ├─ dunningStatus: past_due                                 │
  │  ├─ Customer notified                                       │
  │  ├─ CSR alerted                                             │
  │  └─ If all retries fail → EXPIRED after grace period        │
  └─────────────────────────────────────────────────────────────┘
```

---

## 3. Decision Tree — Customer Actions

### 3.1 Upgrade (Gold → Platinum)

```
Customer on /account/membership/subscribe
    │
    ▼
Sees "Upgrade to Platinum" button
    │
    ▼
Clicks → fetchEstimate() called
    │
    ▼
Estimate panel shows:
  • "You'll be charged $X today for remaining Y days"
  • Current plan vs New plan
  • Prorated amount
  • Next renewal date
  • If cancelling: "This upgrade also resumes your membership"
    │
    ▼
Customer clicks "Confirm Upgrade — $X"
    │
    ▼
POST /membership/change-tier { tierId, prorationBehavior: 'now' }
    │
    ▼
Backend:
  1. Validates active membership
  2. If cancelledAt set (cancelling window):
     - Stripe: price update + cancel_at_period_end=false + create_prorations
     - Local after Stripe success: clear cancelledAt, autoRenew=true
  3. Else Stripe: price update + create_prorations
  4. Creates INVM- invoice for proration charge
  5. Sends invoice email + tier-change email
  6. Updates membership.tierId + price
  7. Re-evaluates tag coverage
  8. Invalidates entitlement cache
  9. Audit log (action membership_tier_changed or membership_tier_changed_resumed)
    │
    ▼
Success screen:
  • "Welcome to Platinum!"
  • If resumed: "Membership resumed — auto-renew back on"
  • Invoice number + prorated amount
  • "Check your email for invoice"
    │
    ▼
Redirect to /account/membership
```

**Fail-closed rules:** Stripe rejection (missing/canceled sub, card error) leaves local tier and cancel state unchanged. Typed error codes returned to the client (`membership.payment_method_required`, etc.).

### 3.2 Downgrade (Platinum → Gold)

```
Customer on /account/membership/subscribe
    │
    ▼
Sees "Downgrade to Gold" button (amber styled)
    │
    ▼
Clicks → fetchEstimate() called
    │
    ▼
Estimate panel shows:
  • "Your Gold benefits start at renewal on {date}"
  • Current plan vs New plan
  • Points at risk: {N} Guardian points
  • Entitlements lost: [Free shipping $80, 2× Points, ...]
  • Credit applied: ${X} (negative, applied at renewal)
  • Effective date: {currentPeriodEnd}
    │
    ▼
Customer clicks "Confirm Change"
    │
    ▼
⚠️  DOWNGRADE CONFIRMATION MODAL APPEARS
    │
    ▼
Modal shows:
  • Title: "Downgrade to Gold?"
  • Warning box: "Your benefits will change at renewal"
  • Points at risk: "You will lose {N} Guardian points"
  • Entitlements checklist (red crosses)
  • Effective date: "Gold benefits start {date}"
  • Required checkbox: "I understand and accept these changes"
  • Optional: reason select
    │
    ▼
Customer checks box → clicks "Schedule Downgrade"
    │
    ▼
POST /membership/downgrade { tierId, reason, termsAccepted: true, termsVersion: 'v1' }
    │
    ▼
Backend:
  1. Validates termsAccepted === true
  2. Records pendingTierId, pendingTierEffectiveAt
  3. Records downgradeTermsAcceptedAt + version
  4. Updates Stripe subscription price (proration: create_prorations)
  5. Sends downgrade-scheduled email
  6. Audit log with acceptance metadata
    │
    ▼
Success screen:
  • "Downgrade scheduled for {date}"
  • "Current benefits remain until then"
  • Summary of what changes at renewal
    │
    ▼
At currentPeriodEnd (background job):
  • Checks Stripe renewal succeeded
  • If yes: flips tier, applies points clawback, extends period
  • If no: keeps current tier, notifies customer of payment issue
```

### 3.3 Cancellation

```
Customer on /account/membership
    │
    ▼
Clicks "Cancel Membership"
    │
    ▼
Cancel modal shows:
  • "Benefits remain active until {date}"
  • List of benefits being lost
  • Reason select (required)
  • "Keep Membership" / "Cancel Membership" buttons
    │
    ▼
POST /membership/cancel { reason }
    │
    ▼
Backend:
  1. Updates Stripe subscription: cancel_at_period_end = true
  2. Sets membership.cancelledAt, cancellationReason
  3. Sets membership.autoRenew = false
  4. Does NOT strip User.membershipTier (benefits until period end)
  5. Generates retention offer
  6. Sends cancellation email
  7. Audit log
    │
    ▼
At currentPeriodEnd:
  • Stripe subscription actually cancelled
  • Benefits expire
  • checkExpiredMemberships marks as 'expired'
```

### Stripe Billing Portal cancel/resume sync

When a customer cancels or resumes in the **Stripe Billing Portal** (not PawTag UI):

1. Stripe keeps subscription `status: active` but toggles `cancel_at_period_end`
2. Webhook `customer.subscription.updated` updates local `UserMembership` (and tag `Subscription`):
   - cancel → `cancelledAt` set, `autoRenew=false`
   - resume → `cancelledAt` cleared, `autoRenew=true`
3. Audit events: `membership_cancelled_via_stripe` / `membership_resumed_via_stripe`

This prevents portal cancels from desyncing upgrade/resume flows.

---

## 4. Data Model Changes

### UserMembership — new fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `pendingTierId` | ObjectId (ref MembershipTier) | null | Target tier for scheduled downgrade |
| `pendingTierEffectiveAt` | Date | null | When pending tier takes effect |
| `downgradeRequestedAt` | Date | null | When customer requested downgrade |
| `downgradeTermsAcceptedAt` | Date | null | When customer accepted terms |
| `downgradeTermsVersion` | String | null | Terms version accepted |
| `downgradeReason` | String | null | Customer-provided reason |
| `downgradeCancelledAt` | Date | null | If customer cancels pending downgrade |
| `dunningStatus` | String enum | 'active' | `active \| past_due \| expired` |
| `dunningRetryCount` | Number | 0 | How many payment retries attempted |
| `dunningLastAttemptAt` | Date | null | Last payment attempt timestamp |

### GuardianPointsLedger.metadata — new fields

| Field | Type | Purpose |
|---|---|---|
| `basePoints` | Number | Points before multiplier (forward-only) |
| `multiplier` | Number | Multiplier applied at earn time |
| `bonusPoints` | Number | Points earned from multiplier |

### AuditEvent — new field

| Field | Type | Purpose |
|---|---|---|
| `subjectUserId` | ObjectId (indexed) | Customer affected by this event |

---

## 5. Guardian Points Clawback Formula

```
points_earned_at_higher_tier = SUM(ledger.points WHERE multiplier > newTierMultiplier)
clawback = floor(points_earned_at_higher_tier × (1 - newMultiplier / oldMultiplier))
final_balance = current_balance - clawback
```

**Example:**
- Gold (1×) → earned 100 points
- Upgraded to Black (3×) → earned 200 more points
- Total balance: 300 points
- Downgrade to Platinum (2×): clawback = floor(200 × (1 - 2/3)) = floor(200 × 0.333) = 66
- Final balance: 234 points

**For historical rows** (no base/multiplier split): Best-effort derivation using tier multiplier at earn time. New ledger entries carry exact data.

---

## 6. API Endpoints

### Customer endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/membership/tiers` | List tiers with entitlements |
| GET | `/membership/status` | User's membership status |
| GET | `/membership/change-tier/estimate` | Proration estimate |
| POST | `/membership/subscribe` | New subscription |
| POST | `/membership/activate` | Activate after payment |
| POST | `/membership/change-tier` | Immediate tier change (upgrade) |
| POST | `/membership/downgrade` | Request deferred downgrade |
| POST | `/membership/cancel` | Cancel membership |
| GET | `/membership/payment-methods` | List saved cards from Stripe |
| POST | `/membership/payment-methods/portal` | Stripe Billing Portal session |
| GET | `/membership/invoices` | Membership invoice history |

### Admin endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/membership/subscribers` | List subscribers |
| GET | `/admin/membership/subscribers/:id` | Subscriber detail |
| POST | `/admin/membership/change-tier` | Admin tier change (requires evidence) |
| POST | `/admin/membership/cancel` | Admin cancel (requires evidence) |
| POST | `/admin/membership/extend` | Admin extension |
| GET | `/admin/users/:id/membership-audit` | Customer-scoped audit history |

---

## 7. UI Design Mockups

### 7.1 Upgrade Estimate Panel

```
┌─────────────────────────────────────────────────────────────┐
│  ⓘ Upgrade to Platinum                                      │
│  You'll be charged NZ$2.47 today for the remaining 100      │
│  days of your current period. Your Platinum benefits         │
│  start immediately, and your next full renewal of            │
│  NZ$99/year will be on 30 Sep 2027.                         │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ Current plan          Gold — NZ$89/year               │   │
│  │ New plan              Platinum — NZ$99/year           │   │
│  │ Billing period        100 of 365 days                 │   │
│  │ ─────────────────────────────────────────────────────  │   │
│  │ Charged today                      NZ$2.47            │   │
│  │ Next full renewal: NZ$99/year on 30 Sep 2027          │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────┐  ┌──────────┐                      │
│  │ Confirm Upgrade      │  │ Cancel   │                      │
│  │ — NZ$2.47            │  │          │                      │
│  └──────────────────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Downgrade Estimate Panel

```
┌─────────────────────────────────────────────────────────────┐
│  ⓘ Downgrade to Gold                                        │
│  Your Gold benefits start at renewal on 30 Sep 2027.        │
│  Current Platinum benefits remain until then.               │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ Current plan          Platinum — NZ$99/year           │   │
│  │ New plan              Gold — NZ$89/year               │   │
│  │ Billing period        364 of 365 days                 │   │
│  │ ─────────────────────────────────────────────────────  │   │
│  │ Credit applied                     NZ$-9.97           │   │
│  │ Next full renewal: NZ$89/year on 30 Sep 2027          │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────┐  ┌──────────┐                      │
│  │ Confirm Change       │  │ Cancel   │                      │
│  └──────────────────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Downgrade Confirmation Modal

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Downgrade to Gold?                              [X]   │
│                                                              │
│  Your Platinum benefits will change to Gold at the           │
│  end of your current billing period (30 Sep 2027).           │
│                                                              │
│  ┌─ Points at Risk ──────────────────────────────────────┐   │
│  │ You will lose 66 Guardian points                      │   │
│  │ (earned at Platinum 2× multiplier rate)               │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Benefits You'll Lose ────────────────────────────────┐   │
│  │ ✕  Free shipping over NZ$80  →  will revert to NZ$100│   │
│  │ ✕  2× Guardian Points       →  will revert to 1×     │   │
│  │ ✕  5% accessory discount    →  will revert to 0%     │   │
│  │ ✕  Cover up to 10 tags      →  will revert to 3      │   │
│  │ ✓  Email notifications      →  will remain enabled   │   │
│  │ ✓  Medical alerts           →  will remain enabled   │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Effective Date ──────────────────────────────────────┐   │
│  │ Gold benefits will be active from 30 Sep 2027         │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Credit ──────────────────────────────────────────────┐   │
│  │ NZ$-9.97 will be applied to your next renewal invoice │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ☐ I understand and accept these changes                     │
│                                                              │
│  Reason (optional): [Select reason           ▼]             │
│                                                              │
│  ┌────────────────────────┐  ┌──────────────┐               │
│  │ Schedule Downgrade     │  │ Cancel       │               │
│  └────────────────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Downgrade Success Screen

```
┌─────────────────────────────────────────────────────────────┐
│                         ✓                                   │
│                                                              │
│  Downgrade Scheduled                                         │
│                                                              │
│  Your downgrade to Gold has been scheduled for               │
│  30 Sep 2027.                                                │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ Until then, you keep:                                 │   │
│  │  ✓ Platinum benefits (10 tags, 2× points, etc.)     │   │
│  │                                                      │   │
│  │ At renewal, you'll receive:                          │   │
│  │  • Gold benefits (3 tags, 1× points, etc.)          │   │
│  │  • NZ$-9.97 credit on your renewal invoice           │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  A confirmation email has been sent.                         │
│                                                              │
│  Redirecting...                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 Membership Manage — Payment Method Section

```
┌─────────────────────────────────────────────────────────────┐
│  Payment Method                              [Update]       │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  💳  Visa ending in 4242                             │   │
│  │      Expires 12/2028                                  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  Default payment method for auto-renewal.                    │
│  Click "Update" to change via Stripe secure portal.         │
└─────────────────────────────────────────────────────────────┘
```

### 7.6 CSR Admin — Membership Subscriber Detail

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Subscribers                                      │
│                                                              │
│  ┌─ Header ──────────────────────────────────────────────┐   │
│  │  👑  Platinum Membership            [Active]          │   │
│  │  John Smith (john@example.com)                        │   │
│  │  Renews: 30 Sep 2027 · NZ$99/year                    │   │
│  │  Payment: Visa ending in 4242                         │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  [Extend 30 Days] [Change Tier] [Cancel] [Portal]           │
│                                                              │
│  ┌─ Pending Downgrade ───────────────────────────────────┐   │
│  │  ⚠ Downgrade to Gold scheduled for 30 Sep 2027       │   │
│  │  Requested: 01 Oct 2026 · Terms accepted v1          │   │
│  │  [Cancel Pending Downgrade]                           │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Guardian Points ─────────────────────────────────────┐   │
│  │  Balance: 234 points · Gold tier (1× multiplier)     │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Tags Covered ────────────────────────────────────────┐   │
│  │  PT-001  [Active]    PT-002  [Active]                │   │
│  │  PT-003  [Active]                                     │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Billing History ─────────────────────────────────────┐   │
│  │  INVM-000003  NZ$2.47   01 Oct 2026  [View]          │   │
│  │  INVM-000001  NZ$89.00  01 Oct 2025  [View]          │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Membership Audit Trail ──────────────────────────────┐   │
│  │  01 Oct 2026  tier_changed     user      192.168.1.1  │   │
│  │  01 Oct 2026  downgrade_req    user      192.168.1.1  │   │
│  │  01 Oct 2025  activated        webhook   system       │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Email Templates

| Template | Trigger | Key Content |
|---|---|---|
| `membership-tier-changed` | Upgrade or downgrade | Upgrade: "Effective now, charged $X". Downgrade: "Effective {date}" |
| `membership-downgrade-scheduled` | Downgrade request | "Downgrade to {tier} scheduled for {date}" |
| `membership-renewal-success` | Renewal paid | "Renewed for another year. Invoice: {number}" |
| `membership-payment-failed` | Renewal failed | "Payment failed. Update card. Benefits until {date}" |
| `membership-downgrade-executed` | Downgrade applied | "Now on {tier}. Points updated to {N}" |
| `membership-cancelled` | Cancellation | "Benefits until {date}" (aligned with behavior) |

---

## 9. Audit Events

| Event | Category | Severity | Key Metadata |
|---|---|---|---|
| `membership.created` | FINANCIAL | HIGH | userId, tierId, price, stripeCustomerId |
| `membership.tier_changed` | UPDATE | HIGH | oldTier, newTier, prorationAmount, stripeInvoiceId |
| `membership.downgrade_requested` | UPDATE | HIGH | pendingTierId, termsVersion, pointsAtRisk |
| `membership.downgrade_executed` | FINANCIAL | HIGH | oldTier, newTier, pointsClawback |
| `membership.cancelled` | FINANCIAL | HIGH | reason, cancelAtPeriodEnd |
| `membership.renewed` | FINANCIAL | HIGH | invoiceId, amount, newPeriodEnd |
| `membership.payment_failed` | FINANCIAL | HIGH | stripeInvoiceId, dunningStatus |
| `membership.expired` | FINANCIAL | HIGH | tierId, reason |
| `membership.payment_method_updated` | UPDATE | MEDIUM | cardBrand, cardLast4 |

---

## 10. Monitoring & Observability

### System Logs (Pino structured logs)

| Log point | Level | Context |
|---|---|---|
| Stripe subscription updated | info | membershipId, oldTier, newTier, prorationAmount |
| Invoice created | info | invoiceId, invoiceNumber, amount, stripeInvoiceId |
| Invoice email sent | info | invoiceId, email |
| Tier change executed | info | membershipId, oldTier, newTier |
| Points clawback applied | info | userId, clawbackAmount, oldBalance, newBalance |
| Payment failure detected | warn | membershipId, stripeInvoiceId, dunningStatus |
| Dunning retry scheduled | warn | membershipId, retryCount, nextAttemptAt |
| Renewal period extended | info | membershipId, newPeriodEnd |
| Downgrade scheduled | info | membershipId, pendingTierId, effectiveAt |

### Audit Events (immutable, hash-chained)

All membership lifecycle actions generate audit events with:
- Real request context (IP, user-agent, actor ID)
- `subjectUserId` for customer-scoped queries
- Before/after state for changes
- Metadata with business context

### Admin Notifications

| Trigger | Recipient | Channel |
|---|---|---|
| Membership payment failed | Admin alert email | Email + in-app |
| Downgrade scheduled | — (customer only) | — |
| Downgrade executed | — (customer only) | — |
| Dunning exhausted | Admin alert email | Email + in-app |

---

## 11. File Reference

### Models
- `packages/db/src/models/UserMembership.ts` — membership record
- `packages/db/src/models/MembershipTier.ts` — tier definitions
- `packages/db/src/models/GuardianPointsLedger.ts` — points ledger
- `packages/db/src/models/Invoice.ts` — invoice records
- `packages/db/src/models/AuditEvent.ts` — audit events

### Services
- `packages/api/src/services/membership.service.ts` — core membership logic
- `packages/api/src/services/membership-entitlement.service.ts` — entitlement registry
- `packages/api/src/services/loyalty/points-earning.service.ts` — Guardian points

### Routes
- `packages/api/src/routes/membership.ts` — customer membership API
- `packages/api/src/routes/admin-membership.ts` — admin membership API
- `packages/api/src/routes/stripe-webhooks.ts` — Stripe webhook handlers

### Jobs
- `packages/api/src/jobs/membershipScheduledDowngrades.js` — deferred downgrade execution
- `packages/api/src/jobs/membershipDunning.js` — payment failure handling

### Frontend
- `apps/web/src/pages/account/MembershipSubscribe.tsx` — tier selection + downgrade consent
- `apps/web/src/pages/account/MembershipManage.tsx` — membership management
- `apps/admin/src/pages/MembershipSubscriberDetail.tsx` — CSR detail view
