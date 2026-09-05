# PawTag Subscription & Loyalty Strategy — Research, Gap Analysis & Implementation Plan

**Date:** September 2026
**Status:** Strategic Analysis — Pending Business Decisions
**Scope:** Full audit of PawTag's subscription system, market research, loyalty program design, and implementation roadmap

---

# PART A: TECHNICAL FINDINGS

---

## 1. Data Model (Source of Truth: `packages/db/src/models/Subscription.ts`)

### 1.1 Subscription Schema

| Field | Type | Purpose |
|-------|------|---------|
| `userId` | ObjectId | Owner |
| `tagId` | ObjectId | Physical product linked to subscription |
| `orderId` | ObjectId | Purchase order |
| `planId` | ObjectId | Product reference |
| `planType` | enum | `annual`, `monthly`, `free` |
| `status` | enum | `active`, `expired`, `grace_period`, `cancelled`, `pending_payment` |
| `price` | Number | **Monthly equivalent** price (NOT annual) |
| `autoRenew` | Boolean | User-controlled toggle |
| `startDate` | Date | Subscription start |
| `endDate` | Date | Subscription end |
| `nextBillingDate` | Date | Next charge date |
| `lastRenewalDate` | Date | Last successful renewal |
| `gracePeriodEnd` | Date | End of 4-week grace period |
| `cancelledAt` | Date | Cancellation timestamp |
| `cancelledBy` | enum | `user`, `system`, `admin` |
| `cancellationReason` | String | Free-text reason |
| `cancelAtPeriodEnd` | Boolean | Wait until `endDate` before cancelling |
| `metadata.renewalAttempts` | Number | Renewal retry counter |
| `metadata.lastRenewalAttemptAt` | Date | Last retry timestamp |
| `metadata.renewalFailureReason` | String | Why renewal failed |

**Key indexes:** unique compound (`userId` + `tagId`), unique (`tagId`), status, `nextBillingDate`, `cancelAtPeriodEnd`

### 1.2 Subscription Statuses

| Status | Meaning | Transitions To |
|--------|---------|----------------|
| `active` | Paid and running | `expired`, `cancelled`, `grace_period` |
| `expired` | Past end date, not renewed | `active` (renew), `grace_period`, `cancelled` |
| `grace_period` | 4-week window after expiry | `active` (renew), `cancelled` |
| `cancelled` | User/admin/system cancelled | `active` (renew) |
| `pending_payment` | Awaiting first payment | `active`, `cancelled` |

### 1.3 Plan Types

| Plan | Monthly Price | Annual Price | Free Period |
|------|-------------|-------------|------------|
| Monthly | $1.99/mo | N/A | 12 months free, then $1.99/mo |
| Annual | N/A | $0.99/mo ($11.88/yr) | 12 months free, then $0.99/mo |
| Free | $0 | $0 | Lifetime free (limited features) |

### 1.4 Product Model Subscription Config (`packages/db/src/models/Product.ts`)

Products have subscription-related fields:

```typescript
isSubscription: boolean          // Is this a subscription product?
subscriptionConfig: {
  billingInterval: 'monthly' | 'annual' | 'one-time'
  trialPeriodDays: number        // Default: 365 (12 months)
  hasTrial: boolean
  features: string[]             // Feature list for this tier
  maxPets: number                // Max pets allowed
  maxTags: number                // Max tags allowed
  gracePeriodDays: number        // Default: 28
  autoRenewByDefault: boolean    // Default: true
}
```

---

## 2. API Routes

### 2.1 Customer Subscription Routes (`packages/api/src/routes/customer-subscriptions.ts`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET /` | List subscriptions | Filter by status, plan type; paginated |
| `GET /:id` | Subscription detail | Full subscription with invoices |
| `POST /:id/cancel` | Cancel subscription | Requires reason; sets `cancelAtPeriodEnd` |
| `POST /:id/renew` | Manual renewal | Extends by 30 days; creates $0 invoice |
| `PUT /:id/auto-renew` | Toggle auto-renew | User-controlled on/off |
| `PUT /:id/change-plan` | Change plan | Annual→Monthly or vice versa; updates price |
| `GET /:id/stripe-portal` | Stripe billing portal | Redirects to Stripe for card management |

### 2.2 Admin Subscription Routes (`packages/api/src/routes/admin-subscriptions.ts`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET /` | List all subscriptions | Filter by status, plan type, search (email/name/tag) |
| `GET /stats` | Subscription statistics | Total MRR, counts by status |
| `GET /:id` | Subscription detail | Full subscription with invoices |
| `PUT /:id/status` | Override status | Admin can force any status change |
| `POST /:id/extend` | Extend subscription | Add N days, optionally auto-reactivate |

### 2.3 Subscription Service (`packages/api/src/services/subscription.service.ts`)

**`createSubscription()`** — Creates subscription, links to tag, logs audit event
**`startSubscriptionService()`** — Hourly background job:
1. Expiring subscriptions (30-day warning email)
2. Expired → grace_period transition (4-week grace)
3. Grace period expiry (set inactive)
4. Auto-renewal processing (in-memory timer)

### 2.4 Webhook Handlers (`packages/api/src/routes/stripe-webhooks.ts`)

| Event | Handler | Action |
|-------|---------|--------|
| `payment_intent.succeeded` | Recovery path | Creates PendingOrder if needed |
| `invoice.payment_succeeded` | Renewal | Updates existing subscription dates/status |
| `customer.subscription.deleted` | Cancellation | Sets subscription to cancelled |

---

## 3. Background Service — Hourly Subscription Checks

**File:** `packages/api/src/services/subscription.service.ts`

```
Every hour:
1. Find subscriptions ending in 30 days → send renewal reminder email
2. Find subscriptions past end date (not grace_period) → set to grace_period
3. Find grace period subscriptions past gracePeriodEnd → set to inactive
4. Process auto-renewals (in-memory timer based)
```

**Critical finding:** Renewal timers are stored **in-memory only**. If the server restarts, all pending renewal timers are lost. This is a reliability risk.

---

## 4. Email Templates (Subscription Lifecycle)

**Location:** `packages/api/src/services/email/templates/`

| Template | Purpose | Inline HTML? |
|----------|---------|-------------|
| `subscription-renewal-reminder.ts` | 30/7/1-day renewal warnings | Yes |
| `subscription-renewed.ts` | Successful renewal confirmation | Yes |
| `subscription-expired.ts` | Subscription expired notice | Yes |
| `subscription-grace-period.ts` | Grace period warning (weekly) | Yes |
| `subscription-cancelled.ts` | Cancellation confirmation | Yes |

**Notable:** All subscription email templates are inline HTML (not CMS-driven like other templates). This means they can't be edited by admins without code changes.

---

## 5. Subscription Creation Flow — THE CRITICAL GAP

### 5.1 `createSubscription()` Is Never Called

The function `createSubscription()` exists at `packages/api/src/services/subscription.service.ts:49` but is **never imported or called by any production code**. It is only imported and tested in `tests/unit/subscription.service.test.ts`.

### 5.2 Every Code Path Checked

| Code Path | File | Creates Subscription? |
|-----------|------|----------------------|
| `createSubscription()` | `packages/api/src/services/subscription.service.ts:49` | Yes (but never called) |
| `POST /checkout/confirm` | `packages/api/src/commerce/services/checkout.service.ts:205` | **No** |
| `POST /customer/orders/place` | `packages/api/src/services/order-creation.service.ts:121` | **No** |
| `POST /customer/tags/redeem` | `packages/api/src/routes/customer.ts:423` | **No** |
| Mobile RedeemTagScreen | `apps/mobile/src/screens/tags/RedeemTagScreen.tsx` | **No** (calls redeem) |
| `POST /webhooks/stripe` | `packages/api/src/routes/stripe-webhooks.ts` | **No** |
| Admin subscription routes | `packages/api/src/routes/admin-subscriptions.ts` | **No** |
| Customer subscription routes | `packages/api/src/routes/customer-subscriptions.ts` | **No** |
| Background subscription service | `packages/api/src/services/subscription.service.ts:37` | **No** |
| Tests only | `tests/unit/subscription.service.test.ts` | Mocked |

### 5.3 The Intended Flow (Never Wired)

```
Customer buys tag
  → Order created (checkout or direct API)
  → Tag created with subscriptionStatus: 'none'
  → Tag redeemed (activation)
  → ??? createSubscription() should be called here but isn't ???
  → Subscription should exist but doesn't
  → Background service runs hourly but finds no subscriptions to manage
```

### 5.4 Test Evidence

The integration test at `tests/integration/subscriptions.test.ts` confirms this by **manually inserting subscription documents directly into MongoDB** via `mongoose.connection.collections.subscriptions.insertOne()` rather than going through any API flow.

---

## 6. CMS Settings — Exist But Aren't Consumed

**Location:** `packages/api/src/seeds/seed-cms.ts`

### 6.1 Seeded Subscription Settings

| Key | Default | Hardcoded Fallback | Consumed By |
|-----|---------|-------------------|-------------|
| `subscription.plan.annualPrice` | `11.88` | `11.88` in `createSubscription()` | **Nothing** |
| `subscription.plan.monthlyPrice` | `1.99` | `1.99` in `createSubscription()` | **Nothing** |
| `subscription.plan.annualName` | `Annual Plan` | Hardcoded | **Nothing** |
| `subscription.plan.monthlyName` | `Monthly Plan` | Hardcoded | **Nothing** |
| `subscription.trial.durationDays` | `365` | `365` in `checkSubscriptions()` | **Nothing** |
| `subscription.grace.durationDays` | `28` | `28` (hardcoded fallback) | Partially |
| `subscription.renewal.reminderDays` | `[30,7,1]` | `[30,7,1]` (hardcoded fallback) | Partially |
| `subscription.renewal.autoRenewEnabled` | `true` | Hardcoded | **Not enforced** |
| `subscription.renewal.retryAttempts` | `3` | `3` in `processAutoRenewals()` | **Not used for actual retries** |
| `subscription.renewal.retryIntervalHours` | `24` | `24` in `processAutoRenewals()` | **Not used for actual retries** |

### 6.2 Hardcoded Values in Subscription Service

```typescript
// packages/api/src/services/subscription.service.ts
const FREE_PERIOD_MONTHS = 12;        // Should read from CMS
const GRACE_PERIOD_WEEKS = 4;         // Should read from CMS
const REMINDER_DAYS = [30, 7, 1];     // Should read from CMS
const PRICE_MONTHLY = 1.99;           // Should read from CMS
const PRICE_ANNUAL = 11.88;           // Should read from CMS
```

---

## 7. Frontend — Subscription Management

### 7.1 Customer Portal (`apps/web/src/pages/account/Subscriptions.tsx`)

- Lists user's subscriptions with status badges
- Shows plan type, price, renewal date
- Cancel/Change Plan buttons
- Stripe portal redirect for card management

### 7.2 Admin Portal (`apps/admin/src/pages/SubscriptionsPage.tsx`)

- Full subscription list with filters (status, plan type, search)
- Basic stats (total MRR, status counts)
- Admin status override
- Extend subscription by N days

### 7.3 Mobile App (`apps/mobile/src/screens/account/SubscriptionScreen.tsx`)

- Read-only subscription display
- All management delegated to Stripe portal

---

## 8. Analytics & Reporting — What Exists vs What's Missing

### 8.1 EXISTS (Strong)

| Capability | Location |
|-----------|----------|
| Dashboard revenue/orders/tags | `apps/admin/src/pages/Dashboard.tsx` |
| Lost & found statistics | `apps/admin/src/pages/Statistics.tsx` |
| Basic subscription stats (MRR, counts) | `apps/admin/src/pages/SubscriptionsPage.tsx` |
| Feature flags (CRUD) | `apps/admin/src/pages/FeatureFlags.tsx` |
| Refund reporting & export | `apps/admin/src/pages/RefundReport.tsx` |
| Accounting integrations (Xero, GL, CSV) | `packages/api/src/integrations/accounting/` |
| Payment reconciliation | `apps/admin/src/pages/PaymentReconciliation.tsx` |
| Webhook monitoring | `apps/admin/src/pages/WebhookSettings.tsx` |
| Referral program tracking | `apps/admin/src/pages/Referrals.tsx` |
| Infrastructure metrics | `packages/api/src/lib/metrics.ts` |
| Audit trail (hash chain) | `apps/admin/src/pages/AuditTrail.tsx` |
| System logs | `apps/admin/src/pages/SystemLogs.tsx` |
| Tag expiry notifications | `apps/admin/src/pages/TagExpiryNotifications.tsx` |
| Orders CSV export | `apps/admin/src/pages/Orders.tsx` |

### 8.2 MISSING (Critical Gaps)

| Capability | Impact |
|-----------|--------|
| MRR trend over time | No historical MRR data points; point-in-time snapshot only |
| Churn rate | No churn calculation (subscriptions lost per period / total) |
| Net Revenue Retention (NRR) | No expansion vs contraction vs churn tracking |
| Cohort analysis | No grouping of subscribers by signup month |
| Lifetime Value (LTV) | No per-customer or per-plan LTV |
| Subscription conversion tracking | No free-to-paid, trial-to-paid rates |
| Upgrade/downgrade tracking | No plan change events or revenue impact |
| Average subscription duration | No calculation |
| Renewal rate | No auto-renew success/failure tracking |
| Subscription revenue by plan | No MRR breakdown per plan |
| A/B testing infrastructure | None exists |
| Conversion funnel analytics | No checkout/onboarding funnel |
| Customer segmentation | No behavioral or value-based segments |
| Revenue forecasting | No predictive analytics |
| Promo code effectiveness | No usage analytics or ROI tracking |
| Mobile app analytics | No screen flow or drop-off tracking |
| Automated report scheduling | No scheduled reports |

---

## 9. Subscription Lifecycle — Complete Code Trace

### 9.1 Renewal Flow

```
Hourly service checks:
  → Find subscriptions where nextBillingDate <= now
  → If autoRenew enabled:
      → processAutoRenewals()
      → Currently: just increments renewalAttempts, creates admin notification
      → Does NOT actually charge the customer
      → Does NOT retry on failure
```

### 9.2 Cancellation Flow

```
User clicks Cancel:
  → POST /customer/subscriptions/:id/cancel
  → Sets cancelAtPeriodEnd: true
  → Sets cancelledAt, cancelledBy: 'user'
  → Logs audit event
  → NO email sent
  → NO retention offer shown
```

### 9.3 Plan Change Flow

```
User changes plan:
  → PUT /customer/subscriptions/:id/change-plan
  → Updates planType and price
  → NO proration
  → NO mid-cycle adjustment
  → NO confirmation email
```

### 9.4 Grace Period Flow

```
Subscription expires:
  → Hourly service detects endDate passed
  → Sets status: 'grace_period'
  → Sets gracePeriodEnd: now + 28 days
  → Sends grace period email (weekly reminders)
  → If gracePeriodEnd passes: sets status: 'expired'
```

---

## 10. Stripe Integration — Current State

### 10.1 What's Integrated

| Feature | Status |
|---------|--------|
| One-time payment (PaymentIntent) | Working |
| Payment confirmation | Working |
| Refund processing | Working |
| Stripe billing portal redirect | Working |
| `invoice.payment_succeeded` webhook | Partially wired (updates existing subs) |
| `customer.subscription.deleted` webhook | Partially wired (cancels subs) |

### 10.2 What's NOT Integrated

| Feature | Status |
|---------|--------|
| Stripe Subscriptions (recurring billing) | Not used |
| Stripe Invoices (auto-generated) | Not used |
| Stripe Customer portal for card updates | Redirect only |
| Stripe SetupIntents (card saving) | Not used |
| Stripe Tax | Not used |
| Stripe Radar (fraud) | Not used |

---

# PART B: MARKET RESEARCH & STRATEGY

---

## 11. Market Context — NZ Pet Industry

### 11.1 New Zealand Pet Care Market

| Metric | Value | Source |
|--------|-------|--------|
| NZ pet care market value | NZD $2.1–2.5 billion (2023–2026) | Gitnux, SourceReady, Euromonitor |
| Average household pet spend | NZ$1,850/year | Gitnux |
| Average monthly pet spend per household | NZ$128/month | WorldMetrics |
| Average annual spend per dog | NZ$1,800 | WorldMetrics |
| Average annual spend per cat | NZ$1,200 | WorldMetrics |
| Pet-owning households | 64% (1.1M of 1.7M households) | Gitnux |
| Total pets in NZ | ~4.4 million | SourceReady |
| Pet food market share | 52% of pet product sales | Gitnux |
| Online pet purchases | 22% of total | WorldMetrics |
| Pet subscription box market (NZ) | NZD $10 million (2023) | WorldMetrics |
| Industry growth rate | 5.1% CAGR to 2028 | Gitnux |

### 11.2 Global Pet Subscription Market

| Metric | Value | Source |
|--------|-------|--------|
| US pet industry | $158B (2025), projected $165B (2026) | APPA via Joy |
| Pet subscription box market (global) | $811.7M (2024), projected $4.25B by 2034 | Zozimus |
| Subscription growth rate | 18.5% CAGR | Zozimus |
| Pet Care dollars from subscription | 40% | NIQ |
| Chewy autoship % of net sales | 83.3% of $12.6B (FY2025) | D2C Times |
| Chewy subscriber LTV (3-year) | $900–$1,100 | D2C Times |
| Petco Vital Care Premier members | 500,000+ (mid-2026) | D2C Times |

### 11.3 Key Industry Trends (2026)

1. **Subscription plateau approaching** — Consumer resistance growing; need to evolve value proposition beyond convenience (NIQ)
2. **Flexibility is king** — No minimum term, easy skip/pause/cancel is now expected (Pets at Home)
3. **Premiumization continues** — Pet owners trade down on themselves before their pets (NIQ)
4. **Cat ownership growing** — Cats outpacing dogs for new ownership; different retention dynamics (Recharge)
5. **Health-first framing** — Programs framed as "care plans" outperform discount schemes (Petco Vital Care)
6. **Multi-pet households are highest value** — Buy more, more often, across more categories (Petco)
7. **Loyalty is conditional** — Earned through relevance, convenience, and confidence (NIQ)

---

## 12. Competitive Analysis — Loyalty & Subscription Benchmarks

### 12.1 Pet Industry Benchmarks

| Metric | Benchmark | Source |
|--------|-----------|--------|
| Monthly churn — pet replenishment | 5–8% | Subbly, Eightx |
| Monthly churn — pet curation box | 8–12% | Subbly, Eightx |
| 12-month retention — replenishment | 45–55% | Eightx |
| 12-month retention — curation | 30–35% | Eightx |
| Annual churn — monthly plans | 18–22% | DataIntelo |
| Annual churn — quarterly plans | 11–16% | DataIntelo |
| Annual churn — annual plans | 6–9% | DataIntelo |
| Subscriber LTV — pet food | $334–$720 | Eightx, DollarPocket |
| LTV:CAC ratio — pet supplies | 8:1 to 12:1 | DollarPocket |
| CAC payback — pet supplies | 2–4 months | DollarPocket |
| Subscriber LTV multiple vs one-time | 4–5x (pet food) | Eightx |
| Cycle-3 retention (pet) | 50–60% | DollarPocket |
| First-90-day cancellation share | ~44% of all cancellations | Swell |

### 12.2 Best-in-Class Programs

| Program | Type | Price | Tiers | Key Mechanic | Result |
|---------|------|-------|-------|-------------|--------|
| **Petco Vital Care** | Paid membership | $24.99/mo (Premier) | Free Core + Paid Premier | Bundled grooming + nutrition + vet | 50% more visits, 40% more spend, 3.5x LTV |
| **Chewy Autoship** | Free subscription | No fee | Single tier | 10–20% discount on auto-refill | 78% of net sales via autoship |
| **Sephora Beauty Insider** | Free tiered loyalty | Free | Insider → VIB ($350/yr) → Rouge ($1,000/yr) | Points + experiential rewards | 46M members, 80% of revenue |
| **Starbucks Rewards** | Free tiered loyalty | Free | Green → Gold (500 Stars/yr) → Reserve (2,500/yr) | Stars + escalating earn rates | 35.5M active members |
| **Gymshark Loyalty** | Free tiered loyalty | Free | 4 tiers (XP-based) | XP from purchases + workouts | Tier-based perks + partner discounts |

### 12.3 Key Lessons

1. **Free tier is essential for data capture** — Petco Core, Sephora Insider, Starbucks Green all have free entry
2. **Bundled services beat discounts** — Petco's grooming + nutrition + vet creates switching costs a 10% discount cannot
3. **Health-first framing works** — "Care plan" outperforms "discount card" in pet space
4. **Tier thresholds should be achievable** — Sephora VIB at $350/yr (~7–10 purchases) feels attainable; Rouge at $1,000/yr feels aspirational
5. **Points expiration drives engagement** — 43% higher engagement when points expire (Sephora model)
6. **Birthday touchpoints guarantee re-engagement** — 73% redemption rate, $89 AOV vs $52 typical (Sephora)
7. **Annual billing cuts churn 60–80%** — Strongest lever for reducing monthly churn

---

## 13. What PawTag Is Doing Right

### 13.1 Strengths of Current Model

1. **Two-tier pricing is simple** — $0.99/mo Guardian and $1.99/mo Gold are easy to understand
2. **Progression system is emotionally smart** — Care → Nurture → Protector → Safeguard maps to the pet owner journey
3. **Points-for-status (not cash)** — Separating progression from redeemable rewards is strategically sound
4. **NZ market is underserved** — No major pet loyalty program in NZ comparable to Petco Vital Care
5. **Tag product creates natural recurring relationship** — Physical product + digital service is powerful
6. **12-month free period reduces friction** — Customer experiences value before paying
7. **Pet humanization trend** — 43% higher LTV in pet vs average retail (Zozimus)
8. **NZ pet spending is resilient** — Only 19% of pet owners trade down during economic pressure (NIQ)

---

## 14. Major Problems & Gaps

### 14.1 Critical Technical Gaps

| # | Gap | Why It Matters | Impact |
|---|-----|---------------|--------|
| 1 | **Subscriptions never created** | The entire system is dead — no revenue | Zero subscription revenue |
| 2 | **No dunning/retry** | Failed payments = silent churn | 15–25% recoverable revenue lost |
| 3 | **No win-back automation** | Churned customers stay churned | 5–10% reactivation opportunity lost |
| 4 | **No trial warnings** | 12-month free period ends with no warning | Surprise expiry → rage cancellation |
| 5 | **CMS settings not consumed** | Business can't change pricing without code | Operational inflexibility |

### 14.2 Strategic Business Gaps

| # | Gap | Why It Matters | Impact |
|---|-----|---------------|--------|
| 6 | **No clear value proposition for Gold** | Why pay $1.99 instead of $0.99? | Low conversion expected |
| 7 | **Tier benefits undefined** | What does "Safeguard" actually get you? | Progression feels hollow |
| 8 | **No redemption mechanics** | Points only determine status, no rewards | Engagement drops after reaching top tier |
| 9 | **No financial model** | Can't prove profitability | Risk of building unprofitable program |
| 10 | **No customer research** | Assumptions untested | Could build the wrong thing |

### 14.3 The $10 = 1 Point Assumption Is Problematic

**Current assumption:** NZ$10 spent = 1 Guardian Point

**Problems:**

1. **Too slow** — At $200/year spend, customer earns 20 points. They'd need 5 years to reach Nurture (100 points). That's not a journey — that's a crawl.

2. **No engagement reward** — Only spending earns points. Reviews, referrals, profile completion, pet milestones — none count.

3. **One-dimensional** — Only measures transaction value, not engagement or loyalty depth.

4. **Top-heavy spend required** — A customer must spend $3,000 to reach Safeguard (300 points). At NZ$1,800/year average dog spend, that's almost 2 years of total pet spending through PawTag alone. Unrealistic.

**Recommendation:** Earn rate should be 1 point per $1 spent (not $10), supplemented by engagement points from non-purchase activities. This makes the journey achievable while keeping the spending component meaningful.

---

## 15. Recommended Guardian Model

### 15.1 Pricing

| Plan | Price | Positioning |
|------|-------|-------------|
| **Guardian** | NZ$0.99/month | Loyalty + progression membership |
| **Gold** | NZ$1.99/month | Premium tier with enhanced rewards + 2× Guardian Points |

### 15.2 Positioning

**Guardian:** "Start your journey as a PawTag Guardian. Every pet deserves a guardian — and every guardian deserves recognition."

**Gold:** "Go beyond the badge. Gold members unlock exclusive rewards, faster progression, and the best PawTag has to offer."

### 15.3 Relationship to Guardian Points

- Gold earns **2× Guardian Points** on all activities
- Gold **automatically starts at Nurture tier** (100 points credited on signup)
- Gold has its **own Gold status badge** (separate from tier progression)
- Gold members can still progress through Care → Nurture → Protector → Safeguard

### 15.4 Gold vs Guardian — Clear Differentiation

| Feature | Free (Non-member) | Guardian ($0.99/mo) | Gold ($1.99/mo) |
|---------|-------------------|---------------------|-----------------|
| Guardian Points earning | ❌ | ✅ | ✅ (2× rate) |
| Starting tier | — | Care (0 pts) | Nurture (100 pts) |
| Tier progression | ❌ | ✅ | ✅ |
| Birthday reward | ❌ | ✅ (basic) | ✅ (premium) |
| Monthly PawRewards | ❌ | $2 value | $5 value |
| Exclusive promotions | ❌ | Member-only | Gold-only + Member-only |
| Early access to products | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ✅ |
| Free shipping on orders | ❌ | ❌ | ✅ (over $50) |
| Exclusive products | ❌ | ❌ | ✅ |
| 2× points earning | ❌ | ❌ | ✅ |
| Gold badge | ❌ | ❌ | ✅ |
| Pet milestone bonuses | ❌ | ✅ (small) | ✅ (large) |
| Referral bonus | ❌ | ✅ (standard) | ✅ (2× referral bonus) |

---

## 16. Recommended Guardian Points System

### 16.1 Points Earning Table

| Activity | Guardian Points | Gold Points | Frequency Cap | Annual Cap | Abuse Risk | Business Value |
|----------|----------------|-------------|---------------|------------|------------|----------------|
| **Purchases** | 1 pt per $1 spent | 2 pts per $1 | No limit | No cap | Low (real purchases) | HIGH — Core revenue driver |
| **Repeat purchase bonus** | +10 pts on 3rd+ order | +20 pts | Per qualifying order | 50 pts/year | Low | HIGH — Encourages retention |
| **Product review (text)** | 5 pts | 10 pts | 1 per product | 30 pts/year | Medium | MEDIUM — Social proof |
| **Product review (photo)** | 15 pts | 30 pts | 1 per product | 50 pts/year | Medium | HIGH — Visual proof converts |
| **Product review (video)** | 25 pts | 50 pts | 1 per product | 75 pts/year | Medium | HIGH — Best social proof |
| **Referral (signup)** | 20 pts | 40 pts | No limit | 200 pts/year | Medium | HIGH — Acquisition |
| **Referral (purchase)** | 50 pts | 100 pts | No limit | 500 pts/year | Medium | HIGH — Quality acquisition |
| **Complete pet profile** | 15 pts | 30 pts | 1 per pet | 45 pts/year | Low | MEDIUM — Data value |
| **Pet birthday** | 10 pts | 20 pts | 1 per pet/year | 20 pts/year | Low | LOW — Emotional engagement |
| **Pet adoption anniversary** | 10 pts | 20 pts | 1 per pet/year | 20 pts/year | Low | LOW — Emotional engagement |
| **Monthly membership anniversary** | 5 pts | 10 pts | 1/month | 60 pts/year | Low | MEDIUM — Retention signal |
| **Annual membership anniversary** | 25 pts | 50 pts | 1/year | 50 pts/year | Low | MEDIUM — Loyalty milestone |
| **Tag scan event** | 2 pts | 4 pts | 3/day | 100 pts/year | Low | HIGH — Core product engagement |
| **Lost pet report filed** | 5 pts | 10 pts | No limit | 50 pts/year | Low | MEDIUM — Shows product value |
| **Pet reunited (finder)** | 20 pts | 40 pts | No limit | 200 pts/year | Low | HIGH — Mission-critical event |
| **Share on social media** | 3 pts | 6 pts | 2/week | 50 pts/year | Medium | LOW — Organic marketing |

### 16.2 Points Earning Rules

1. **Points are earned, not bought** — No points-for-cash purchases
2. **Points determine tier status only** — Not directly redeemable for discounts
3. **Points never expire** — Lifetime accumulation (tier status is annual)
4. **No points cap on purchases** — High spenders earn proportionally
5. **Engagement points have annual caps** — Prevents gaming
6. **Points are per-account, not per-pet** — One household = one points balance
7. **Points are non-transferable** — Cannot be gifted or sold
8. **Points are lost on refund** — Returned items deduct points earned
9. **Fake reviews = points revocation + account review** — Trust is paramount

---

## 17. Tier Structure & Benefits

### 17.1 Tier Thresholds

| Tier | Points Required | Approximate Spend Equivalent | Time to Reach (Average Customer) |
|------|----------------|------------------------------|----------------------------------|
| **Care** | 0–99 | $0–$99 | Immediate |
| **Nurture** | 100–199 | $100–$199 | 2–3 months |
| **Protector** | 200–299 | $200–$299 | 4–6 months |
| **Safeguard** | 300+ | $300+ | 6–9 months |

**Note:** These thresholds include both purchase points AND engagement points. An average customer spending $500/year + completing engagement activities would reach Safeguard in approximately 6–9 months.

### 17.2 Tier Benefits

#### Care (0–99 points)

| Benefit | Details |
|---------|---------|
| **Emotional positioning** | "You've started your journey as a guardian. Every step matters." |
| **Basic PawRewards** | $2/month reward value |
| **Member-only promotions** | Access to Guardian discounts |
| **Birthday treat** | Small birthday reward for your pet |
| **Monthly progress email** | "You've earned X points this month" |
| **Guardian badge** | Display on profile |
| **Access to community** | Guardian-only community features |

#### Nurture (100–199 points)

| Benefit | Details |
|---------|---------|
| **Emotional positioning** | "Your dedication shows. You're nurturing a deeper bond." |
| **Enhanced PawRewards** | $3/month reward value |
| **All Care benefits** | Everything in Care |
| **Photo review bonus** | Extra points for photo reviews |
| **Pet milestone recognition** | Birthday/anniversary acknowledgment |
| **Nurture badge** | Enhanced profile badge |
| **Seasonal surprises** | Occasional surprise offers |
| **Early access to sales** | 24-hour early access to major sales |

#### Protector (200–299 points)

| Benefit | Details |
|---------|---------|
| **Emotional positioning** | "You're a protector. Your pet's safety is in good hands." |
| **Premium PawRewards** | $5/month reward value |
| **All Nurture benefits** | Everything in Nurture |
| **Priority support** | Faster response times |
| **Exclusive products** | Protector-only product access |
| **Protector badge** | Premium profile badge |
| **Free shipping threshold** | Reduced from $75 to $50 |
| **Referral bonus boost** | Enhanced referral rewards |
| **Annual PawTag care package** | Small annual gift |

#### Safeguard (300+ points)

| Benefit | Details |
|---------|---------|
| **Emotional positioning** | "You've reached the highest tier. You are a true Safeguard." |
| **Premium PawRewards** | $8/month reward value |
| **All Protector benefits** | Everything in Protector |
| **VIP support** | Dedicated support channel |
| **Free shipping** | Free on all orders |
| **Exclusive Safeguard products** | Limited-edition items |
| **Safeguard badge** | Elite profile badge |
| **Annual care package** | Premium annual gift |
| **Early access to new features** | First to try new PawTag features |
| **Name on Safeguard wall** | Public recognition (optional) |
| **Annual Safeguard event** | Exclusive event/experience |

### 17.3 Tier Maintenance

- Tiers are evaluated annually (calendar year reset)
- Points earned in the year determine your tier for the following year
- **Grace period:** 3 months after annual reset to re-qualify
- **Downgrade protection:** No one loses their tier abruptly — gradual transition with warning emails
- **Lifetime status:** After 3 consecutive years at Safeguard, tier is locked permanently

---

## 18. PawRewards — Separate Redeemable Currency

### 18.1 Recommendation: YES, Create PawRewards

**Why separate Guardian Points from PawRewards:**

1. **Different purposes** — Points = status; PawRewards = spending power
2. **Psychological separation** — Customers don't "spend" their status
3. **Flexibility** — PawRewards can be redeemed without affecting tier progression
4. **Perceived value** — Seeing "You have $5 in PawRewards" is tangible; "You have 72 points" is abstract
5. **Gamification** — Points are permanent; PawRewards are consumable — different motivations

### 18.2 How PawRewards Work

| Element | Details |
|---------|---------|
| **Currency** | PawRewards (displayed as $ value) |
| **Earning** | $1 PawReward per $50 spent (Guardian), $1 per $25 spent (Gold) |
| **Earning from tiers** | Monthly PawReward allocation based on tier |
| **Redemption** | Applied as discount at checkout |
| **Minimum redemption** | $2 PawRewards |
| **Expiration** | 6 months from issue date |
| **Maximum balance** | $20 (Guardian), $40 (Gold) |
| **Excluded from** | Shipping fees, taxes, gift cards |

### 18.3 PawRewards Value by Tier

| Tier | Monthly PawReward | Annual PawReward Value |
|------|------------------|----------------------|
| Care | $2.00 | $24.00 |
| Nurture | $3.00 | $36.00 |
| Protector | $5.00 | $60.00 |
| Safeguard | $8.00 | $96.00 |

**Note:** These are in addition to tier benefits. The PawRewards alone cover the $0.99/month Guardian fee for Care tier ($2.00 reward vs $0.99 cost = 2× return).

---

## 19. Customer Psychology & Gamification

### 19.1 Tier Names — Evaluation

| Name | Emotional Meaning | Memorability | Brand Fit | Progression Logic |
|------|------------------|-------------|-----------|-------------------|
| **Care** | Basic love and attention | ✅ High | ✅ Strong — "pet care" | ✅ Starting point |
| **Nurture** | Growing, developing, investing | ✅ High | ✅ Strong — "nurturing" | ✅ Natural next step |
| **Protector** | Active defense, guardianship | ✅ High | ✅ Strong — core PawTag mission | ✅ Clear escalation |
| **Safeguard** | Ultimate security, comprehensive protection | ✅ High | ✅ Strong — "safeguarding pets" | ✅ Feels like a destination |

**Verdict: The names work.** They tell a story: Care → Nurture → Protector → Safeguard. Each word has genuine emotional resonance with pet owners. Don't change them.

### 19.2 "Guardian Points" — Evaluation

The name "Guardian Points" is strong because:
- Directly ties to "PawTag **Guardian**" membership name
- Reinforces the brand identity
- Has emotional weight (guardian = protector, not just a customer)
- Distinguishes from generic "loyalty points"

**Verdict: Keep "Guardian Points."**

### 19.3 Psychological Journey

```
Care (0-99):     "I've joined something. Let me see what happens."
                  → Motivation: Curiosity, early reward

Nurture (100-199): "I'm making progress. This feels good."
                   → Motivation: Achievement, social proof

Protector (200-299): "I'm a serious guardian now. This matters."
                     → Motivation: Identity, status

Safeguard (300+):    "I'm the best. I'm recognized."
                    → Motivation: Pride, exclusivity, permanence
```

### 19.4 Gamification Mechanics

1. **Progress bars everywhere** — Show points to next tier on every dashboard
2. **Unlock moments** — Celebrate tier transitions with animations, confetti, congratulations email
3. **Achievement badges** — Specific milestones within tiers (first review, first referral, pet birthday)
4. **Streak bonuses** — 3 consecutive months of engagement = bonus points
5. **Surprise rewards** — Random bonus points for engagement (10% chance of 2× points on any activity)
6. **Leaderboard (optional)** — Anonymous top guardians by points (opt-in only)

---

## 20. Financial & Unit Economics

### 20.1 Revenue Per Customer

| Plan | Monthly | Annual | Annual Revenue |
|------|---------|--------|---------------|
| Guardian | $0.99 | $11.88 | $11.88 |
| Gold | $1.99 | $23.88 | $23.88 |

### 20.2 Cost Structure Per Customer

| Cost Item | Guardian | Gold | Notes |
|-----------|----------|------|-------|
| Payment processing (Stripe ~2.9% + $0.30) | $0.33 | $0.36 | On subscription fee only |
| PawRewards (monthly) | $2.00–$8.00 | $4.00–$16.00 | Scales with tier |
| Birthday/anniversary rewards | $0.50 | $1.00 | Estimated annual / 12 |
| Free shipping (Gold) | N/A | $2.00–$5.00 | Per order, limited by tier |
| Support costs | $0.50 | $1.00 | Priority support premium |
| **Total variable cost/month** | **$3.33–$9.33** | **$7.36–$23.36** | |

### 20.3 Profitability Analysis

**Critical insight:** The subscription fee alone does NOT cover PawRewards costs. The business model depends on **increased purchase frequency and AOV** to be profitable.

**Key profitability drivers:**
1. **Increased purchase frequency** — Guardian members should spend 20–40% more than non-members (Petco benchmark: 40% more spend)
2. **Higher AOV** — PawRewards redemption drives additional purchases
3. **Lower churn** — Retained customers are 5–25× cheaper than acquiring new ones
4. **Data value** — Pet profiles, preferences, and behavior data enable personalization
5. **Gold margin** — Gold's higher fee + higher spend = better unit economics

### 20.4 Break-Even Requirements

| Metric | Guardian | Gold |
|--------|----------|------|
| Monthly fee revenue | $0.99 | $1.99 |
| Monthly cost (mid-tier) | $5.00 | $12.00 |
| **Monthly shortfall** | **$4.01** | **$10.01** |
| Required monthly spend to break even | ~$20 | ~$50 |
| Required AOV to cover costs | ~$40 | ~$100 |

**Verdict:** The subscription is a **loss leader** that drives profitable e-commerce behavior. This is the correct model — Petco Vital Care works the same way.

### 20.5 Target Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Subscription churn | <5%/mo (Guardian), <3%/mo (Gold) | Gold has higher investment → lower churn |
| Guardian→Gold upgrade rate | >15% within 12 months | Drives ARPU growth |
| Repeat purchase rate (Guardian) | >60% quarterly | Core profitability driver |
| AOV lift (Guardian vs non-member) | >25% | Validates membership value |
| PawRewards redemption rate | >70% | Drives purchase frequency |
| LTV (Guardian) | >$150 | Includes subscription + purchase revenue |
| LTV (Gold) | >$300 | Higher subscription + higher purchase revenue |
| LTV:CAC | >3:1 | Sustainable growth threshold |
| CAC payback | <6 months | Capital efficiency |

---

## 21. Customer Journey Models

### 21.1 Customer A — Low Spender (~NZ$200/year)

| Month | Activity | Points | Tier |
|-------|----------|--------|------|
| 1 | Joins Guardian, spends $50, completes profile | 65 | Care |
| 3 | Spends $30, writes 1 review | 40 | Care |
| 6 | Spends $40, refers 1 friend | 75 | Care |
| 9 | Spends $30, pet birthday | 45 | Care |
| 12 | Spends $50, renews membership | 85 | Care |
| **Year 1 total** | **$200 spent** | **310 pts** | **Protector** |

**Verdict:** Achievable. Customer reaches Protector by year-end through combined spending + engagement. Feels rewarding without being too easy.

### 21.2 Customer B — Average Spender (~NZ$500/year)

| Month | Activity | Points | Tier |
|-------|----------|--------|------|
| 1 | Joins Guardian, spends $80, completes profile | 95 | Care |
| 2 | Spends $50, writes 2 reviews | 80 | Nurture |
| 4 | Spends $60, refers 1 friend | 90 | Nurture |
| 6 | Spends $70, pet birthday | 85 | Protector |
| 9 | Spends $80, 3 photo reviews | 110 | Protector |
| 12 | Spends $90, renews membership | 105 | Safeguard |
| **Year 1 total** | **$500 spent** | **565 pts** | **Safeguard** |

**Verdict:** Reaches Safeguard around month 10–11. Feels like a genuine achievement.

### 21.3 Customer C — High-Value Spender (~NZ$1,000/year)

| Month | Activity | Points | Tier |
|-------|----------|--------|------|
| 1 | Joins Guardian, spends $120, completes profile | 135 | Nurture |
| 2 | Spends $90, 3 reviews | 125 | Protector |
| 3 | Spends $100, refers 2 friends | 170 | Protector |
| 5 | Spends $120, photo reviews | 160 | Safeguard |
| 8 | Spends $150, referral purchases | 195 | Safeguard |
| 12 | Spends $180, renews | 210 | Safeguard |
| **Year 1 total** | **$1,000 spent** | **995 pts** | **Safeguard** |

**Verdict:** Reaches Safeguard around month 5–6. Fast but justified — this is a highly valuable customer.

### 21.4 Customer D — Very High-Value Spender (~NZ$2,500/year)

| Month | Activity | Points | Tier |
|-------|----------|--------|------|
| 1 | Joins Guardian, spends $200, completes profile | 215 | Protector |
| 2 | Spends $180, 4 reviews | 240 | Protector |
| 3 | Spends $220, refers 3 friends | 310 | Safeguard |
| 6 | Spends $250, ongoing engagement | 280 | Safeguard |
| 12 | Spends $350, annual anniversary | 380 | Safeguard |
| **Year 1 total** | **$2,500 spent** | **1,425 pts** | **Safeguard** |

**Verdict:** Reaches Safeguard by month 3. This is fine — they're earning it through genuine high spend. The tier should feel like recognition, not a grind.

### 21.5 Customer E — Highly Engaged, Low Spender (~NZ$100/year + heavy engagement)

| Month | Activity | Points | Tier |
|-------|----------|--------|------|
| 1 | Joins Guardian, spends $25, completes profile, 2 reviews | 70 | Care |
| 2 | 3 photo reviews, shares on social | 65 | Care |
| 3 | Refers 2 friends, 1 video review | 95 | Care |
| 5 | 4 reviews, pet birthday, referral purchase | 110 | Nurture |
| 8 | Ongoing engagement, refers 1 more | 105 | Nurture |
| 12 | Annual anniversary, seasonal engagement | 85 | Nurture |
| **Year 1 total** | **$100 spent + heavy engagement** | **530 pts** | **Nurture** |

**Verdict:** Reaches Nurture despite low spend. The system rewards engagement, not just spending. This customer creates social proof and referrals — valuable to PawTag.

---

## 22. Rules & Edge Cases

### 22.1 Critical Decisions Before Development

| Rule | Decision Needed | Recommendation |
|------|----------------|----------------|
| **Refunds** | Deduct points on refund? | YES — points deducted, tier status protected for 30 days |
| **Cancelled orders** | Points earned? | NO — points only on confirmed/completed orders |
| **Gift cards** | Earn points on gift card purchase? | YES — gift card purchaser earns, recipient does not |
| **Shipping fees** | Earn points on shipping? | NO — only product value |
| **GST/Tax** | Earn points on tax? | NO — only product value |
| **Multiple pets** | Separate profiles? | YES — separate pet profiles, shared points balance |
| **Multiple owners** | Separate accounts? | NO — one account per household, shared points |
| **Referral abuse** | Cap or detect? | Cap at 20 referrals/year + fraud detection |
| **Fake reviews** | Detection? | AI moderation + manual review for flagged content |
| **Duplicate accounts** | Prevention? | Email + phone verification, one account per person |
| **Fraud detection** | Automated? | Flag unusual point accumulation patterns |
| **Chargebacks** | Points on chargeback? | NO — points reversed on chargeback |
| **Subscription cancellation** | What happens to points? | Points remain, earning stops, tier resets after 3 months |
| **Subscription pause** | Points earned during pause? | NO — must be active to earn |
| **Subscription reactivation** | Points restored? | YES — points never lost, tier recalculated |
| **Points expiration** | Should points expire? | NO — lifetime accumulation |
| **Tier expiration** | Should tiers reset? | YES — annual re-qualification required |
| **Tier downgrade** | How to handle? | 3-month grace period + warning emails |
| **Gold cancellation** | What happens? | Reverts to Guardian, keeps tier, loses 2× earning |
| **Gold upgrade** | Instant benefits? | YES — immediate 2× earning + Nurture start |
| **Switching Guardian/Gold** | Pro-rated? | YES — mid-cycle changes are pro-rated |

### 22.2 Edge Cases to Handle

1. Customer reaches Safeguard then cancels subscription → tier protected for 3 months, then drops
2. Customer downgrades from Gold to Guardian → keeps tier but loses 2× earning
3. Customer requests refund after earning points → points deducted, tier review
4. Customer creates multiple accounts → detect and merge
5. Customer refers themselves (different email) → block, flag for review
6. Customer reaches Safeguard in month 1 (high spend) → celebrate, don't cap
7. Customer hasn't earned points in 6 months → re-engagement email sequence
8. Customer disputes chargeback → reverse points immediately
9. Pet passes away → option to pause/deduct pet, preserve points
10. Customer moves to different country → points preserved, benefits may vary

---

## 23. Customer Research Plan

### 23.1 Key Questions to Ask

1. Would you pay $0.99/month for a pet loyalty membership?
2. Would you pay $1.99/month for a premium pet membership?
3. What benefits matter most to you? (Rank: discounts, free shipping, early access, priority support, exclusive products)
4. What would make you upgrade from Guardian to Gold?
5. How many Guardian Points would feel "achievable" for each tier?
6. Would you prefer points that never expire, or points that expire after 12 months?
7. Would you prefer monthly PawRewards or larger quarterly rewards?
8. What pet-related activities would you like to earn points for?
9. Would you write product reviews for 5 points? 15 points? 25 points?
10. How important is a "progression journey" vs simple discounts?

### 23.2 Survey Structure

**Section 1: Demographics**
- Age, location, household income
- Pet type(s), number of pets
- Current PawTag usage
- Monthly pet spending

**Section 2: Current Loyalty Programs**
- Which loyalty programs do you use?
- What do you like/dislike about them?
- Would you join a pet-specific loyalty program?

**Section 3: Pricing Sensitivity**
- Would you pay $0.99/month for Guardian?
- Would you pay $1.99/month for Gold?
- What's the maximum you'd pay for a pet loyalty membership?

**Section 4: Benefits Preferences**
- Rank benefits by importance
- Which would make you upgrade to Gold?
- How important is free shipping?

**Section 5: Points & Tiers**
- How many points per $1 spent feels fair?
- Which tier names resonate most?
- Would you prefer points or direct discounts?

**Section 6: Open Feedback**
- What would make this program "must-have"?
- What would make you cancel?
- Any concerns about a points system?

### 23.3 Testing Recommendations

| Test | Method | Sample | Duration |
|------|--------|--------|----------|
| Pricing sensitivity | A/B test $0.99 vs $1.49 vs $1.99 | 500 customers | 2 weeks |
| Tier name preferences | Survey with 3 naming options | 200 respondents | 1 week |
| Benefit preferences | Rank-order survey | 200 respondents | 1 week |
| Points earning rate | A/B test 1pt/$1 vs 1pt/$5 | 300 customers | 4 weeks |
| Gold conversion | Landing page test | 500 visitors | 2 weeks |

---

## 24. Marketing Strategy

### 24.1 Core Value Proposition

**Guardian:** "Every pet deserves a guardian. Join PawTag Guardian and turn your love for your pet into real rewards, recognition, and a community that cares."

**Gold:** "Go beyond the badge. Gold members unlock exclusive rewards, faster progression, and the best PawTag has to offer."

### 24.2 Positioning Messages

| Touchpoint | Guardian Message | Gold Message |
|-----------|-----------------|-------------|
| **Website hero** | "Start your Guardian journey" | "Unlock Gold status" |
| **Subscription page** | "Your pet's journey starts here" | "The ultimate guardian experience" |
| **Upgrade prompt** | "You're a Care guardian. Unlock more." | "Gold members earn 2× points and get exclusive rewards" |
| **Email subject** | "Welcome to PawTag Guardian" | "Gold is calling — are you ready?" |
| **Social proof** | "X,XXX guardians protecting pets across NZ" | "Gold members love these exclusive perks" |

### 24.3 Email/Push Notification Concepts

| Event | Email/Push |
|-------|-----------|
| Join Guardian | "Welcome to the pack! Your journey begins now." |
| First points earned | "You just earned your first Guardian points!" |
| 50 points | "Halfway to Nurture — keep going!" |
| Reach Nurture | "You've unlocked Nurture! Your dedication shows." |
| Reach Protector | "Protector status achieved. Your pet is in good hands." |
| Reach Safeguard | "You've reached Safeguard. You're one of NZ's finest guardians." |
| Birthday | "Happy birthday to [pet name]! Here's a treat from us." |
| Monthly summary | "Your Guardian journey this month: [X] points earned" |
| Upgrade to Gold | "Welcome to Gold! Here's what just unlocked." |
| Annual anniversary | "1 year as a Guardian! Here's your annual reward." |

### 24.4 Launch Campaign Concept

**Phase 1 (Week 1–2): Soft Launch**
- Invite existing customers first
- Early adopter bonus (2× points for first month)
- Collect feedback, fix bugs

**Phase 2 (Week 3–4): Public Launch**
- Website banner: "Join PawTag Guardian — $0.99/month"
- Social media campaign: Real customer stories
- Email blast to full customer base

**Phase 3 (Month 2–3): Gold Push**
- Target Guardian members with Gold upgrade offer
- Gold trial: 1 month free, then $1.99/month
- Showcase Gold-exclusive benefits

---

## 25. Implementation Roadmap

### Phase 1: Strategy & Research (Weeks 1–4)

| Task | Owner | Duration |
|------|-------|----------|
| Finalize tier structure and pricing | Business | Week 1 |
| Complete customer research survey | Business | Week 2 |
| Analyze survey results | Business | Week 3 |
| Finalize points earning table | Business + Eng | Week 3 |
| Design financial model | Business | Week 4 |
| Stakeholder review and approval | All | Week 4 |

### Phase 2: Financial Validation (Weeks 5–6)

| Task | Owner | Duration |
|------|-------|----------|
| Build detailed financial model | Business + Finance | Week 5 |
| Validate unit economics | Business | Week 5 |
| Set target metrics and KPIs | Business | Week 6 |
| Risk assessment and mitigation | Business + Eng | Week 6 |

### Phase 3: UX/UI Design (Weeks 7–10)

| Task | Owner | Duration |
|------|-------|----------|
| Design Guardian dashboard | Design | Week 7 |
| Design points earning display | Design | Week 7 |
| Design tier progression flow | Design | Week 8 |
| Design Gold upgrade flow | Design | Week 8 |
| Design PawRewards redemption | Design | Week 9 |
| Design email templates | Design | Week 9 |
| Design admin portal | Design | Week 10 |
| User testing | Design + Business | Week 10 |

### Phase 4: Technical Requirements (Weeks 11–12)

| Task | Owner | Duration |
|------|-------|----------|
| Database schema design | Eng | Week 11 |
| API endpoint design | Eng | Week 11 |
| Points earning engine specs | Eng | Week 11 |
| Tier management specs | Eng | Week 12 |
| PawRewards engine specs | Eng | Week 12 |
| Integration with existing subscription system | Eng | Week 12 |

### Phase 5: Development — MVP (Weeks 13–20)

| Task | Owner | Duration |
|------|-------|----------|
| Wire up createSubscription() | Eng | Week 13 |
| Build points earning engine | Eng | Weeks 14–16 |
| Build tier management system | Eng | Weeks 16–17 |
| Build PawRewards engine | Eng | Weeks 17–18 |
| Build Guardian dashboard (web) | Eng | Weeks 18–19 |
| Build Gold upgrade flow | Eng | Week 19 |
| Build email templates | Eng | Week 19 |
| Build admin portal | Eng | Week 20 |
| Testing and QA | QA | Week 20 |

### Phase 6: Testing & Soft Launch (Weeks 21–22)

| Task | Owner | Duration |
|------|-------|----------|
| Internal testing | Eng + QA | Week 21 |
| Soft launch to 100 customers | Business | Week 22 |
| Collect feedback | Business | Week 22 |
| Bug fixes and refinements | Eng | Week 22 |

### Phase 7: Public Launch (Weeks 23–24)

| Task | Owner | Duration |
|------|-------|----------|
| Public launch — Guardian | Business + Marketing | Week 23 |
| Monitor metrics | Business + Eng | Week 23 |
| Gold upgrade campaign | Marketing | Week 24 |
| Iterate based on data | All | Week 24 |

### Phase 8: Optimization (Weeks 25–36)

| Milestone | Review Focus |
|-----------|-------------|
| **30 days** | Sign-up rate, first purchase, initial engagement |
| **60 days** | Retention rate, points earning patterns, Gold conversion |
| **90 days** | Tier distribution, PawRewards redemption, churn analysis |
| **180 days** | LTV comparison, financial model validation, program ROI |

---

## 26. MVP vs Future

### 26.1 MVP (Must Have for Launch)

- Guardian membership ($0.99/month)
- Guardian Points earning (purchases + reviews + referrals)
- 4-tier system (Care → Nurture → Protector → Safeguard)
- PawRewards (monthly reward allocation)
- Guardian dashboard (points, tier, progress)
- Gold membership ($1.99/month) with 2× earning
- Basic email templates
- Admin subscription management
- Cancellation flow with confirmation email

### 26.2 Version 2 (After 3 Months of Data)

- Advanced PawRewards redemption (at checkout)
- Pet milestone bonuses (birthday, adoption anniversary)
- Referral program enhancement
- Gold-exclusive products
- Subscription pause option
- Advanced analytics dashboard
- A/B testing infrastructure

### 26.3 Future (6–12 Months)

- Tiered shipping benefits (free shipping at higher tiers)
- Exclusive Gold events/experiences
- Family/multi-pet plans
- Personalization engine
- Predictive analytics
- Loyalty program API for partners
- Mobile app loyalty features

---

## 27. Top 10 Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| 1 | **Subscriptions never created** | CERTAIN | CRITICAL | Wire up createSubscription() immediately |
| 2 | **Gold cannibalizes Guardian** | MEDIUM | HIGH | Clear value differentiation, Gold starts at Nurture |
| 3 | **Points gaming/abuse** | MEDIUM | MEDIUM | Annual caps, fraud detection, review moderation |
| 4 | **Financial model doesn't work** | MEDIUM | HIGH | Validate before launch, monitor closely |
| 5 | **Low Gold conversion** | MEDIUM | MEDIUM | Free trial, clear upgrade messaging |
| 6 | **Customer confusion** | LOW | MEDIUM | Simple UX, clear progress indicators |
| 7 | **Tier downgrade backlash** | MEDIUM | MEDIUM | Grace period, warning emails, lifetime status |
| 8 | **Competitor launches similar program** | LOW | LOW | First-mover advantage in NZ market |
| 9 | **Technical complexity** | LOW | MEDIUM | MVP scope, incremental development |
| 10 | **Low engagement** | MEDIUM | HIGH | Gamification, surprise rewards, re-engagement |

---

## 28. Final Recommended Model

### PawTag Guardian — NZ$0.99/month

**Positioning:** "Your pet's journey begins here."

| Element | Recommendation |
|---------|---------------|
| Price | $0.99/month ($11.88/year) |
| Starting tier | Care (0 points) |
| Points earning | 1 pt per $1 spent + engagement activities |
| Tier progression | Care → Nurture → Protector → Safeguard |
| PawRewards | $2–$8/month based on tier |
| Target audience | All pet owners |

### PawTag Gold — NZ$1.99/month

**Positioning:** "The ultimate guardian experience."

| Element | Recommendation |
|---------|---------------|
| Price | $1.99/month ($23.88/year) |
| Starting tier | Nurture (100 points credited) |
| Points earning | 2× Guardian rate |
| Extra benefits | Early access, priority support, free shipping, exclusive products |
| Target audience | Engaged pet owners who want more |

### Guardian Points

| Element | Recommendation |
|---------|---------------|
| Currency | Guardian Points |
| Earning rate | 1 pt per $1 spent (Guardian), 2 pts per $1 (Gold) |
| Engagement earning | Reviews, referrals, profile completion, milestones |
| Expiration | Never |
| Purpose | Tier determination only |
| Redemption | Not redeemable (PawRewards separate) |

### PawRewards

| Element | Recommendation |
|---------|---------------|
| Currency | PawRewards ($ value) |
| Earning | Monthly allocation based on tier + $1 per $50 spent |
| Redemption | At checkout, $2 minimum |
| Expiration | 6 months |
| Max balance | $20 (Guardian), $40 (Gold) |

### Customer Journey

```
Care → Nurture → Protector → Safeguard
 0-99    100-199    200-299    300+

 Average customer reaches Safeguard in 6-9 months
 High-value customer reaches Safeguard in 3-5 months
 Low-spender reaches Nurture in 6-12 months through engagement
```

### Financial Logic

- Subscription fee is a **loss leader** that drives e-commerce behavior
- Profitability comes from **increased purchase frequency, higher AOV, and lower churn**
- Petco Vital Care model: members visit 50% more often and spend 40% more
- Target: Guardian members spend 25%+ more than non-members
- Target: Gold members spend 40%+ more than non-members

---

## 29. Decisions PawTag Must Make Before Development

| # | Decision | Options | Recommendation |
|---|----------|---------|---------------|
| 1 | Guardian price | $0.99 / $1.49 / $1.99 | $0.99 |
| 2 | Gold price | $1.99 / $2.49 / $2.99 | $1.99 |
| 3 | Points earning rate | 1pt/$1 / 1pt/$5 / 1pt/$10 | 1pt/$1 |
| 4 | Tier thresholds | 100/200/300 or 50/150/300 or other | 100/200/300 |
| 5 | PawRewards monthly value | $2-8 or $3-10 or other | $2-8 |
| 6 | Points expiration | Never / 12 months / 18 months | Never |
| 7 | Tier re-qualification | Annual / 6-month / lifetime | Annual |
| 8 | Gold starting tier | Care / Nurture / Protector | Nurture |
| 9 | Gold 2× multiplier | Yes / No | Yes |
| 10 | Free shipping for Gold | Yes / No / over $50 | Yes, over $50 |
| 11 | Pause option | Yes / No | Yes (after MVP) |
| 12 | Multi-pet discount | Yes / No | Yes (after MVP) |

---

# PART C: IMPLEMENTATION PLAN — Portal Integration & Admin Management

---

## 30. Architecture Overview

The system needs **three layers**:

1. **CMS-Driven Configuration Layer** — All business rules stored in `settings` collection, editable from admin, consumed by backend services
2. **Backend Service Layer** — Points engine, tier management, PawRewards, reading from CMS config
3. **Frontend Integration Layer** — Customer portal Guardian dashboard + Admin portal management section

**Core principle:** Every business value (tier thresholds, point earning rates, PawRewards amounts, email toggles, dunning config) is stored in the database and editable from the admin portal. No code changes required to adjust the loyalty program.

---

## 31. LAYER 1: CMS-Driven Configuration

**Pattern to follow:** CommerceSettings pattern (`commerce/config.ts` + admin settings page)

**New settings prefix:** `guardian.*`

### 31.1 Settings to Create (seeded in `seed-cms.ts`)

#### General

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.enabled` | `true` | toggle | Master on/off for entire system |

#### Pricing

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.guardian.price` | `0.99` | number | Guardian monthly price |
| `guardian.gold.price` | `1.99` | number | Gold monthly price |

#### Gold Configuration

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.gold.pointsMultiplier` | `2` | number | Gold points multiplier |
| `guardian.gold.startingTier` | `nurture` | select | Which tier Gold members start at |
| `guardian.gold.freeShippingThreshold` | `50` | number | Free shipping minimum for Gold |

#### Tier Thresholds

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.tier.care.max` | `99` | number | Care tier max points |
| `guardian.tier.nurture.min` | `100` | number | Nurture tier min points |
| `guardian.tier.nurture.max` | `199` | number | Nurture tier max points |
| `guardian.tier.protector.min` | `200` | number | Protector tier min points |
| `guardian.tier.protector.max` | `299` | number | Protector tier max points |
| `guardian.tier.safeguard.min` | `300` | number | Safeguard tier min points |

#### Tier Expiration

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.tierExpiration` | `annual` | select | `annual` / `never` / `6months` |
| `guardian.tierGracePeriodDays` | `90` | number | Days to re-qualify after reset |
| `guardian.lifetimeStatusAfterYears` | `3` | number | Consecutive years at Safeguard for lifetime status |

#### Points Earning

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.points.purchaseRate` | `1` | number | Points per $1 spent |
| `guardian.points.reviewText` | `5` | number | Points for text review |
| `guardian.points.reviewPhoto` | `15` | number | Points for photo review |
| `guardian.points.reviewVideo` | `25` | number | Points for video review |
| `guardian.points.referralSignup` | `20` | number | Points for referral signup |
| `guardian.points.referralPurchase` | `50` | number | Points for referral purchase |
| `guardian.points.petProfile` | `15` | number | Points for completing profile |
| `guardian.points.petBirthday` | `10` | number | Points for pet birthday |
| `guardian.points.anniversary` | `10` | number | Points for adoption anniversary |
| `guardian.points.monthlyAnniversary` | `5` | number | Points per month of membership |
| `guardian.points.yearlyAnniversary` | `25` | number | Points for annual membership |
| `guardian.points.tagScan` | `2` | number | Points per tag scan |
| `guardian.points.lostPetReport` | `5` | number | Points for filing lost report |
| `guardian.points.petReunited` | `20` | number | Points when pet is reunited |
| `guardian.points.socialShare` | `3` | number | Points for social sharing |
| `guardian.points.repeatPurchaseBonus` | `10` | number | Bonus on 3rd+ order |

#### Points Annual Caps

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.annualCap.reviewText` | `30` | number | Annual cap for text reviews |
| `guardian.annualCap.reviewPhoto` | `50` | number | Annual cap for photo reviews |
| `guardian.annualCap.referralSignup` | `200` | number | Annual cap for referral signups |
| `guardian.annualCap.tagScan` | `100` | number | Annual cap for tag scans |

#### PawRewards

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.pawrewards.care.monthly` | `2` | number | Monthly PawReward for Care tier |
| `guardian.pawrewards.nurture.monthly` | `3` | number | Monthly PawReward for Nurture tier |
| `guardian.pawrewards.protector.monthly` | `5` | number | Monthly PawReward for Protector tier |
| `guardian.pawrewards.safeguard.monthly` | `8` | number | Monthly PawReward for Safeguard tier |
| `guardian.pawrewards.purchaseRate` | `50` | number | $ spent per $1 PawReward |
| `guardian.pawrewards.minRedemption` | `2` | number | Minimum PawRewards to redeem |
| `guardian.pawrewards.expirationMonths` | `6` | number | Months before PawRewards expire |
| `guardian.pawrewards.maxBalance` | `20` | number | Max PawRewards balance (Guardian) |
| `guardian.pawrewards.maxBalanceGold` | `40` | number | Max PawRewards balance (Gold) |

#### Email Notifications

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.emails.joinGuardian` | `true` | toggle | Send welcome email on join |
| `guardian.emails.tierUpgrade` | `true` | toggle | Send tier upgrade email |
| `guardian.emails.monthlySummary` | `true` | toggle | Send monthly points summary |
| `guardian.emails.pawrewardsReminder` | `true` | toggle | Send PawRewards expiry reminder |
| `guardian.emails.anniversary` | `true` | toggle | Send membership anniversary email |

#### Dunning & Win-back

| Setting Key | Default | Type | Purpose |
|-------------|---------|------|---------|
| `guardian.dunning.retryAttempts` | `3` | number | Failed payment retry count |
| `guardian.dunning.retryIntervalDays` | `7` | number | Days between retries |
| `guardian.winback.emailDays` | `[30,60,90]` | JSON | Days after expiry to send win-back emails |

### 31.2 Backend Config Service

**New file:** `packages/api/src/services/guardian-config.service.ts`

- Reads all `guardian.*` settings from DB with 60s cache (same pattern as `commerce/config.ts`)
- Exports typed accessors:
  - `getGuardianConfig()` — Full config object
  - `getTierThresholds()` — Tier min/max points
  - `getPointsConfig()` — All point earning rates
  - `getPawRewardsConfig()` — PawRewards amounts and rules
  - `getDunningConfig()` — Retry attempts and intervals
  - `isGuardianEnabled()` — Master toggle check
- Invalidates cache when admin saves settings via `clearGuardianConfigCache()`

### 31.3 Admin Settings API Routes

**New file:** `packages/api/src/routes/admin-guardian-settings.ts`

| Endpoint | Permission | Purpose |
|----------|-----------|---------|
| `GET /admin/guardian/settings` | `setting.read` | Returns all guardian settings with current values, defaults, descriptions |
| `PUT /admin/guardian/settings` | `setting.update` | Bulk update changed settings (audit-logged) |

Follows exact same pattern as `admin-commerce.ts` settings routes.

---

## 32. LAYER 2: Backend Services

### 32.1 New Database Models

#### GuardianProfile (`packages/db/src/models/GuardianProfile.ts`)

```typescript
interface IGuardianProfile {
  userId: ObjectId;                    // ref: User, unique
  subscriptionType: 'guardian' | 'gold';
  currentTier: 'care' | 'nurture' | 'protector' | 'safeguard';
  totalPoints: Number;                 // Lifetime total
  currentYearPoints: Number;           // For annual tier calculation
  pawRewardsBalance: Number;           // Current redeemable balance
  pawRewardsExpiry: Date;              // When oldest PawRewards expire
  tierQualifiedAt: Date;               // When current tier was reached
  tierExpiresAt: Date;                 // When tier needs re-qualification
  lifetimeStatus: Boolean;             // Permanent tier after 3 consecutive years at Safeguard
  streakMonths: Number;                // Consecutive months of activity
  joinedAt: Date;                      // Guardian membership start
  lastActivityAt: Date;                // Last points-earning activity
}
```

**Indexes:** `userId` (unique), `currentTier`, `subscriptionType`, `lastActivityAt`

#### PointsLedger (`packages/db/src/models/PointsLedger.ts`)

```typescript
interface IPointsLedger {
  userId: ObjectId;                    // ref: User
  points: Number;                      // Positive = earn, negative = deduct
  type: 'earn' | 'deduct' | 'expire' | 'adjust';
  source: 'purchase' | 'review' | 'referral' | 'profile' | 'birthday' |
          'anniversary' | 'scan' | 'reunion' | 'social' | 'repeat_purchase' |
          'admin_adjust' | 'refund_deduct';
  description: String;
  orderId?: ObjectId;
  reviewId?: ObjectId;
  referralId?: ObjectId;
  createdAt: Date;
}
```

**Indexes:** `userId` + `createdAt`, `source`, `type`

#### PawRewardsLedger (`packages/db/src/models/PawRewardsLedger.ts`)

```typescript
interface IPawRewardsLedger {
  userId: ObjectId;                    // ref: User
  amount: Number;                      // Positive = earn, negative = redeem
  type: 'earn' | 'redeem' | 'expire' | 'adjust';
  source: 'monthly_allocation' | 'purchase_bonus' | 'checkout_redemption' |
          'admin_adjust' | 'expiration';
  orderId?: ObjectId;
  expiresAt: Date;
  createdAt: Date;
}
```

**Indexes:** `userId` + `createdAt`, `type`, `expiresAt`

### 32.2 Core Loyalty Service

**New file:** `packages/api/src/services/guardian.service.ts`

| Function | Purpose |
|----------|---------|
| `createGuardianProfile(userId, subscriptionType)` | Initialize profile on subscription creation |
| `awardPoints(userId, source, amount, metadata?)` | Award points with cap checking, tier recalculation |
| `deductPoints(userId, source, amount, reason)` | Deduct points (refunds, admin adjustments) |
| `calculateTier(userId)` | Determine tier from current year points |
| `recalculateTier(userId)` | Check if tier changed, send email if so |
| `checkTierExpiration(userId)` | Annual re-qualification check |
| `allocatePawRewards(userId)` | Monthly PawReward allocation based on tier |
| `redeemPawRewards(userId, amount, orderId)` | Apply PawRewards at checkout |
| `getGuardianDashboard(userId)` | Full dashboard data (tier, points, progress, PawRewards, activity) |
| `getTierBenefits(tier)` | Return benefits for a tier from CMS config |
| `getPointsHistory(userId, page, limit)` | Paginated points ledger |
| `getPawRewardsHistory(userId, page, limit)` | Paginated PawRewards ledger |

### 32.3 Email Service

**New file:** `packages/api/src/services/guardian-email.service.ts`

| Function | Trigger | Email Content |
|----------|---------|--------------|
| `sendJoinEmail(user)` | Join Guardian | Welcome + how to earn points + tier explanation |
| `sendTierUpgradeEmail(user, oldTier, newTier)` | Tier change | Congratulations + new benefits unlocked |
| `sendMonthlySummary(user, points, tier)` | Monthly cron | Points earned, current tier, PawRewards balance |
| `sendPawRewardsReminder(user, balance, expiry)` | 7 days before expiry | PawRewards expiring soon + redeem prompt |
| `sendAnniversaryEmail(user, years)` | Annual | Membership anniversary + annual reward |

### 32.4 Background Jobs

**Modified file:** `packages/api/src/services/subscription.service.ts`

Add to `runSubscriptionChecks()`:

| Job | Frequency | What It Does |
|-----|-----------|-------------|
| `allocateMonthlyPawRewards()` | Monthly (1st) | Allocate PawRewards to all active Guardian/Gold members |
| `checkTierExpirations()` | Monthly | Check tiers nearing expiration, send warnings |
| `expireOldPawRewards()` | Daily | Mark expired PawRewards, deduct from balances |
| `checkInactiveMembers()` | Weekly | Re-engagement email for members inactive 6+ months |

### 32.5 Modifications to Existing Services

#### `subscription.service.ts`

| Function | Change |
|----------|--------|
| `createSubscription()` | After creating subscription, call `createGuardianProfile(userId, type)` |
| `cancelSubscription()` | Stop point earning, preserve points, set tier expiry |
| `changeSubscriptionPlan()` | Handle Guardian↔Gold upgrade/downgrade, update profile |
| `processAutoRenewals()` | After successful renewal, trigger point award for purchase |

#### `order-creation.service.ts`

| Function | Change |
|----------|--------|
| `createPawTagOrder()` | After order creation, call `awardPoints(userId, 'purchase', ...)` with order total |

#### `referral.service.ts`

| Function | Change |
|----------|--------|
| `completeReferralRewards()` | After referral completes, call `awardPoints(userId, 'referral', ...)` for both referrer and referee |

### 32.6 New API Routes

#### Customer Routes (`packages/api/src/routes/customer-guardian.ts`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/customer/guardian/dashboard` | Full dashboard (tier, points, PawRewards, progress, recent activity) |
| `GET` | `/customer/guardian/points/history` | Points ledger with pagination |
| `GET` | `/customer/guardian/pawrewards/history` | PawRewards ledger with pagination |
| `POST` | `/customer/guardian/pawrewards/redeem` | Redeem PawRewards at checkout |
| `GET` | `/customer/guardian/tiers` | All tiers with benefits and thresholds |
| `POST` | `/customer/guardian/join` | Join Guardian ($0.99/mo) |
| `POST` | `/customer/guardian/upgrade-gold` | Upgrade to Gold ($1.99/mo) |

#### Admin Routes (`packages/api/src/routes/admin-guardian.ts`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/guardian/profiles` | List all guardian profiles with filters |
| `GET` | `/admin/guardian/profiles/:userId` | User's full guardian detail |
| `POST` | `/admin/guardian/profiles/:userId/adjust-points` | Manual point adjustment (audit-logged) |
| `POST` | `/admin/guardian/profiles/:userId/set-tier` | Manual tier override (audit-logged) |
| `GET` | `/admin/guardian/stats` | Overall stats (tier distribution, total points, PawRewards liability) |
| `GET` | `/admin/guardian/points/ledger` | All points transactions with filters |
| `GET` | `/admin/guardian/pawrewards/ledger` | All PawRewards transactions with filters |
| `POST` | `/admin/guardian/bulk-award` | Bulk point award (e.g., promotional) |

---

## 33. LAYER 3: Frontend Integration

### 33.1 Customer Portal Changes

#### New Sidebar Item

**File:** `apps/web/src/components/AccountLayout.tsx`

Add to `NAV_ITEMS` array between Subscriptions and Notifications:

```typescript
{ path: '/account/guardian', label: 'Guardian', icon: Shield }
```

#### New Page: Guardian Dashboard

**File:** `apps/web/src/pages/account/Guardian.tsx`

**Sections:**

1. **Hero Card** — Current tier badge (Care/Nurture/Protector/Safeguard) with animated progress bar to next tier
2. **Points Balance** — Total points + this year's points + "How to earn" link
3. **PawRewards Card** — Balance ($ value), expiry date, "Redeem at Checkout" button
4. **Progress Visual** — Animated progress bar showing points to next tier with percentage
5. **Tier Benefits** — Current tier benefits listed, next tier benefits previewed (locked/greyed)
6. **Recent Activity** — Last 10 points-earning activities with timestamps
7. **Gold Upgrade CTA** — If Guardian member, show upgrade prompt with Gold benefits comparison
8. **Membership Info** — Join date, current streak, lifetime points, current tier duration

**Data source:** `GET /customer/guardian/dashboard`

#### Modified: Subscriptions Page

**File:** `apps/web/src/pages/account/Subscriptions.tsx`

Add to existing subscription detail:
- Guardian/Gold badge on subscription card
- Link to Guardian dashboard
- Tier display next to subscription status

#### Checkout Integration

**File:** `apps/web/src/pages/Checkout.tsx`

- Show PawRewards balance on checkout page
- "Apply PawRewards" toggle with dollar value display
- Guardian tier badge displayed

### 33.2 Admin Portal Changes

#### New Sidebar Section

**File:** `apps/admin/src/components/Sidebar.tsx`

Add new section "Guardian & Loyalty" under "Products & Services":

```typescript
{
  id: 'guardian',
  label: 'Guardian & Loyalty',
  icon: Shield,
  links: [
    { to: '/guardian/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'subscription.read' },
    { to: '/guardian/profiles', label: 'Member Profiles', icon: Users, permission: 'subscription.read' },
    { to: '/guardian/points-ledger', label: 'Points Ledger', icon: History, permission: 'subscription.read' },
    { to: '/guardian/pawrewards-ledger', label: 'PawRewards Ledger', icon: Gift, permission: 'subscription.read' },
    { to: '/guardian/settings', label: 'Configuration', icon: Settings, permission: 'setting.read' },
  ]
}
```

#### New Admin Pages

##### GuardianDashboard (`apps/admin/src/pages/GuardianDashboard.tsx`)

- Summary cards: Total members, tier distribution, total points earned this month, PawRewards liability
- Chart: Tier distribution (pie chart)
- Chart: Points earned over time (line chart, last 12 months)
- Recent activity feed (latest 20 points transactions)
- Quick actions: Bulk award points, navigate to member search

##### GuardianProfiles (`apps/admin/src/pages/GuardianProfiles.tsx`)

- Paginated table with search/filter
- Columns: User (name + email), Tier (badge), Points (year), PawRewards balance, Subscription type, Status, Joined
- Filter by: Tier, subscription type, status
- Sort by: Points, joined date, last activity
- Click row → navigate to profile detail

##### GuardianProfileDetail (`apps/admin/src/pages/GuardianProfileDetail.tsx`)

- User info card (name, email, join date, subscription)
- Current tier with progress to next
- Points summary (lifetime, this year, this month)
- PawRewards balance and history
- Points history table (paginated)
- Admin actions: Adjust points (modal with reason), Set tier (dropdown), Send email

##### PointsLedger (`apps/admin/src/pages/PointsLedger.tsx`)

- Paginated table of all points transactions
- Columns: User, Points (+/-), Source, Description, Date
- Filter by: Source type, date range, user search
- Export to CSV

##### PawRewardsLedger (`apps/admin/src/pages/PawRewardsLedger.tsx`)

- Same pattern as PointsLedger
- Columns: User, Amount (+/-), Source, Description, Expiry, Date

##### GuardianSettings (`apps/admin/src/pages/GuardianSettings.tsx`)

**THE KEY PAGE — Follows CommerceSettings.tsx pattern exactly**

- Groups: General, Pricing, Gold, Tiers, Points Earning, Points Caps, PawRewards, Emails, Dunning, Win-back
- Each setting: label, input (toggle/number/select), description, default value
- Only changed values sent on save
- Audit-logged on save
- "Reset to Defaults" button per group

**Setting groups rendered as cards:**

1. **General** — Master enable/disable
2. **Pricing** — Guardian and Gold monthly prices
3. **Gold Configuration** — Multiplier, starting tier, free shipping threshold
4. **Tier Thresholds** — Min/max points for each tier (Care, Nurture, Protector, Safeguard)
5. **Tier Expiration** — Expiration mode, grace period, lifetime status threshold
6. **Points Earning** — All 16 earning activities with point values
7. **Points Caps** — Annual caps for capped activities
8. **PawRewards** — Monthly allocation per tier, purchase rate, min redemption, expiration, max balance
9. **Email Notifications** — Toggle each email type on/off
10. **Dunning** — Retry attempts and interval
11. **Win-back** — Email schedule (JSON array of days)

#### New Routes

**File:** `apps/admin/src/App.tsx`

```typescript
<Route path="/guardian/dashboard" element={<ProtectedRoute><GuardianDashboard /></ProtectedRoute>} />
<Route path="/guardian/profiles" element={<ProtectedRoute><GuardianProfiles /></ProtectedRoute>} />
<Route path="/guardian/profiles/:userId" element={<ProtectedRoute><GuardianProfileDetail /></ProtectedRoute>} />
<Route path="/guardian/points-ledger" element={<ProtectedRoute><PointsLedger /></ProtectedRoute>} />
<Route path="/guardian/pawrewards-ledger" element={<ProtectedRoute><PawRewardsLedger /></ProtectedRoute>} />
<Route path="/guardian/settings" element={<ProtectedRoute><GuardianSettings /></ProtectedRoute>} />
```

---

## 34. Data Flow Summary

```
Admin changes setting in GuardianSettings.tsx
  → PUT /admin/guardian/settings
  → Updates Setting collection
  → Invalidates guardian-config cache
  → Next request uses new value

Customer earns points
  → API call to /customer/guardian/... or triggered by order/review
  → guardian.service.ts reads config from cache
  → Awards points with correct rate/caps
  → Writes to PointsLedger
  → Updates GuardianProfile.totalPoints + currentYearPoints
  → Checks tier upgrade
  → If tier changed: sends email, logs audit

Customer redeems PawRewards
  → POST /customer/guardian/pawrewards/redeem
  → Validates balance, minimum, order total
  → Deducts from GuardianProfile.pawRewardsBalance
  → Writes to PawRewardsLedger
  → Returns discount code for checkout

Monthly cron
  → Allocates PawRewards to all active members
  → Checks tier expirations
  → Expires old PawRewards
  → All values read from CMS config (no hardcoded values)
```

---

## 35. Files to Create

### Database Models

| File | Purpose |
|------|---------|
| `packages/db/src/models/GuardianProfile.ts` | Guardian member profile model |
| `packages/db/src/models/PointsLedger.ts` | Points transaction history |
| `packages/db/src/models/PawRewardsLedger.ts` | PawRewards transaction history |

### Backend Services

| File | Purpose |
|------|---------|
| `packages/api/src/services/guardian-config.service.ts` | CMS config reader with 60s cache |
| `packages/api/src/services/guardian.service.ts` | Core loyalty service (points, tiers, PawRewards) |
| `packages/api/src/services/guardian-email.service.ts` | Loyalty email notifications |

### Backend Routes

| File | Purpose |
|------|---------|
| `packages/api/src/routes/admin-guardian-settings.ts` | Admin settings CRUD (GET/PUT) |
| `packages/api/src/routes/admin-guardian.ts` | Admin member management + ledgers |
| `packages/api/src/routes/customer-guardian.ts` | Customer dashboard + PawRewards |

### Admin Frontend

| File | Purpose |
|------|---------|
| `apps/admin/src/pages/GuardianDashboard.tsx` | Admin overview dashboard |
| `apps/admin/src/pages/GuardianProfiles.tsx` | Admin member list with filters |
| `apps/admin/src/pages/GuardianProfileDetail.tsx` | Admin single member detail |
| `apps/admin/src/pages/PointsLedger.tsx` | Admin points transaction history |
| `apps/admin/src/pages/PawRewardsLedger.tsx` | Admin PawRewards transaction history |
| `apps/admin/src/pages/GuardianSettings.tsx` | Admin configuration page (CMS-driven) |

### Customer Frontend

| File | Purpose |
|------|---------|
| `apps/web/src/pages/account/Guardian.tsx` | Customer Guardian dashboard |

---

## 36. Files to Modify

| File | Change |
|------|--------|
| `packages/api/src/seeds/seed-cms.ts` | Add all `guardian.*` settings (50+ settings) |
| `packages/api/src/services/subscription.service.ts` | Wire createSubscription(), integrate Guardian profile creation, add Guardian cron jobs |
| `packages/api/src/services/order-creation.service.ts` | Award points on purchase |
| `packages/api/src/services/referral.service.ts` | Award points on referral |
| `packages/api/src/index.ts` | Register new routes (admin-guardian-settings, admin-guardian, customer-guardian), start guardian cron |
| `packages/shared/src/index.ts` | Add Guardian types, tier enums, point source types |
| `packages/db/src/index.ts` | Export new models (GuardianProfile, PointsLedger, PawRewardsLedger) |
| `apps/admin/src/App.tsx` | Add 6 Guardian routes |
| `apps/admin/src/components/Sidebar.tsx` | Add "Guardian & Loyalty" section with 5 links |
| `apps/web/src/App.tsx` | Add /account/guardian route |
| `apps/web/src/components/AccountLayout.tsx` | Add Guardian sidebar item (Shield icon) |
| `apps/web/src/pages/account/Subscriptions.tsx` | Add tier display + Guardian dashboard link |

---

## 37. Implementation Phases

### Phase 1: CMS Config Layer (Week 1)

| Task | File | Duration |
|------|------|----------|
| Seed all `guardian.*` settings | `seed-cms.ts` | Day 1 |
| Create guardian-config.service.ts with cache | New service | Day 1-2 |
| Create admin settings API routes | New routes | Day 2 |
| Create admin GuardianSettings.tsx page | New page | Day 3-4 |
| Test: Change setting in admin, verify backend uses new value | — | Day 5 |

### Phase 2: Database Models (Week 1-2)

| Task | File | Duration |
|------|------|----------|
| Create GuardianProfile model | New model | Day 1 |
| Create PointsLedger model | New model | Day 1 |
| Create PawRewardsLedger model | New model | Day 1 |
| Add all indexes | Models | Day 2 |
| Export models from packages/db | index.ts | Day 2 |

### Phase 3: Core Services (Week 2-3)

| Task | File | Duration |
|------|------|----------|
| Create guardian.service.ts | New service | Day 3-5 |
| Create guardian-email.service.ts | New service | Day 1-2 |
| Modify subscription.service.ts — wire createSubscription() | Existing | Day 1 |
| Modify subscription.service.ts — add Guardian integration | Existing | Day 2 |
| Create customer-guardian.ts routes | New routes | Day 2-3 |
| Create admin-guardian.ts routes | New routes | Day 2-3 |
| Modify order-creation.service.ts — award points on purchase | Existing | Day 1 |
| Modify referral.service.ts — award points on referral | Existing | Day 1 |

### Phase 4: Customer Portal (Week 3-4)

| Task | File | Duration |
|------|------|----------|
| Create Guardian.tsx dashboard page | New page | Day 3-4 |
| Add sidebar item to AccountLayout.tsx | Existing | Day 0.5 |
| Add route to App.tsx | Existing | Day 0.5 |
| Modify Subscriptions.tsx — add tier display | Existing | Day 1 |
| Checkout integration — PawRewards redemption | Existing | Day 1-2 |

### Phase 5: Admin Portal (Week 4-5)

| Task | File | Duration |
|------|------|----------|
| Create GuardianDashboard.tsx | New page | Day 2 |
| Create GuardianProfiles.tsx | New page | Day 2 |
| Create GuardianProfileDetail.tsx | New page | Day 2 |
| Create PointsLedger.tsx | New page | Day 1 |
| Create PawRewardsLedger.tsx | New page | Day 1 |
| Add sidebar section to Sidebar.tsx | Existing | Day 0.5 |
| Add 6 routes to App.tsx | Existing | Day 0.5 |

### Phase 6: Background Jobs (Week 5)

| Task | File | Duration |
|------|------|----------|
| Add monthly PawReward allocation job | subscription.service.ts | Day 1 |
| Add tier expiration check job | subscription.service.ts | Day 1 |
| Add PawReward expiry job | subscription.service.ts | Day 0.5 |
| Add inactive member check job | subscription.service.ts | Day 0.5 |
| Register cron in index.ts | Existing | Day 0.5 |

### Phase 7: Testing & Launch (Week 6)

| Task | Duration |
|------|----------|
| Unit tests for points engine | Day 1-2 |
| Integration tests for full flow | Day 1 |
| Admin settings page testing | Day 0.5 |
| Customer dashboard testing | Day 0.5 |
| Soft launch to 100 customers | Day 1 |
| Bug fixes and refinements | Day 1-2 |

---

## 38. Shared Types to Add

**File:** `packages/shared/src/index.ts`

```typescript
// Guardian Tiers
export type GuardianTier = 'care' | 'nurture' | 'protector' | 'safeguard';

// Subscription Type
export type GuardianSubscriptionType = 'guardian' | 'gold';

// Points Source
export type PointsSource =
  | 'purchase' | 'review' | 'referral' | 'profile' | 'birthday'
  | 'anniversary' | 'scan' | 'reunion' | 'social' | 'repeat_purchase'
  | 'admin_adjust' | 'refund_deduct';

// Points Transaction Type
export type PointsTransactionType = 'earn' | 'deduct' | 'expire' | 'adjust';

// PawRewards Source
export type PawRewardsSource =
  | 'monthly_allocation' | 'purchase_bonus' | 'checkout_redemption'
  | 'admin_adjust' | 'expiration';

// Tier Display Config
export const GUARDIAN_TIER_CONFIG: Record<GuardianTier, {
  label: string;
  color: string;
  icon: string;
}> = {
  care: { label: 'Care', color: '#6B7280', icon: 'Heart' },
  nurture: { label: 'Nurture', color: '#10B981', icon: 'Sprout' },
  protector: { label: 'Protector', color: '#3B82F6', icon: 'Shield' },
  safeguard: { label: 'Safeguard', color: '#8B5CF6', icon: 'Lock' },
};
```

---

*This implementation plan provides a fully CMS-driven, code-change-free configurable loyalty system. Every business value can be adjusted from the admin Guardian Settings page. The architecture follows existing PawTag patterns (CommerceSettings, Setting model, 60s cache, audit logging) for consistency and maintainability.*
