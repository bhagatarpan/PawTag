# Phase 05 — Finder Web Recovery Evidence

**Executed:** 2026-10-06  
**Product rule (founder):** Finder can only find **ACTIVE** tags. Free customers get finder email for the 3-month Active Period.

## Journey evidence

| Step | Evidence |
|---|---|
| Scan → browser opens | `apps/finder` public React app; no account/install |
| Only active tags show pet info | **PROVEN (automated)** — `finder.test.ts`, `finder-full.test.ts` |
| Invalid/expired/replaced/returned | **PROVEN (automated)** — `tagActive: false`, no pet info |
| Notify owner | **PROVEN (automated)** — email to any customer on active tag; in-app for free during Active Period |
| CAPTCHA production contract | **CODED_NOT_RUNTIME_VALIDATED** — frontend loads challenge + backend `requireCaptcha`; production-like notify not live-run |
| Duplicate notify | **PROVEN (automated)** — 5-minute idempotency window |
| Location consent | Server-stamped consent metadata in finder route (coded) |
| Privacy retention | `privacyRetention` job anonymizes finder contact/GPS/IP/device |
| Public DTO | Active path uses `toFinderPetView`; non-active path null petInfo |
| Universal links exclude Finder | Documented target: customer app must not hijack Finder URLs (Phase 09) |

## Automated commands

| Command | Result |
|---|---|
| Finder integration suites | **PASS** (see session logs) |
| Free-customer finder email | **PASS** (Phase 01 regression) |

## Remaining risks

- Live CAPTCHA production notify not proven
- Physical QR scan on device Phase 10
- Real courier/Resend paths Phase 01/03 external validation
