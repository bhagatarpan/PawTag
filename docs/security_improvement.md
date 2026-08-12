# Security Audit & Improvement Plan — PawTag

**Date:** 2026-08-12

## Audit Summary

| # | Security Hole | Status | Severity |
|---|---|---|---|
| 01 | Token in localStorage | VULNERABLE | High |
| 02 | Client-side admin check | SECURE | Low |
| 03 | No email verification / 2FA | SECURE | Low |
| 04 | No rate limiting | SECURE | Low |
| 05 | No password rules | PARTIAL | Medium |

---

## 01/05 — Session Token in Local Storage

**Status: VULNERABLE**

| What exists | Where |
|---|---|
| Token stored in localStorage (`pawtag_token`, `admin_token`) | `apps/web/src/context/AuthContext.tsx:54`, `apps/admin/src/lib/auth.tsx:57` |
| Token sent as `Authorization: Bearer` header | `apps/web/src/lib/api.ts:10`, `apps/admin/src/lib/api.ts:14` |
| Token removed on 401 or logout | `apps/web/src/lib/api.ts:18`, `AuthContext.tsx:61` |
| Server returns token in JSON body, NOT Set-Cookie | `packages/api/src/routes/auth.ts:557-571` |

**Risk:** Any XSS vulnerability exposes the token. An injected script can read `localStorage` and hijack sessions.

**What's already done:**
- Mobile app uses `expo-secure-store` (device Keychain) — secure
- CSP headers on API server via `helmet` — partially mitigates XSS
- CORS origin allowlisting — blocks cross-origin requests

**Improvement needed:**
1. Migrate web/admin tokens to `httpOnly`, `Secure`, `SameSite=Lax` cookies
2. Add `cookie-parser` middleware to the API
3. Return tokens via `Set-Cookie` header instead of JSON body
4. Add DOMPurify to sanitize the 6 `dangerouslySetInnerHTML` usages (CMS content, invoices)
5. Add CSP headers to the Vite frontend builds (currently only on the API server)

---

## 02/05 — Admin Check Happens Client-Side

**Status: SECURE**

| What exists | Where |
|---|---|
| `authenticate` middleware validates JWT on every protected route | `packages/api/src/middleware/auth.ts:16` |
| `requirePermission('resource.action')` checks RBAC permissions server-side | `packages/api/src/middleware/permission.ts` |
| `requireRole()` checks roles server-side | `packages/api/src/middleware/auth.ts:98-113` |
| Client-side role check exists but is ONLY for UI hiding | `apps/admin/src/lib/auth.tsx:25-27` |

**What can be improved:**
- The `requireVerifiedAccount` middleware exists (`middleware/verificationGuard.ts`) but is dead code — consider applying it as defense-in-depth
- Account lockout values (`MAX_ATTEMPTS = 5`, `LOCKOUT_MINUTES = 30`) are hardcoded — could be DB-driven
- The global auth limiter reuses `rateLimit.auth.login.max` setting key with a different default — consider its own setting key

---

## 03/05 — No Two-Factor Authentication or Email Verification

**Status: WELL IMPLEMENTED**

| What exists | Where |
|---|---|
| Email verification required on registration | `auth.ts:186` — `status: 'pending_verification'` |
| Phone verification also required | `auth.ts:146-154` — dual verification model |
| Login blocked for unverified users (403) | `auth.ts:432-458` — returns `REQUIRES_VERIFICATION` |
| Account activates only when BOTH verified | `auth.ts:146-154` — `checkAndActivateUser()` |
| MFA (email/phone OTP) implemented | `auth.ts` — OTP generation/verification |
| MFA configurable per role | CMS settings `mfa.adminEnabled`, `mfa.customerEnabled` |
| JWT verification token expires in 10 min | `auth.ts:211` |

**What can be improved:**
- MFA is email OTP only — no TOTP (authenticator app) or hardware key support
- Customers can opt out of MFA via `PUT /customer/settings/mfa` — consider making it mandatory for certain actions

---

## 04/05 — No Rate Limiting on Login / Reset

**Status: WELL IMPLEMENTED**

| Endpoint | Limiter | Limit | Window |
|---|---|---|---|
| `POST /login` | `loginLimiter` | 5 attempts | 15 min |
| `POST /register` | `registerLimiter` | 3 attempts | 1 hour |
| `POST /forgot-password` | `forgotPasswordLimiter` | 3 attempts | 1 hour |
| `POST /mfa/send-otp` | `mfaSendLimiter` | 1 attempt | 30 sec |
| `POST /mfa/verify` | `mfaVerifyLimiter` | 5 attempts | 15 min |

All limits are DB-configurable via admin portal.

**What can be improved:**
- Rate limiters are per-process in-memory — in multi-instance deployment, limits are multiplied by instance count. Consider Redis-backed rate limiting for production
- `POST /resend-email-verification` and `POST /send-phone-otp` have no IP-based rate limiter
- `POST /verify-phone` has no IP-based rate limiter
- All rate limiters skip in dev/test — ensure `NODE_ENV=production` in deployed environments

---

## 05/05 — No Password Rules or Leaked-Password Check

**Status: PARTIALLY SECURE**

| What exists | Where |
|---|---|
| Regex: lowercase + uppercase + digit + special char | `schemas.ts:3` |
| Minimum 8 characters | `schemas.ts:3` |
| Confirmation match required | `schemas.ts:13-15` |
| Bcrypt hashing (12 salt rounds) | `auth.service.ts:14` |
| Strength meter in registration UI | `apps/web/src/pages/Register.tsx` |

**What's missing:**
- No minimum 12 characters — industry best practice is 12+
- No HaveIBeenPwned / breached password check
- No password reuse prevention
- No maximum length limit — bcrypt truncates at 72 bytes internally

---

## Recommended Priority Order

### Priority 1 (High Impact)
1. Migrate tokens from localStorage to httpOnly cookies
2. Add DOMPurify sanitization to `dangerouslySetInnerHTML` usages

### Priority 2 (Medium Impact)
3. Add HIBP (HaveIBeenPwned) integration
4. Increase minimum password length to 12

### Priority 3 (Nice to Have)
5. Add CSP headers to Vite frontend builds
6. Add IP rate limiting to resend-email-verification, send-phone-otp, and verify-phone endpoints
7. Clean up dead code (unused `requireVerifiedAccount` middleware)

---

## Notes

- PawTag's rate limiting and MFA implementations are DB-configurable, which is excellent for operational control
- Mobile token storage (expo-secure-store) is already secure
- Server-side RBAC enforcement means the client-side admin check is purely cosmetic (not a security issue)
- The dual verification (email + phone) on registration exceeds typical requirements
