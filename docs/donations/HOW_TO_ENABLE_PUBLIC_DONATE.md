# How to enable public Donate menu

## What you have now

| Item | State |
|---|---|
| Donation settings seeded | **Yes** — `donation.*` in database |
| `/donate` page + Stripe card form | **Yes** (code) |
| Footer Donate link code | **Yes** — shows only when `donation.publicEnabled=true` |
| Public menu | **Off** (`donation.publicEnabled=false`) |
| Admin Donations page | **Yes** — needs permission `donation.read` |

## Enable public Donate (3 steps)

### 1. Restart the web + API (if not already running)

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:admin
```

### 2. Turn on the public switch

**Option A — Admin UI (easiest):**  
Admin → Settings (or Commerce settings) → set **`donation.publicEnabled`** to **`true`**

**Option B — Database (if no admin UI yet):**

```bash
# In packages/api with .env loaded — or any Mongo client
# Update setting donation.publicEnabled to "true"
```

Example using the API seed pattern — set via admin after login, or:

```javascript
// Conceptually: settings.update key donation.publicEnabled value true
```

### 3. Refresh the public website

Footer should show **Donate** (Quick Links + bottom bar).

You can also always open: `http://localhost:3000/donate`

---

## Admin Donations menu

1. Sign in to **Admin**  
2. User role must include permission **`donation.read`** (and `donation.refund` for refunds)  
3. Sidebar → **Payments & Refunds → Donations**  

If the menu is missing: the logged-in admin does not have `donation.read` yet.

---

## Safety notes

- Public Donate stays **off** until you enable `donation.publicEnabled`  
- Receipts stay **neutral** (no IRD tax claims) until accountant/legal confirm  
- Live card charges need Stripe **live** keys + webhook on Stripe dashboard  

---

## Receipts (PDF + download)

| Item | Behaviour |
|---|---|
| Receipt number prefix | Setting **`donation.receipt.numberPrefix`** (default **`PTD`**) — not hardcoded |
| Email | Personalised with receipt number + **Download receipt** link + **PDF attachment** |
| My Donations | View / download receipt after sign-in |
| Tax wording | Neutral until NZ donee status confirmed |

## Payment confirm + webhook (one endpoint)

Donations complete like shop/membership:

1. Card success in `/donate` → `POST /api/donations/:id/confirm` (server checks Stripe)
2. Stripe webhook remains backup: `/api/webhooks/stripe` (same as shop)

**No second webhook.** See `STRIPE_WEBHOOK_SETUP.md` for CLI/dashboard steps.

## Verified in DB (this session)

```text
donation.enabled: true
donation.publicEnabled: false   ← turn this on for public menu
donation.suggestedAmounts: 5,10,20,50
donation.receipt.organisationName: PawTag
donation.receipt.numberPrefix: PTD
donation.minAmountCents: 500
```


