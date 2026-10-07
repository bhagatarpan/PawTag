# DynamoDB Migration — Founder Summary (Phase 11)

**Date:** 2026-10-06  
**Your choice:** Option A — website first on MongoDB; DynamoDB discovery now; cut over after staging.

## What we found

PawTag stores data in **MongoDB** today (~73 types of records: users, pets, tags, orders, payments, website content, background jobs, etc.).

The app already cares a lot about:

- **Unique things** (email, tag code, order number, invoice number, Stripe IDs)  
- **“Only if still true” updates** (stock, reward points, promo codes) so two customers cannot buy the last item twice  

DynamoDB can handle that — but only if we design tables around **how the app uses data**, not by copying every old collection one-for-one.

## What we will move, and when

| Order | What | Risk |
|---|---|---|
| 1st | Website settings and CMS content | Low |
| 2nd | Catalog / shipping options | Low–medium |
| 3rd | Email logs, system logs | Medium (volume) |
| 4th | Login / accounts | High |
| 5th | Pets, tags, Finder recovery | High |
| 6th | Cart, orders, payments | **Very high — last** |
| 7th | Memberships, rewards | **Very high** |
| Last | Background jobs, webhooks | High |

**MongoDB remains the real database for first customers** until later waves are proven in staging.

## What Phase 11 produced

Full design pack under `docs/dynamodb-migration/`:

- Inventory of all data  
- How the app uses each piece  
- Groups and draft DynamoDB keys  
- Where “all or nothing” matters  
- Safe migration order  
- Risks and rollback  
- AWS region **ap-southeast-2** + DynamoDB Local plan  

## What you still need (for Phase 12, not today)

In AWS Console when we start writing DynamoDB:

1. IAM user + access keys (non-prod)  
2. Confirm region **ap-southeast-2**  
3. DynamoDB Local on your computer for tests (Docker)  

**Phase 11 itself does not need AWS keys.**

## What this does **not** mean

- First customer is **not** waiting on DynamoDB  
- Phone app / App Store is **not** required for first web customer  
- We will **not** move payments until staging proves it  

## Next steps

| Step | Owner |
|---|---|
| Phase 11 complete (this pack) | Done |
| Staging web test customer (MongoDB) | Engineer + you (Stripe test / Resend test keys) |
| Phase 12 DynamoDB low-risk domains | After staging checklist ready + IAM keys |
| Phase 13 money/identity/Finder | After staging payments proven |
| Phase 10 phone store | Only when you want app store release |

---

**Status:** Phase 11 discovery complete.  
**Next:** Phase 12 only after founder authorizes + AWS non-prod ready.  
**Do not start Phase 12 automatically.**
