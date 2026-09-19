# UX Vocabulary Consistency

> Centralized vocabulary reference for terms that risk drifting.
> The same state should not have different customer-facing names across web, Finder, mobile and email.
>
> Last updated: 2026-09-19

## Purpose

PawTag uses terminology that may drift across different parts of the application. This document defines the authoritative vocabulary for customer-facing text.

---

## 1. Pet Status Terms

| Internal State | Customer-Facing Name |
|---|---|
| `normal` | Active |
| `lost` | Lost |
| `found` | Found |
| `safe` | Safe |

### Rules

- Use "Lost" — not "Missing", "Stolen", or "Gone"
- Use "Found" — not "Spotted", "Seen", or "Located"
- Use "Recovered" or "Safe" — not "Returned", "Found", or "Home"
- Use "Active" — not "Normal", "Default", or "Online"

---

## 2. Finder Terms

| Term | Usage |
|---|---|
| Finder | Person who found/scanned the pet's tag |
| Finder report | Information submitted by a finder |
| Finder scan | QR/NFC scan of the pet tag |
| Finder notification | Message sent to pet owner |

### Rules

- Use "Finder" — not "Helper", "Rescuer", or "Good Samaritan"
- Use "Finder report" — not "Sighting", "Report", or "Tip"
- Use "Finder scan" — not "Tag scan", "QR scan", or "NFC scan"

---

## 3. Tag Terms

| Term | Usage |
|---|---|
| Tag | The physical PawTag product |
| Tag activation | Linking a tag to a pet |
| Tag redemption | Claiming a purchased tag |
| Tag status | Current state of the tag |

### Rules

- Use "Tag" — not "Badge", "Device", or "Tracker"
- Use "Activate your tag" — not "Register your tag" or "Set up your tag"
- Use "Redeem your tag" — not "Activate your tag" (for purchased tags)

---

## 4. Guardian/Gold Terms

| Term | Usage |
|---|---|
| Guardian | Base membership tier |
| Guardian Gold | Premium membership tier |
| Membership | Subscription to Guardian/Gold |

### Rules

- Use "Guardian" — not "Membership", "Plan", or "Subscription"
- Use "Guardian Gold" — not "Gold Membership", "Gold Plan", or "Premium"
- Use "Join Guardian" — not "Subscribe", "Sign up for membership", or "Upgrade"

---

## 5. PawRewards Terms

| Term | Usage |
|---|---|
| PawRewards | Loyalty points system |
| Points | Currency earned through PawRewards |
| Redeem | Using points for rewards |

### Rules

- Use "PawRewards" — not "Rewards", "Loyalty", or "Points program"
- Use "Points" — not "Credits", "Tokens", or "Coins"
- Use "Redeem points" — not "Cash in", "Exchange", or "Use points"

---

## 6. Order States

| Internal State | Customer-Facing Name |
|---|---|
| `pending_payment` | Awaiting Payment |
| `paid` | Confirmed |
| `processing` | Processing |
| `shipped` | Shipped |
| `delivered` | Delivered |
| `cancelled` | Cancelled |
| `refunded` | Refunded |

### Rules

- Use "Confirmed" — not "Paid", "Complete", or "Successful"
- Use "Processing" — not "Preparing", "Building", or "Fulfilling"
- Use "Cancelled" — not "Canceled", "Aborted", or "Stopped"

---

## 7. Subscription States

| Internal State | Customer-Facing Name |
|---|---|
| `active` | Active |
| `cancelled` | Cancelled |
| `expired` | Expired |
| `grace_period` | Grace Period |

### Rules

- Use "Active" — not "Running", "Live", or "Current"
- Use "Cancelled" — not "Ended", "Stopped", or "Terminated"
- Use "Grace Period" — not "Warning Period" or "Pending Expiry"

---

## 8. Refund States

| Internal State | Customer-Facing Name |
|---|---|
| `pending` | Refund Pending |
| `processing` | Processing Refund |
| `succeeded` | Refund Complete |
| `failed` | Refund Failed |

### Rules

- Use "Refund Pending" — not "Pending Refund" or "Refund Processing"
- Use "Refund Complete" — not "Refunded" or "Refund Successful"
- Use "Refund Failed" — not "Refund Error" or "Refund Rejected"

---

## Quick Reference

| Category | Use | Don't Use |
|---|---|---|
| Pet status | Lost, Found, Safe, Active | Missing, Spotted, Returned, Normal |
| Finder | Finder, Finder report | Helper, Rescuer, Sighting |
| Tag | Tag, Activate, Redeem | Device, Tracker, Register |
| Membership | Guardian, Guardian Gold | Membership, Plan, Subscription |
| Loyalty | PawRewards, Points | Rewards, Credits, Tokens |
| Order | Confirmed, Processing, Shipped | Paid, Preparing, Fulfilling |
| Subscription | Active, Cancelled, Grace Period | Running, Ended, Warning Period |
| Refund | Refund Pending, Refund Complete | Pending Refund, Refunded |

---

## Related Documents

- `docs/FEEDBACK-PATTERNS.md` — Common feedback patterns
- `docs/DESIGN.md` — Design system
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
