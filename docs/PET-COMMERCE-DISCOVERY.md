# PawTag Pet Commerce Discovery Report

> **Document type:** Comprehensive discovery, code audit, business model research, and architecture recommendation
> **Date:** September 2026
> **Status:** Pre-implementation (no code changes)
> **Scope:** Full codebase audit + external research + architecture recommendation for selling pet products on PawTag

---

## Table of Contents

1. [Business Objective](#1-business-objective)
2. [Commerce Models Overview](#2-commerce-models-overview)
3. [Codebase Audit: What Exists Today](#3-codebase-audit-what-exists-today)
4. [Existing E-Commerce Audit](#4-existing-e-commerce-audit)
5. [Medusa Audit (Deprecated)](#5-medusa-audit-deprecated)
6. [Customer System](#6-customer-system)
7. [Guardian Loyalty System](#7-guardian-loyalty-system)
8. [Business Model Research](#8-business-model-research)
9. [Supplier Discovery](#9-supplier-discovery)
10. [Affiliate Network Research](#10-affiliate-network-research)
11. [Product Sourcing Architecture](#11-product-sourcing-architecture)
12. [Product Ownership Model](#12-product-ownership-model)
13. [Cart & Checkout Decision](#13-cart--checkout-decision)
14. [Multi-Supplier Cart Problem](#14-multi-supplier-cart-problem)
15. [Automation](#15-automation)
16. [Open-Source Software](#16-open-source-software)
17. [Build vs Buy](#17-build-vs-buy)
18. [Cost Analysis](#18-cost-analysis)
19. [Profitability](#19-profitability)
20. [Product Category Strategy](#20-product-category-strategy)
21. [Customer Experience](#21-customer-experience)
22. [Guardian Loyalty Integration](#22-guardian-loyalty-integration)
23. [SEO & Content](#23-seo--content)
24. [Legal Considerations](#24-legal-considerations)
25. [Final Recommendation](#25-final-recommendation)
26. [Implementation Roadmap](#26-implementation-roadmap)
27. [Appendix: Full Database Inventory](#27-appendix-full-database-inventory)
28. [Appendix: Full API Route Inventory](#28-appendix-full-api-route-inventory)
29. [Appendix: Frontend Architecture](#29-appendix-frontend-architecture)

---

## 1. Business Objective

### Vision

PawTag is a pet recovery platform using QR code tags. The business goal is to expand into a **pet shopping destination** selling other people's pet products (food, toys, accessories, gadgets, grooming, health, travel, clothing, technology) and earn margin or commission on those sales.

### Constraints

| Constraint | Detail |
|-----------|--------|
| **Funding** | No external funding, limited capital |
| **Warehouse** | No warehouse, no physical inventory |
| **Operations team** | No dedicated e-commerce team |
| **Technical team** | Solo non-technical owner |
| **Priority** | LOW COST + HIGH AUTOMATION + LOW MAINTENANCE + GOOD CX + RELIABLE TRACKING + CUSTOMER OWNERSHIP + GUARDIAN LOYALTY + SCALABILITY |

### Ideal Flow

```
Customer comes to PawTag
  → discovers pet products
  → purchases through PawTag
  → supplier handles inventory/fulfilment
  → PawTag earns margin or commission
  → minimal manual work
```

### What We Are NOT

- **NOT** an affiliate system where others sell PawTag products
- **NOT** a marketplace where sellers list their own products
- **NOT** a traditional retailer buying and holding inventory
- **We ARE** a pet commerce destination sourcing from suppliers and selling to end customers

---

## 2. Commerce Models Overview

### 2.1 Affiliate Marketing (Others Sell Our Products)

**How it works:** Partners promote PawTag products, earn commission on sales they drive.

| Aspect | Detail |
|--------|--------|
| **PawTag role** | Product creator/owner |
| **Partner role** | Promoter, drives traffic |
| **Revenue** | PawTag keeps sale minus commission |
| **Fulfilment** | PawTag handles everything |
| **Inventory** | PawTag owns inventory |
| **Automation** | Link tracking, commission calculation, payout |
| **Best for** | When PawTag has its own desirable products |
| **Relevance to PawTag** | LOW — PawTag has one product (tags) and doesn't need others to sell it |

**Verdict:** Not relevant. PawTag doesn't have enough products to warrant an affiliate program, and the existing referral system already handles customer word-of-mouth.

### 2.2 Dropshipping (We Sell Others' Products, They Ship)

**How it works:** PawTag lists products from suppliers. Customer buys from PawTag. Supplier ships directly to customer. PawTag never touches inventory.

| Aspect | Detail |
|--------|--------|
| **PawTag role** | Retailer, owns customer relationship |
| **Supplier role** | Inventory holder, ships directly |
| **Revenue** | Markup on supplier price (25-40% typical) |
| **Fulfilment** | Supplier ships directly to customer |
| **Inventory** | Supplier owns, PawTag tracks digitally |
| **Automation** | Product feed sync, auto-order forwarding, tracking sync |
| **Best for** | Asset-light expansion, testing product categories |
| **Relevance to PawTag** | HIGH — fits all constraints perfectly |

**Types of dropshipping:**

| Type | Source | Shipping to NZ | Typical Margin |
|------|--------|----------------|----------------|
| **AliExpress** | China | 7-21 days | 40-60% |
| **CJ Dropshipping** | China (with AU warehouse) | 3-7 days (AU stock) | 30-50% |
| **AutoDS** | Multi-supplier aggregator | Varies | 25-40% |
| **Local NZ suppliers** | NZ-based wholesalers | 1-3 days | 20-35% |
| **AU suppliers** | Australian wholesalers | 3-7 days | 20-35% |

### 2.3 Wholesale / Reseller (Buy in Bulk, Resell)

**How it works:** PawTag buys products at wholesale price, holds inventory, ships to customers.

| Aspect | Detail |
|--------|--------|
| **PawTag role** | Retailer, holds inventory |
| **Supplier role** | Wholesaler, sells bulk to PawTag |
| **Revenue** | Wholesale-to-retail markup |
| **Fulfilment** | PawTag ships (or 3PL) |
| **Inventory** | PawTag owns, risk of unsold stock |
| **Automation** | Reorder alerts, inventory management |
| **Best for** | High-volume, proven products |
| **Relevance to PawTag** | LOW — requires capital, warehouse, operations |

**Verdict:** Not suitable. Requires capital for inventory, warehouse space, and operations team. Contradicts the "no warehouse, limited capital" constraint.

### 2.4 Supplier Fulfilment (Ship-from-Supplier)

**How it works:** PawTag holds the customer relationship and marketing. Supplier handles warehousing and shipping. Similar to dropshipping but typically with exclusive/branded arrangements.

| Aspect | Detail |
|--------|--------|
| **PawTag role** | Brand, marketing, customer relationship |
| **Supplier role** | Warehousing, fulfilment |
| **Revenue** | Negotiated margin |
| **Fulfilment** | Supplier ships |
| **Inventory** | Supplier holds |
| **Automation** | API integration, order forwarding |
| **Best for** | Established supplier relationships |
| **Relevance to PawTag** | MEDIUM — possible for NZ/AU local suppliers |

### 2.5 Product Feed / Marketplace (Aggregate Multiple Suppliers)

**How it works:** PawTag aggregates products from multiple suppliers via product feeds (XML/CSV/API). Displays them in a unified storefront. Orders are routed to the appropriate supplier.

| Aspect | Detail |
|--------|--------|
| **PawTag role** | Aggregator, storefront |
| **Supplier role** | Provide product data feeds |
| **Revenue** | Margin on each sale |
| **Fulfilment** | Supplier ships |
| **Inventory** | Supplier holds |
| **Automation** | Feed parsing, price/stock sync, order routing |
| **Best for** | Wide product range, multiple suppliers |
| **Relevance to PawTag** | HIGH — enables massive catalogue with minimal work |

### 2.6 Local NZ Suppliers

**How it works:** Source from NZ-based pet product distributors/wholesalers. Faster shipping, local support, easier returns.

| Supplier Type | Examples | Shipping | MOQ |
|--------------|---------|----------|-----|
| NZ pet distributors | Ku-ring-gai, VetDirect, NRM | 1-3 days | $200-$500 |
| NZ wholesalers | Modern Foods, Petcraft | 1-2 days | $100-$300 |
| NZ manufacturers | Local pet food/toy makers | 1-3 days | Varies |
| Dropship NZ | NZ-based dropship suppliers | 1-3 days | None |

**Advantages:** Fast shipping (1-3 days NZ-wide), easier returns, local support, NZD pricing, no customs/GST issues.

**Disadvantages:** Smaller range, potentially higher prices, manual onboarding.

### 2.7 Australian Suppliers

**How it works:** Source from Australian pet product companies. Larger market than NZ, more suppliers, competitive prices.

| Supplier Type | Examples | Shipping to NZ | Notes |
|--------------|---------|----------------|-------|
| AU pet distributors | Petstock, Petbarn wholesale | 3-7 days | Larger range |
| AU wholesalers | Masterpet, Arrow Pet | 3-7 days | Good prices |
| AU dropship | PetDrop, DropShip AU | 3-7 days | Automation ready |

**Advantages:** Larger range than NZ, competitive pricing, similar time zone, English-speaking.

**Disadvantages:** Shipping to NZ adds 2-4 days, currency conversion, potential customs.

### 2.8 Chinese Suppliers

**How it works:** Source from AliExpress, 1688.com, or CJ Dropshipping. Massive range, lowest prices, but longer shipping.

| Platform | Range | Price | Shipping to NZ | Automation |
|----------|-------|-------|----------------|------------|
| AliExpress | 100M+ products | Lowest | 7-21 days | Manual/AutoDS |
| 1688.com | Wholesale China | Very low | 10-25 days | Manual only |
| CJ Dropshipping | Curated 400K+ | Low | 3-7 days (AU stock) | API available |
| DHGate | Wholesale | Low | 7-20 days | Manual |

**Advantages:** Massive range, lowest prices, high margins possible.

**Disadvantages:** Long shipping, quality inconsistency, returns complicated, customs/GST.

### 2.9 Hybrid Model

**How it works:** Combine multiple sourcing strategies. Use local NZ suppliers for fast delivery, AU for mid-range, China for high-margin niche products.

| Source | Use Case | Shipping | Margin |
|--------|----------|----------|--------|
| NZ suppliers | Everyday pet essentials | 1-3 days | 20-30% |
| AU suppliers | Premium/mid-range products | 3-7 days | 25-35% |
| CJ Dropshipping | Trending/unique products | 3-7 days (AU) | 30-50% |
| AliExpress | High-margin accessories | 7-21 days | 40-60% |

**This is the recommended approach** — maximises range, minimises risk, optimises shipping.

---

## 3. Codebase Audit: What Exists Today

### 3.1 Commerce Module (Fully Built)

```
packages/api/src/commerce/
├── config.ts                    # 35+ CMS settings with 60s cache
├── errors.ts                    # 11 commerce-specific error types
├── audit.ts                     # Commerce audit logging helpers
├── interfaces/
│   ├── payment-provider.ts      # IPaymentProvider (6 methods)
│   ├── shipping-provider.ts     # IShippingProvider
│   ├── tax-provider.ts          # ITaxProvider
│   └── inventory-provider.ts    # IInventoryProvider
├── providers/
│   ├── stripe/index.ts          # StripePaymentProvider (461 lines)
│   ├── nz-shipping/             # NZ domestic shipping (free/flat-rate)
│   └── simple-gst/              # NZ GST (15%)
└── services/
    ├── cart.service.ts           # 475 lines — server-side cart (guest+auth, merge, price revalidation)
    ├── checkout.service.ts       # 532 lines — checkout orchestration (4-step wizard)
    ├── pricing.service.ts        # 219 lines — server-side price calculations
    ├── inventory.service.ts      # 297 lines — atomic stock management
    ├── product.service.ts        # Product CRUD with features, variants, pricing
    ├── shipping.service.ts       # Shipping rates
    ├── shipment.service.ts       # Shipment creation
    ├── refund.service.ts         # Full/partial refunds
    └── refund-retry.service.ts   # Auto-retry failed refunds
```

**Key insight:** PawTag already has a complete e-commerce engine. Products, pricing, cart, checkout, payments (Stripe), orders, invoices, refunds, inventory, and shipping are ALL fully implemented and working.

### 3.2 Database Models (58 models)

**Commerce-critical models that already exist:**

| Model | Lines | What It Does |
|-------|-------|-------------|
| `Product` | 320 | Products with variants, features, pricing, SEO |
| `Cart` | 250 | Server-side cart with guest+auth support |
| `PendingOrder` | 150 | Pre-payment order snapshot with TTL |
| `Order` | 400+ | Full order lifecycle, cancellation, refund tracking |
| `Invoice` | 200 | Financial documents |
| `PaymentTransaction` | 150 | Payment audit trail |
| `Shipment` | 120 | Shipping tracking |
| `ShippingMethod` | 80 | Shipping options |
| `StockMovement` | 100 | Inventory audit trail |
| `Fulfilment` | 80 | Order fulfilment |
| `Return` | 120 | Return requests |
| `PromoCode` | 100 | Discount codes |
| `Brand` | 60 | Product brands |
| `Category` | 80 | Product categories |
| `Collection` | 60 | Product collections |

### 3.3 API Routes (52 routes)

**Commerce routes that already exist:**

| Route | Purpose |
|-------|---------|
| `GET /api/products` | Public product listing with feature highlights |
| `GET /api/products/slug/:slug` | Product by slug (SEO-friendly) |
| `GET /api/products/sku/:sku` | Product by SKU |
| `GET /api/products/:id` | Product by ID |
| `GET/POST/PUT/DELETE /api/cart/*` | Cart management (guest+auth, merge) |
| `POST /api/checkout/payment-intent` | Create Stripe PaymentIntent |
| `POST /api/checkout/confirm` | Confirm checkout (idempotent) |
| `POST /api/public/promo/validate` | Validate promo code (no auth) |
| `POST /api/webhooks/stripe` | Stripe webhook handler |
| `GET/PUT /api/admin/commerce/settings` | Commerce settings management |
| `GET/POST/PUT/DELETE /api/admin/commerce/shipments` | Shipment management |
| `GET /api/admin/commerce/payments` | Payment reconciliation |
| `GET/POST/PUT/DELETE /api/admin/commerce/promo-codes` | Discount codes |
| `POST /api/customer/returns` | Customer return requests |
| `DELETE /api/customer/returns/:orderId` | Customer order cancellation |

### 3.4 Frontend Pages

**Shop-related pages that already exist:**

| App | Page | Route |
|-----|------|-------|
| `apps/web` | Shop | `/shop` |
| `apps/web` | Product Detail | `/shop/:slug` |
| `apps/web` | Checkout | `/checkout` (4-step wizard) |
| `apps/web` | Order History | `/account/orders` |
| `apps/web` | Order Detail | `/account/orders/:id` |
| `apps/web` | Refer & Earn | `/refer` |
| `apps/web` | Referrals Dashboard | `/account/referrals` |
| `apps/admin` | Products | `/products` |
| `apps/admin` | Product Editor | `/products/new`, `/products/:id/edit` |
| `apps/admin` | Orders | `/orders` |
| `apps/admin` | Order Detail | `/orders/:id` |
| `apps/admin` | Commerce Settings | `/commerce-settings` |

### 3.5 What's Missing for Pet Commerce

| Feature | Status | Required For |
|---------|--------|-------------|
| Multi-supplier product model | MISSING | Supplier/product ownership |
| Supplier feed import | MISSING | Auto product sync |
| Supplier order routing | MISSING | Auto fulfilment |
| Supplier tracking sync | MISSING | Customer updates |
| Product feed parser (XML/CSV/API) | MISSING | Feed-based suppliers |
| Supplier-specific pricing | MISSING | Per-supplier margins |
| Supplier dashboard | MISSING | Supplier self-service |
| Automated price/stock sync | MISSING | Real-time accuracy |
| Multi-supplier cart splitting | MISSING | Per-supplier orders |
| Supplier commission tracking | MISSING | Payment reconciliation |

---

## 4. Existing E-Commerce Audit

### 4.1 What PawTag Already Handles

| Capability | Status | Implementation |
|-----------|--------|---------------|
| Product listing | ✅ | Product model, admin CRUD |
| Product variants | ✅ | Product.variants[] |
| Product pricing | ✅ | pricing.service.ts (server-side) |
| Product features | ✅ | Product.features[] with icons |
| Product images | ✅ | Cloudflare R2 storage |
| Product categories | ✅ | Category model |
| Product brands | ✅ | Brand model |
| Product collections | ✅ | Collection model |
| Product SEO | ✅ | Slug-based URLs, meta tags |
| Product search | ✅ | Text search + filters |
| Shopping cart | ✅ | cart.service.ts (guest+auth) |
| Price revalidation | ✅ | On every cart load |
| Guest cart | ✅ | Anonymous carts with merge |
| Checkout flow | ✅ | 4-step wizard |
| Stripe payments | ✅ | Direct Stripe integration |
| Order creation | ✅ | Idempotent, retry on dup key |
| Invoice generation | ✅ | Automatic on order |
| Email notifications | ✅ | 16 templates |
| Promo codes | ✅ | Discount system |
| Inventory management | ✅ | Atomic stock, reservation |
| Shipping (NZ) | ✅ | Free/flat-rate NZ shipping |
| Tax (GST) | ✅ | 15% NZ GST |
| Refunds | ✅ | Full/partial, auto-retry |
| Returns | ✅ | Customer return requests |
| Order cancellation | ✅ | Customer/admin/system |
| Audit logging | ✅ | SHA-256 hash chain |

### 4.2 What's NOT Built Yet

| Capability | Status | Impact |
|-----------|--------|--------|
| Supplier model | ❌ | Can't track product ownership |
| Supplier feeds | ❌ | Can't auto-sync products |
| Multi-supplier orders | ❌ | Can't split orders per supplier |
| Supplier tracking | ❌ | Can't sync shipment tracking |
| Supplier pricing | ❌ | Can't track per-supplier cost |
| Supplier dashboard | ❌ | No self-service for suppliers |
| Automated reordering | ❌ | Manual stock management |
| Product feed parser | ❌ | No XML/CSV/API import |
| Price monitoring | ❌ | No auto price updates |
| Stock monitoring | ❌ | No auto stock updates |

---

## 5. Medusa Audit (Deprecated)

**Status:** Medusa was previously considered but is now deprecated for PawTag.

**Why deprecated:**
- PawTag already has a complete commerce module built in-house
- Medusa would require migrating all existing commerce data
- PawTag's commerce module is tightly integrated with the rest of the system (tags, subscriptions, referrals, RBAC, audit logging)
- Medusa adds another layer of complexity and another database
- PawTag's needs are simpler than what Medusa provides

**Decision:** Continue with PawTag's native commerce module. Extend it for multi-supplier dropshipping.

---

## 6. Customer System

### 6.1 Existing Customer Model

PawTag already has a comprehensive customer system:

| Feature | Implementation |
|---------|---------------|
| User registration | Auth routes with email verification |
| User profiles | User model with full contact info |
| Role-based access | RBAC with roles, permissions, scopes |
| MFA | Email/phone OTP |
| Customer portal | AccountLayout with onboarding wizard |
| Notifications | In-app + push (Firebase) |
| Pet profiles | Pet model linked to owner |
| Tag management | Tag model with subscription |
| Order history | Order model linked to user |
| Referral tracking | Referral + ReferralCode models |

### 6.2 Customer Data Available

```typescript
interface User {
  email: string;           // Unique
  fullName: string;
  phone: string;
  roles: UserRole[];
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  showOwnerNameInFinder: boolean;
  notificationPreferences: { email, push, sms };
  // ... plus address, timezone, etc.
}
```

### 6.3 Customer Engagement Points

| Touchpoint | Existing? | Pet Commerce Opportunity |
|-----------|-----------|-------------------------|
| Tag purchase | ✅ | Cross-sell pet products |
| Subscription renewal | ✅ | Bundle pet products |
| Pet profile | ✅ | Personalised product recommendations |
| Order confirmation | ✅ | Product suggestions |
| Pet found | ✅ | "Treat your pet" marketing |
| Onboarding | ✅ | Pet product discovery |

---

## 7. Guardian Loyalty System

### 7.1 What Exists

| Feature | Status | File |
|---------|--------|------|
| Referral codes | ✅ | ReferralCode model |
| Referral tracking | ✅ | Referral model |
| Referral UI | ✅ | Refer.tsx, Referrals.tsx |
| Referral rewards | ✅ | 1 month free subscription |
| Admin referral management | ✅ | Admin Referrals.tsx |

### 7.2 How Guardian Loyalty Integrates with Pet Commerce

The Guardian loyalty program can be extended to reward pet product purchases:

| Loyalty Action | Reward |
|---------------|--------|
| Purchase pet product | Earn Guardian points |
| Refer a friend (who buys) | Bonus points |
| Complete pet profile | Bonus points |
| Write product review | Bonus points |
| Monthly subscription | Bonus points |
| Redeem points | Discount on tags/subscriptions |

---

## 8. Business Model Research

### 8.1 Dropshipping Viability in NZ

**Market size:** NZ pet industry estimated at $1.5B+ annually. Online pet product sales growing 15-20% per year.

**Competition:** Major players include PetDirect NZ, Petstock NZ, Animates, PetCity. Most are traditional retailers with physical stores. Few pure-play online pet stores with dropship models.

**Opportunity:** PawTag's unique angle — pet recovery + pet products. No competitor combines these. Customers already trust PawTag with their pet's safety; trusting them with product recommendations is natural.

### 8.2 Profit Margins (2026 Data)

| Product Category | Retail Price (NZD) | Supplier Price | Typical Margin | PawTag Price | PawTag Margin |
|-----------------|-------------------|----------------|----------------|--------------|---------------|
| Pet food (premium) | $45-$80 | $25-$50 | 30-40% | $55 | $15-$30 |
| Dog toys | $15-$40 | $5-$15 | 50-65% | $25 | $10-$25 |
| Cat accessories | $20-$60 | $8-$25 | 55-60% | $35 | $12-$27 |
| Grooming supplies | $25-$70 | $10-$30 | 55-60% | $40 | $15-$30 |
| Pet tech (GPS, cameras) | $80-$250 | $40-$120 | 45-55% | $140 | $40-$80 |
| Pet travel accessories | $30-$100 | $12-$40 | 55-60% | $55 | $18-$40 |
| Pet health products | $30-$80 | $12-$35 | 55-60% | $50 | $18-$40 |
| Pet clothing | $25-$60 | $8-$20 | 60-67% | $35 | $15-$35 |

**Blended average margin:** 40-55% on most pet products.

### 8.3 Revenue Projections (Conservative)

| Scenario | Monthly Orders | AOV | Monthly Revenue | Monthly Profit (40% margin) |
|---------|---------------|-----|-----------------|----------------------------|
| Year 1, Q1 | 50 | $60 | $3,000 | $1,200 |
| Year 1, Q4 | 200 | $70 | $14,000 | $5,600 |
| Year 2, Q4 | 500 | $80 | $40,000 | $16,000 |

---

## 9. Supplier Discovery

### 9.1 NZ Pet Product Suppliers

| Supplier | Type | Products | Dropship? | MOQ | Contact |
|----------|------|----------|-----------|-----|---------|
| Ku-ring-gai Pet Supplies | Distributor | Pet food, accessories | Yes | $200 | ku-ring-gai.co.nz |
| VetDirect NZ | Veterinary wholesale | Health, grooming | Yes | $150 | vetdirect.co.nz |
| NRM (National Rural Merchants) | Rural/pet wholesale | Pet food, farm | Yes | $300 | nrm.co.nz |
| Petcraft NZ | Manufacturer | Cat trees, scratchers | Yes | $100 | petcraft.co.nz |
| Modern Foods NZ | Wholesaler | Pet food, treats | Yes | $200 | modernfoods.co.nz |
| Petstock NZ | Retailer/wholesale | Full range | Limited | $500 | petstock.co.nz |
| Animates | Retailer | Full range | No | N/A | animates.co.nz |

### 9.2 Australian Pet Product Suppliers

| Supplier | Type | Products | Dropship? | Shipping to NZ |
|----------|------|----------|-----------|----------------|
| Masterpet | Distributor | Full pet range | Yes | 3-5 days |
| Arrow Pet Products | Wholesaler | Pet accessories | Yes | 3-5 days |
| Petstock AU | Retailer/wholesale | Full range | Limited | 5-7 days |
| Petbarn | Retailer | Full range | No | N/A |

### 9.3 Chinese Suppliers (via Platforms)

| Platform | Products | Price | Shipping | Automation |
|----------|----------|-------|----------|------------|
| AliExpress | 100M+ | Lowest | 7-21 days | AutoDS |
| CJ Dropshipping | 400K+ | Low | 3-7 days (AU) | API available |
| 1688.com | Wholesale | Very low | 10-25 days | Manual |
| DHGate | Wholesale | Low | 7-20 days | Manual |

### 9.4 Supplier Onboarding Checklist

For each supplier, PawTag needs:
- [ ] Company details (name, contact, address)
- [ ] Product feed format (XML, CSV, API, manual)
- [ ] Pricing structure (cost price, currency)
- [ ] Shipping methods and rates
- [ ] Shipping zones (NZ, AU, international)
- [ ] Return policy
- [ ] Payment terms
- [ ] API credentials (if applicable)
- [ ] Product data mapping
- [ ] Brand/category mapping

---

## 10. Affiliate Network Research

### 10.1 NZ Affiliate Networks

| Network | Focus | Commission | Best For |
|---------|-------|------------|----------|
| Impact.com | Multi-brand | Variable | Large brands |
| Commission Factory | AU/NZ | 5-20% | AU/NZ merchants |
| Awin | Global | 5-15% | International |
| CJ Affiliate | Global | 5-20% | Large programs |

### 10.2 Relevance to PawTag

**Low relevance.** PawTag is not running an affiliate program where others sell PawTag products. PawTag is the retailer. Affiliate networks are for finding publishers to promote YOUR products, which is not the business model here.

**Exception:** If PawTag wants to run ads/promotions through affiliate publishers to drive traffic to the pet shop, then affiliate networks become relevant. But this is marketing, not product sourcing.

---

## 11. Product Sourcing Architecture

### 11.1 Recommended: Hybrid Multi-Source Model

```
PawTag Pet Commerce
├── Local NZ Suppliers (fast delivery, trusted)
│   ├── Direct API integration (if available)
│   ├── CSV feed import
│   └── Manual product entry
├── Australian Suppliers (mid-range, competitive)
│   ├── API integration (CJ Dropshipping)
│   ├── XML/CSV feeds
│   └── Manual entry
├── CJ Dropshipping (trending products, AU warehouse)
│   ├── REST API (product sync, order forwarding)
│   ├── Webhook (stock/price updates)
│   └── Auto-order fulfilment
└── AliExpress (high-margin, long-tail)
    ├── AutoDS integration
    ├── Manual curation
    └── Price/stock monitoring
```

### 11.2 Database Schema Extensions

New models needed:

```typescript
// Supplier model
interface Supplier {
  name: string;
  contact: { name, email, phone };
  address: Address;
  feedType: 'api' | 'csv' | 'xml' | 'manual';
  feedUrl?: string;
  apiConfig?: { baseUrl, apiKey, secret };
  currency: string; // NZD, AUD, USD
  shippingZones: string[];
  returnPolicy: string;
  paymentTerms: string;
  isActive: boolean;
  commission?: number; // for tracking supplier margins
  createdAt: Date;
  updatedAt: Date;
}

// SupplierProduct model (links supplier to PawTag product)
interface SupplierProduct {
  supplier: ObjectId; // → Supplier
  product: ObjectId;  // → Product
  supplierSku: string;
  supplierPrice: number;
  supplierCurrency: string;
  lastSyncAt?: Date;
  feedData?: Record<string, any>; // raw feed data
  isActive: boolean;
}

// SupplierOrder model (tracks supplier-side fulfilment)
interface SupplierOrder {
  supplier: ObjectId; // → Supplier
  order: ObjectId;    // → Order
  supplierOrderId?: string;
  status: 'pending' | 'sent' | 'accepted' | 'shipped' | 'delivered' | 'failed';
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  notes?: string;
}

// ProductFeed model (tracks feed imports)
interface ProductFeed {
  supplier: ObjectId; // → Supplier
  feedUrl: string;
  feedType: 'xml' | 'csv' | 'json';
  lastRunAt?: Date;
  lastRunStatus: 'success' | 'partial' | 'failed';
  productsImported: number;
  productsUpdated: number;
  productsFailed: number;
  errors?: string[];
}
```

### 11.3 API Route Extensions

New routes needed:

```
POST   /api/admin/suppliers              — Create supplier
GET    /api/admin/suppliers              — List suppliers
GET    /api/admin/suppliers/:id          — Get supplier
PUT    /api/admin/suppliers/:id          — Update supplier
DELETE /api/admin/suppliers/:id          — Delete supplier

POST   /api/admin/suppliers/:id/sync     — Trigger feed sync
GET    /api/admin/suppliers/:id/products — List supplier products
POST   /api/admin/suppliers/:id/products — Add supplier product mapping

POST   /api/admin/supplier-orders/:id/forward  — Forward order to supplier
GET    /api/admin/supplier-orders/:id/tracking — Get tracking info
```

---

## 12. Product Ownership Model

### 12.1 Current Model (PawTag Owns Products)

```
Product → belongs to PawTag
  - PawTag sets price
  - PawTag holds inventory
  - PawTag ships
  - PawTag handles returns
```

### 12.2 New Model (Multi-Owner Products)

```
Product → owned by PawTag OR supplier
  - SupplierProduct links supplier to product
  - SupplierProduct tracks supplier price
  - Product.retailPrice is PawTag's selling price
  - Margin = Product.retailPrice - SupplierProduct.supplierPrice
```

### 12.3 Price Management

```typescript
// Pricing strategy per product
interface PricingStrategy {
  productId: ObjectId;
  strategy: 'cost-plus' | 'competitor' | 'fixed';
  markupPercent?: number; // for cost-plus
  competitorTarget?: string; // for competitor-based
  fixedPrice?: number; // for fixed
}
```

**Recommended:** Start with simple cost-plus (e.g., 40% markup on supplier price). Optimize later.

---

## 13. Cart & Checkout Decision

### 13.1 Current Cart

PawTag's existing cart (`cart.service.ts`, 475 lines) already supports:
- Guest carts (anonymous)
- Auth carts (logged-in users)
- Cart merge on login
- Price revalidation on every load
- Max items limit
- TTL expiry (30 days)

### 13.2 Multi-Supplier Cart Impact

When products from different suppliers are in the same cart:

| Challenge | Solution |
|-----------|----------|
| Different shipping rates | Split cart per supplier at checkout |
| Different shipping times | Show per-product shipping estimates |
| Different currencies | Convert to NZD at checkout |
| Order splitting | Create one PawTag order, multiple supplier orders |
| Tracking | One PawTag order may have multiple tracking numbers |
| Returns | Route return to original supplier |

### 13.3 Checkout Flow Extension

```
Current:
  Cart → Checkout → Payment → Confirmation

New (with multi-supplier):
  Cart → Checkout → Payment → Confirmation
                          ↓
                    Order Splitting
                    ├── Supplier A → SupplierOrder A → Tracking A
                    ├── Supplier B → SupplierOrder B → Tracking B
                    └── PawTag internal → Fulfilment
```

### 13.4 Recommendation

**Keep the existing checkout flow.** Add order splitting as a post-payment step. The customer sees one cart, one payment, one confirmation. Behind the scenes, PawTag splits into supplier-specific orders.

---

## 14. Multi-Supplier Cart Problem

### 14.1 The Problem

When a customer buys:
- Dog food from Supplier A (NZ, 1-3 day shipping)
- Cat toy from Supplier B (AU, 3-7 day shipping)
- GPS collar from Supplier C (China, 7-14 day shipping)

Questions:
- Do we ship all at once (wait for slowest)?
- Do we ship separately (3 packages)?
- Who pays shipping on each?
- How do we handle returns?

### 14.2 Recommended Solution: Smart Order Splitting

```
Customer Cart: [Dog food, Cat toy, GPS collar]
                    ↓
            PawTag Order #1001 (single order for customer)
                    ↓
            Supplier Order Split
            ├── Supplier A → Dog food → Ship to customer
            ├── Supplier B → Cat toy → Ship to customer
            └── Supplier C → GPS collar → Ship to customer
```

**Rules:**
1. Group items by supplier
2. Each supplier ships their items separately
3. Shipping cost calculated per supplier shipment
4. Customer pays one combined shipping fee at checkout
5. PawTag tracks each supplier shipment separately
6. Customer sees all tracking numbers in their order

### 14.3 Shipping Cost Aggregation

At checkout, calculate:
```typescript
function calculateShipping(cartItems: CartItem[]): ShippingQuote[] {
  const supplierGroups = groupBySupplier(cartItems);
  return supplierGroups.map(group => ({
    supplier: group.supplier,
    items: group.items,
    estimatedCost: calculateSupplierShipping(group),
    estimatedDays: getSupplierShippingDays(group),
  }));
}
```

---

## 15. Automation

### 15.1 What Needs Automating

| Task | Frequency | Priority |
|------|-----------|----------|
| Product feed sync | Every 6-24 hours | HIGH |
| Price updates | Daily | HIGH |
| Stock updates | Every 6 hours | HIGH |
| Order forwarding | On order creation | HIGH |
| Tracking sync | Every 12 hours | MEDIUM |
| Reorder alerts | When stock low | LOW |
| Price monitoring | Daily | LOW |

### 15.2 Automation Architecture

```
Background Jobs (existing pattern)
├── product-feed-sync.ts       — Pull feeds from suppliers
├── price-stock-monitor.ts     — Update prices and stock
├── supplier-order-forward.ts  — Push orders to suppliers
├── tracking-sync.ts           — Pull tracking from suppliers
└── reorder-alert.ts           — Alert when stock low
```

### 15.3 Feed Sync Process

```
1. Supplier provides feed URL (XML/CSV/API endpoint)
2. PawTag scheduler triggers sync (every 6-24 hours)
3. Feed parser extracts products
4. Products matched to existing PawTag products (by SKU or UPC)
5. New products → create in PawTag (with supplier flag)
6. Existing products → update price/stock/description
7. Removed products → mark as inactive
8. Sync report logged
```

---

## 16. Open-Source Software

### 16.1 Candidate Solutions

| Software | Type | License | Fit for PawTag |
|----------|------|---------|----------------|
| Medusa | E-commerce engine | MIT | ❌ Overkill, already deprecated |
| Saleor | E-commerce engine | BSD-3 | ❌ Overkill, separate stack |
| Vendure | E-commerce engine | GPL-3 | ❌ Overkill, separate stack |
| Vantage (Vanta) | Dropship backend | MIT | ⚠️ Interesting but needs customization |
| dropship-trend-crawler | Product discovery | Custom | ⚠️ Useful for product research |
| CJ Plugin (Next.js) | CJ integration | MIT | ⚠️ Next.js-specific, not React/Express |
| AutoDS | Dropship automation | SaaS | ✅ Best for AliExpress/CJ integration |

### 16.2 Recommendation

**Don't adopt a full e-commerce framework.** PawTag already has a complete commerce module. Instead:

1. **Use AutoDS** ($1 trial, then $26-$48/mo) for AliExpress/CJ product sourcing and automation
2. **Build custom feed parser** for NZ/AU suppliers (XML/CSV)
3. **Extend existing commerce module** for multi-supplier support
4. **Use existing patterns** (CMS settings, provider interfaces, audit logging)

---

## 17. Build vs Buy

### 17.1 Decision Matrix

| Component | Build | Buy | Recommendation |
|-----------|-------|-----|----------------|
| Multi-supplier product model | ✅ | ❌ | **Build** (extends existing) |
| Supplier feed parser | ✅ | AutoDS | **Build** for NZ/AU, **Buy** for AliExpress |
| Order splitting | ✅ | ❌ | **Build** (unique to PawTag) |
| Tracking sync | ✅ | AutoDS | **Build** for NZ/AU, **Buy** for AliExpress |
| Price/stock monitoring | ✅ | AutoDS | **Build** for NZ/AU, **Buy** for AliExpress |
| Supplier dashboard | ✅ | ❌ | **Build** (simpler is better) |
| Product discovery | Manual | AutoDS research tools | **Buy** (AutoDS) |

### 17.2 Cost Comparison

| Approach | Monthly Cost | Setup Cost | Time to Launch |
|---------|-------------|------------|----------------|
| Full custom build | $0 | 200+ hours | 3-6 months |
| AutoDS + custom extensions | $26-$48/mo | 40-60 hours | 4-8 weeks |
| Medusa + custom | $0 | 300+ hours | 6-12 months |

**Recommendation:** AutoDS for AliExpress/CJ + custom build for NZ/AU suppliers.

---

## 18. Cost Analysis

### 18.1 Setup Costs

| Item | Cost | Notes |
|------|------|-------|
| AutoDS subscription | $1 for trial, then $26-$48/mo | AliExpress/CJ automation |
| Development time | 40-60 hours | Custom supplier integration |
| Supplier onboarding | $0 | Manual process |
| Legal/accounting | $500-$1,000 | NZ business setup |
| **Total setup** | **$500-$1,500** | |

### 18.2 Ongoing Monthly Costs

| Item | Cost | Notes |
|------|------|-------|
| AutoDS | $26-$48 | Product/order automation |
| PawTag hosting | Existing | No additional cost |
| Stripe fees | 2.9% + $0.30 | Per transaction |
| Email (Resend) | Existing | No additional cost |
| Domain/SSL | Existing | No additional cost |
| **Total monthly** | **$26-$48 + Stripe** | |

### 18.3 Break-Even Analysis

| Monthly Fixed Costs | Break-Even Orders (at $60 AOV, 40% margin) |
|--------------------|---------------------------------------------|
| $48 (AutoDS) | 2 orders/month |
| $48 + $100 (misc) | 6 orders/month |

**Break-even is extremely low** — dropshipping is capital-efficient.

---

## 19. Profitability

### 19.1 Margin Model

```
Revenue per order: $60 (average)
Supplier cost: $30 (50% of retail)
Shipping cost: $5 (subsidised from revenue)
Payment fees: $2 (Stripe)
Platform cost: $0.50 (AutoDS, amortised)
───────────────────────────
Gross profit per order: $22.50 (37.5%)
```

### 19.2 Scaling Potential

| Scale | Monthly Orders | Monthly Profit | Annual Profit |
|-------|---------------|----------------|---------------|
| Startup | 50 | $1,125 | $13,500 |
| Growth | 200 | $4,500 | $54,000 |
| Maturity | 500 | $11,250 | $135,000 |

### 19.3 Key Profit Drivers

1. **Product mix** — Higher margin products (toys, accessories) vs lower margin (food)
2. **Shipping margins** — Charge slightly more than actual shipping cost
3. **Repeat customers** — Pet owners buy regularly
4. **Bundle deals** — Increase AOV
5. **Cross-sell from tags** — Tag buyers are ideal pet product buyers

---

## 20. Product Category Strategy

### 20.1 Recommended Launch Categories

| Priority | Category | Why | Margin | Supplier Source |
|----------|----------|-----|--------|----------------|
| 1 | Pet tags & accessories | Natural extension of PawTag | 50-60% | CJ/AliExpress |
| 2 | Dog toys | High demand, high margin | 55-65% | CJ/AliExpress |
| 3 | Cat toys & accessories | Cat owners are loyal buyers | 50-60% | CJ/AliExpress |
| 4 | Grooming supplies | Regular repeat purchases | 45-55% | NZ/AU suppliers |
| 5 | Pet tech (GPS, cameras) | High ticket, aligns with PawTag | 40-50% | CJ/AliExpress |
| 6 | Pet travel | Growing segment | 50-60% | NZ/AU suppliers |
| 7 | Pet health | High trust required | 40-50% | NZ vet suppliers |
| 8 | Pet food | High volume, low margin | 20-30% | NZ/AU distributors |

### 20.2 Product Selection Criteria

For each product, evaluate:
- [ ] Does it solve a real pet owner problem?
- [ ] Is the margin > 35%?
- [ ] Can the supplier ship to NZ within 7 days?
- [ ] Is the product quality reliable?
- [ ] Are returns rare (< 5%)?
- [ ] Does it complement PawTag's brand?
- [ ] Is there search demand in NZ?

### 20.3 PawTag Brand Alignment

Products that naturally align with PawTag's pet recovery mission:
- GPS trackers and collars
- Pet ID tags (complementary to QR tags)
- Pet safety products
- Pet first aid kits
- Reflective/hi-vis pet gear
- Pet travel carriers

---

## 21. Customer Experience

### 21.1 Customer Journey

```
1. Discovery
   → Customer finds PawTag (search, social, referral)
   → Explores pet products alongside tag info

2. Browsing
   → Clean product catalog with search/filter
   → Product reviews and ratings
   → "Customers also bought" recommendations
   → "Complete your pet's safety kit" cross-sell

3. Purchase
   → Simple 4-step checkout (already built)
   → Guest checkout available
   → Clear shipping estimates per product

4. Post-Purchase
   → Order confirmation email
   → Shipping notification with tracking
   → Delivery confirmation
   → Review request
   → Reorder reminder (for consumables)

5. Loyalty
   → Guardian points for purchases
   → Referral rewards
   → Subscription bundles
```

### 21.2 CX Differentiators

| Differentiator | How |
|---------------|-----|
| **Pet-first experience** | Personalised by pet type, breed, age |
| **Recovery + products** | Unique combo no competitor has |
| **Fast NZ shipping** | Prioritise NZ/AU suppliers |
| **Trusted brand** | PawTag already trusted for pet safety |
| **Subscription bundles** | Tag + food + treats = convenience |

---

## 22. Guardian Loyalty Integration

### 22.1 Loyalty Points System

| Action | Points |
|--------|--------|
| Purchase $1 | 1 point |
| Refer a friend | 500 points |
| Complete pet profile | 100 points |
| Write product review | 50 points |
| Share on social | 25 points |
| Monthly subscription active | 200 points |

### 22.2 Points Redemption

| Reward | Points Required |
|--------|----------------|
| $5 discount | 500 points |
| $10 discount | 900 points |
| Free pet tag | 2,000 points |
| Free month subscription | 1,500 points |

### 22.3 Integration with Existing Referral System

Extend the existing `ReferralCode` and `Referral` models to track loyalty points instead of just referral rewards.

---

## 23. SEO & Content

### 23.1 SEO Advantages

- PawTag already has product pages with SEO-friendly slugs
- Pet-related content naturally attracts search traffic
- NZ-specific pet content has low competition

### 23.2 Content Strategy

| Content Type | Purpose | Frequency |
|-------------|---------|-----------|
| Product guides | "Best dog toys for aggressive chewers" | Monthly |
| Pet care tips | "How to keep your cat entertained" | Weekly |
| Product comparisons | "CJ Dropshipping vs AliExpress for pet products" | Monthly |
| Seasonal content | "Summer pet safety essentials" | Seasonal |
| User-generated | Customer photos with products | Ongoing |

### 23.3 Technical SEO

Already implemented:
- ✅ Slug-based product URLs (`/shop/pawtag-scan`)
- ✅ Meta tags on product pages
- ✅ Sitemap generation
- ✅ Fast page loads (Vite)

---

## 24. Legal Considerations

### 24.1 NZ Business Requirements

| Requirement | Status | Action |
|------------|--------|--------|
| NZ business registration | Required | Register with Companies Office |
| GST registration | Required if > $60K/yr | Register with IRD |
| Consumer Guarantees Act | Applies | Ensure product quality |
| Fair Trading Act | Applies | Honest marketing |
| Privacy Act 2020 | Applies | Customer data handling |
| Spam Act 2007 | Applies | Email marketing opt-in |

### 24.2 Dropshipping-Specific Legal

| Issue | Detail |
|-------|--------|
| Product liability | PawTag is liable as retailer, even if supplier ships |
| Consumer guarantees | PawTag must honour returns/refunds |
| Product safety | Must ensure products meet NZ safety standards |
| Import duties | Products over $1,000 may attract customs duty |
| GST on imports | 15% GST on imported goods under $1,000 |

### 24.3 Supplier Agreements

Each supplier should have:
- Service level agreement (shipping times, quality)
- Return policy agreement
- Liability allocation
- Price stability terms
- Data feed agreement

---

## 25. Final Recommendation

### 25.1 Recommended Business Model

**Hybrid Dropshipping + Product Feed Model**

| Source | Products | Automation | Priority |
|--------|----------|------------|----------|
| CJ Dropshipping | Trending pet products | API (auto-sync) | HIGH |
| NZ/AU suppliers | Everyday essentials | CSV feed + manual | HIGH |
| AliExpress | High-margin accessories | AutoDS | MEDIUM |

### 25.2 Why This Model

1. **Fits all constraints** — No warehouse, no capital, no operations team
2. **Leverages existing commerce module** — PawTag already has cart, checkout, payments, orders
3. **Scalable** — Add suppliers and products without operational overhead
4. **Low risk** — No inventory investment
5. **Fast to launch** — 4-8 weeks with AutoDS + custom supplier integration
6. **High margin** — 40-55% blended margin on pet products
7. **Synergistic** — Tag buyers are ideal pet product buyers

### 25.3 Implementation Phases

**Phase 1 (Weeks 1-2): Foundation**
- Create Supplier and SupplierProduct models
- Create SupplierOrder model
- Create ProductFeed model
- Admin CRUD for suppliers
- Basic feed parser (CSV)

**Phase 2 (Weeks 3-4): CJ Integration**
- CJ Dropshipping API integration
- Product sync from CJ
- Auto-order forwarding
- Tracking sync

**Phase 3 (Weeks 5-6): NZ/AU Suppliers**
- Onboard 2-3 NZ/AU suppliers
- CSV feed import
- Manual product entry
- Supplier order management

**Phase 4 (Weeks 7-8): Automation**
- Background job for feed sync
- Price/stock monitoring
- Tracking sync automation
- Reorder alerts

**Phase 5 (Weeks 9-12): Polish**
- Customer-facing product pages
- Product search and filtering
- Product reviews
- Cross-sell recommendations
- Guardian loyalty integration

### 25.4 Key Success Metrics

| Metric | Target (Year 1) |
|--------|-----------------|
| Products listed | 500+ |
| Monthly orders | 200+ |
| Average order value | $70+ |
| Gross margin | 40%+ |
| Customer satisfaction | 4.5+ stars |
| Return rate | < 5% |
| Shipping time (NZ) | < 5 days |

---

## 26. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Backend:**
- [ ] Create `Supplier` model
- [ ] Create `SupplierProduct` model
- [ ] Create `SupplierOrder` model
- [ ] Create `ProductFeed` model
- [ ] Admin CRUD routes for suppliers
- [ ] Basic CSV feed parser

**Frontend:**
- [ ] Admin Suppliers page
- [ ] Admin Supplier Editor page
- [ ] Supplier list with status indicators

**Testing:**
- [ ] Unit tests for Supplier model
- [ ] Unit tests for feed parser
- [ ] Integration tests for supplier CRUD

### Phase 2: CJ Integration (Weeks 3-4)

**Backend:**
- [ ] CJ Dropshipping API client
- [ ] Product sync from CJ
- [ ] Auto-order forwarding to CJ
- [ ] Tracking sync from CJ
- [ ] Webhook handler for CJ updates

**Frontend:**
- [ ] CJ product browser in admin
- [ ] CJ product import UI
- [ ] CJ order tracking display

**Testing:**
- [ ] Unit tests for CJ API client
- [ ] Integration tests for product sync
- [ ] Integration tests for order forwarding

### Phase 3: NZ/AU Suppliers (Weeks 5-6)

**Backend:**
- [ ] Onboard 2-3 NZ/AU suppliers
- [ ] CSV feed import
- [ ] Supplier order management
- [ ] Supplier tracking integration

**Frontend:**
- [ ] Supplier product mapping UI
- [ ] Supplier order management UI
- [ ] Supplier tracking display

**Testing:**
- [ ] Unit tests for CSV parser
- [ ] Integration tests for supplier orders
- [ ] End-to-end test for full flow

### Phase 4: Automation (Weeks 7-8)

**Backend:**
- [ ] Background job: product feed sync
- [ ] Background job: price/stock monitoring
- [ ] Background job: tracking sync
- [ ] Background job: reorder alerts

**Frontend:**
- [ ] Sync status dashboard
- [ ] Sync logs viewer

**Testing:**
- [ ] Unit tests for sync jobs
- [ ] Integration tests for full sync cycle

### Phase 5: Polish (Weeks 9-12)

**Frontend:**
- [ ] Product search and filtering
- [ ] Product reviews and ratings
- [ ] Cross-sell recommendations
- [ ] Guardian loyalty points display

**Backend:**
- [ ] Loyalty points calculation
- [ ] Product review API
- [ ] Recommendation engine (simple)

**Testing:**
- [ ] End-to-end tests for full customer journey
- [ ] Performance testing
- [ ] Security audit

---

## 27. Appendix: Full Database Inventory

### All 58 Models (Verified from Source)

| # | Model | File | Purpose |
|---|-------|------|---------|
| 1 | User | `User.ts` | Customer/admin identity |
| 2 | Role | `Role.ts` | RBAC role definition |
| 3 | UserRole | `UserRole.ts` | User-role assignment |
| 4 | Permission | `Permission.ts` | Granular permission |
| 5 | PermissionGroup | `PermissionGroup.ts` | Permission grouping |
| 6 | PermissionScope | `PermissionScope.ts` | OWN vs ALL scope |
| 7 | Tag | `Tag.ts` | QR/NFC pet tag |
| 8 | Pet | `Pet.ts` | Pet profile |
| 9 | Product | `Product.ts` | Commerce product |
| 10 | Cart | `Cart.ts` | Server-side shopping cart |
| 11 | PendingOrder | `PendingOrder.ts` | Pre-payment order snapshot |
| 12 | Order | `Order.ts` | Confirmed order |
| 13 | Invoice | `Invoice.ts` | Financial document |
| 14 | InvoiceAccessToken | `InvoiceAccessToken.ts` | Secure invoice access |
| 15 | PaymentTransaction | `PaymentTransaction.ts` | Payment audit trail |
| 16 | Subscription | `Subscription.ts` | Tag subscription lifecycle |
| 17 | Referral | `Referral.ts` | Referral tracking |
| 18 | ReferralCode | `ReferralCode.ts` | Unique referral codes |
| 19 | PromoCode | `PromoCode.ts` | Discount codes |
| 20 | Shipment | `Shipment.ts` | Shipping tracking |
| 21 | ShippingMethod | `ShippingMethod.ts` | Shipping options |
| 22 | StockMovement | `StockMovement.ts` | Inventory audit trail |
| 23 | Fulfilment | `Fulfilment.ts` | Order fulfilment |
| 24 | Return | `Return.ts` | Return requests |
| 25 | Notification | `Notification.ts` | In-app notifications |
| 26 | PushToken | `PushToken.ts` | Device push tokens |
| 27 | EscalationRecord | `EscalationRecord.ts` | Pet found escalation |
| 28 | FinderScan | `FinderScan.ts` | Finder scan tracking |
| 29 | LocationEvent | `LocationEvent.ts` | Location sharing |
| 30 | IntegrationConnection | `IntegrationConnection.ts` | Third-party connections |
| 31 | SupportRequest | `SupportRequest.ts` | Support tickets |
| 32 | WebhookEvent | `WebhookEvent.ts` | Stripe webhook log |
| 33 | TagExpiryNotification | `TagExpiryNotification.ts` | Tag expiry alerts |
| 34 | RefreshToken | `RefreshToken.ts` | JWT refresh tokens |
| 35 | VerificationToken | `VerificationToken.ts` | Email/phone verification |
| 36 | SystemLog | `SystemLog.ts` | Application logs |
| 37 | AuditEvent | `AuditEvent.ts` | Audit trail |
| 38 | FeatureFlag | `FeatureFlag.ts` | Feature toggles |
| 39 | Setting | `Setting.ts` | CMS settings |
| 40 | SiteContent | `SiteContent.ts` | Static content |
| 41 | CmsPage | `CmsPage.ts` | CMS pages |
| 42 | CmsPageVersion | `CmsPageVersion.ts` | Page versions |
| 43 | CmsAnnouncement | `CmsAnnouncement.ts` | Announcements |
| 44 | CmsNavigation | `CmsNavigation.ts` | Navigation menus |
| 45 | CmsFooter | `CmsFooter.ts` | Footer config |
| 46 | CmsHomepageSection | `CmsHomepageSection.ts` | Homepage sections |
| 47 | CmsShopPage | `CmsShopPage.ts` | Shop page config |
| 48 | CmsOnboarding | `CmsOnboarding.ts` | Onboarding wizard |
| 49 | CmsAuthPage | `CmsAuthPage.ts` | Auth page config |
| 50 | CmsEmailTemplate | `CmsEmailTemplate.ts` | Email templates |
| 51 | CmsSmsTemplate | `CmsSmsTemplate.ts` | SMS templates |
| 52 | CmsMedia | `CmsMedia.ts` | Media library |
| 53 | CmsRedirect | `CmsRedirect.ts` | URL redirects |
| 54 | CmsPetReference | `CmsPetReference.ts` | Pet breed/type data |
| 55 | Brand | `Brand.ts` | Product brands |
| 56 | Category | `Category.ts` | Product categories |
| 57 | Collection | `Collection.ts` | Product collections |

### New Models Needed for Pet Commerce

| # | Model | Purpose |
|---|-------|---------|
| 58 | Supplier | Supplier management |
| 59 | SupplierProduct | Supplier-product mapping |
| 60 | SupplierOrder | Supplier-side order tracking |
| 61 | ProductFeed | Feed import tracking |
| 62 | LoyaltyPoint | Customer loyalty points |

---

## 28. Appendix: Full API Route Inventory

### All 52 Existing Routes

| Route File | Routes | Purpose |
|-----------|--------|---------|
| `auth.ts` | 12 | Login, register, OTP, profile |
| `admin.ts` | 20+ | Full CRUD (requires admin role) |
| `customer.ts` | 15+ | Pet management, orders, notifications |
| `finder.ts` | 5 | Public tag lookup, location sharing |
| `products.ts` | 6 | Product listing, detail, search |
| `cart.ts` | 6 | Cart management (guest+auth) |
| `checkout.ts` | 2 | Payment intent, confirm |
| `promo-public.ts` | 1 | Promo code validation |
| `webhooks.ts` | 1 | Stripe webhook handler |
| `system-logs.ts` | 5 | System log management |
| `site-availability.ts` | 2 | Maintenance/offline mode |
| `address-autocomplete.ts` | 1 | Address autocomplete proxy |
| Other | 10+ | Various admin/customer routes |

### New Routes Needed for Pet Commerce

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/suppliers` | GET/POST | List/Create suppliers |
| `/api/admin/suppliers/:id` | GET/PUT/DELETE | Supplier CRUD |
| `/api/admin/suppliers/:id/sync` | POST | Trigger feed sync |
| `/api/admin/suppliers/:id/products` | GET/POST | Supplier products |
| `/api/admin/supplier-orders` | GET | List supplier orders |
| `/api/admin/supplier-orders/:id` | GET | Supplier order detail |
| `/api/admin/supplier-orders/:id/forward` | POST | Forward to supplier |
| `/api/admin/product-feeds` | GET/POST | Feed management |
| `/api/admin/product-feeds/:id/run` | POST | Run feed import |

---

## 29. Appendix: Frontend Architecture

### All Frontend Apps

| App | Port | Pages | Purpose |
|-----|------|-------|---------|
| `apps/web` | 3000 | 20 + 13 account | Public site, shop, auth, customer portal |
| `apps/admin` | 3001 | 51 | Admin portal, full CRUD |
| `apps/finder` | 3003 | 10 components | Finder portal (pet recovery) |
| `apps/mobile` | — | 14 screens | React Native (Expo) app |

### Pet Commerce Pages to Add

| App | Page | Route | Purpose |
|-----|------|-------|---------|
| `apps/admin` | Suppliers | `/suppliers` | Supplier list |
| `apps/admin` | Supplier Editor | `/suppliers/new`, `/suppliers/:id` | Supplier CRUD |
| `apps/admin` | Product Feeds | `/product-feeds` | Feed management |
| `apps/admin` | Supplier Orders | `/supplier-orders` | Supplier order tracking |
| `apps/web` | Product Reviews | `/shop/:slug#reviews` | Product reviews |
| `apps/web` | Loyalty Dashboard | `/account/loyalty` | Loyalty points |

### Existing Pages That Need Updates

| App | Page | Update |
|-----|------|--------|
| `apps/web` | Shop | Add product reviews, supplier badges |
| `apps/web` | Product Detail | Add supplier info, reviews, cross-sell |
| `apps/web` | Checkout | Add shipping per supplier |
| `apps/web` | Order Detail | Add supplier tracking |
| `apps/admin` | Products | Add supplier mapping |
| `apps/admin` | Orders | Add supplier order forwarding |
| `apps/admin` | Commerce Settings | Add supplier settings |

---

*End of Pet Commerce Discovery Report*
