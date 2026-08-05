# PawTag — Authentication & Authorization Flows

> **Version:** 2.0 (includes MFA)
> **Last Updated:** August 2026
> **Purpose:** Complete reference for every auth flow in the PawTag platform. Use this as a implementation guide when building similar systems.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Security Layers](#2-security-layers)
3. [Registration Flow](#3-registration-flow)
4. [Email Verification Flow](#4-email-verification-flow)
5. [Phone Verification Flow](#5-phone-verification-flow)
6. [Login Flow — Without MFA](#6-login-flow--without-mfa)
7. [Login Flow — With MFA](#7-login-flow--with-mfa)
8. [Password Management](#8-password-management)
9. [Token Management](#9-token-management)
10. [Frontend Auth Behavior](#10-frontend-auth-behavior)
11. [Security Reference](#11-security-reference)
12. [MFA Settings Reference](#12-mfa-settings-reference)
13. [Database Models](#13-database-models)
14. [Configuration Reference](#14-configuration-reference)

---

## 1. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                      │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Admin   │  │   Web    │  │ Customer │  │  Finder  │            │
│  │  Portal  │  │  Public  │  │  Portal  │  │  Portal  │            │
│  │ :3001    │  │  :3000   │  │  :3002   │  │  :3003   │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │              │              │              │                  │
│       └──────────────┴──────┬───────┴──────────────┘                │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY                                     │
│                     Express :5000                                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    SECURITY LAYERS                             │  │
│  │                                                                │  │
│  │  Layer 1: Helmet (security headers)                           │  │
│  │  Layer 2: CORS (origin whitelist)                             │  │
│  │  Layer 3: Global Rate Limiter (1000 req/15min)                │  │
│  │  Layer 4: Auth Rate Limiter (20 req/15min)                    │  │
│  │  Layer 5: Endpoint-Specific Rate Limiters                     │  │
│  │  Layer 6: CAPTCHA (math challenge after 2 failed attempts)    │  │
│  │  Layer 7: Brute-Force Protection (5 attempts → 30min lock)    │  │
│  │  Layer 8: Account Status Checks                               │  │
│  │  Layer 9: MFA (email OTP, optional per-user)                  │  │
│  │  Layer 10: JWT Verification                                   │  │
│  │  Layer 11: RBAC Permission Checks                             │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                       │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Users   │  │Verif.    │  │Refresh   │  │  Audit   │            │
│  │          │  │Tokens    │  │Tokens    │  │  Logs    │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │  Roles   │  │ UserRoles│  │ Settings │                          │
│  └──────────┘  └──────────┘  └──────────┘                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                                  │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │  Email   │  │   SMS    │  │  Stripe  │                          │
│  │(nodemailer│  │ (Twilio) │  │(payments)│                          │
│  └──────────┘  └──────────┘  └──────────┘                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Auth Flow High-Level Overview

```
                         ┌─────────────┐
                         │   START     │
                         └──────┬──────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
            ┌──────────────┐        ┌──────────────┐
            │  Register    │        │    Login     │
            └──────┬───────┘        └──────┬───────┘
                   │                       │
                   ▼                       │
        ┌──────────────────┐               │
        │ Verify Email     │               │
        │ (click link)     │               │
        └────────┬─────────┘               │
                 │                         │
                 ▼                         │
        ┌──────────────────┐               │
        │ Verify Phone     │               │
        │ (enter OTP)      │               │
        └────────┬─────────┘               │
                 │                         │
                 ▼                         ▼
        ┌──────────────────┐    ┌──────────────────┐
        │   Account        │    │  Password Check  │
        │   Activated      │    └────────┬─────────┘
        │  (status=active) │             │
        └──────────────────┘     ┌───────┴───────┐
                                 │               │
                                 ▼               ▼
                         ┌──────────────┐ ┌──────────────┐
                         │ CAPTCHA      │ │  Account     │
                         │ (if needed)  │ │  Lockout     │
                         └──────┬───────┘ │  Check       │
                                │         └──────┬───────┘
                                ▼                ▼
                        ┌──────────────────────────┐
                        │     Password Verified     │
                        └────────────┬─────────────┘
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                          ▼                     ▼
                  ┌──────────────┐      ┌──────────────┐
                  │ Admin/CSR?   │      │   Customer   │
                  │ → Skip MFA   │      │  MFA Check   │
                  └──────┬───────┘      └──────┬───────┘
                         │                     │
                         ▼                     ▼
                 ┌──────────────┐      ┌──────────────┐
                 │  Generate    │      │ MFA Enabled? │
                 │  JWT Token   │      │  → Send OTP  │
                 └──────┬───────┘      └──────┬───────┘
                         │                     │
                         │                     ▼
                         │             ┌──────────────┐
                         │             │  User Enters │
                         │             │  OTP Code    │
                         │             └──────┬───────┘
                         │                     │
                         ▼                     ▼
                 ┌──────────────────────────────────┐
                 │       LOGIN SUCCESS              │
                 │   { token, refreshToken, user }  │
                 └──────────────────────────────────┘
```

---

## 2. Security Layers

### Rate Limiting Stack

Every request passes through multiple rate limiters. ALL must pass.

```
Request arrives
      │
      ▼
┌─────────────────────────┐
│ Layer 1: Global         │  1000 requests / 15 min / IP
│ express-rate-limit      │  Response: 429 "Too many requests"
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Layer 2: Auth-Specific  │  20 requests / 15 min / IP
│ (all /api/auth routes)  │  Response: 429 "Too many auth attempts"
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Layer 3: Endpoint       │  Varies per endpoint (see table)
│ (per-endpoint)          │  Response: 429 with endpoint-specific message
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Handler executes        │
└─────────────────────────┘
```

### Rate Limiting Table

| Endpoint | Global | Auth-Layer | Endpoint-Specific | Skipped in Test |
|---|---|---|---|---|
| `POST /login` | 1000/15min | 20/15min | **5/15min** | Endpoint only |
| `POST /register` | 1000/15min | 20/15min | **3/hour** | Endpoint only |
| `POST /forgot-password` | 1000/15min | 20/15min | **3/hour** | Endpoint only |
| `POST /mfa/send-otp` | 1000/15min | 20/15min | **1/30s** | Endpoint only |
| `POST /mfa/verify` | 1000/15min | 20/15min | **5/15min** | Endpoint only |
| `POST /refresh` | 1000/15min | 20/15min | None | N/A |
| `POST /logout` | 1000/15min | 20/15min | None | N/A |
| `GET /me` | 1000/15min | 20/15min | None | N/A |
| `GET /verify-email` | 1000/15min | 20/15min | None | N/A |
| `POST /send-phone-otp` | 1000/15min | 20/15min | **3/15min** | Endpoint only |
| `POST /verify-phone` | 1000/15min | 20/15min | **5/token** | Endpoint only |

### Anti-Enumeration Measures

| Endpoint | Behavior | Why |
|---|---|---|
| `POST /login` | Same error for "user not found" and "wrong password" | Prevents attackers from discovering which emails are registered |
| `POST /register` | Reveals if email/phone exists | Registration is public, so this is acceptable |
| `POST /forgot-password` | Always returns success message | Prevents email enumeration |
| `POST /send-phone-otp` | Always returns success message | Prevents phone enumeration |
| `POST /resend-email-verification` | Always returns success message | Prevents email enumeration |

---

## 3. Registration Flow

### Overview

```
User fills form → API validates → Create user → Send verification email
                                                    │
                                          ┌─────────┴─────────┐
                                          │                   │
                                          ▼                   ▼
                                   Email arrives         Dev mode:
                                   (click link)         URL in console
                                          │
                                          ▼
                                   Email verified
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                              ▼                       ▼
                     Phone also verified?      Phone not verified
                              │                       │
                              ▼                       ▼
                     Account activated        Account stays
                     (status → active)        pending_verification
```

### Detailed Step-by-Step

**Endpoint:** `POST /api/auth/register`
**Handler:** `packages/api/src/routes/auth.ts` lines 86-163
**Rate Limiter:** 3 per hour per IP

```
Step 1: Rate Limit Check
─────────────────────────
  │
  ├─ Exceeded? → 429 "Too many registration attempts"
  │
  └─ Continue ↓

Step 2: Schema Validation
──────────────────────────
  │
  │  Schema: registerSchema
  │  ┌─────────────────────────────────────────────────────┐
  │  │ email:        z.string().email()                    │
  │  │ password:     z.string().min(8).regex(PASSWORD_RE)  │
  │  │ confirmPassword: z.string().min(1)                  │
  │  │ fullName:     z.string().min(2)                     │
  │  │ phoneNumber:  z.string().min(1)                     │
  │  │ acceptTerms:  z.literal(true)                       │
  │  └─────────────────────────────────────────────────────┘
  │
  │  Password regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-...]).+$/
  │  Requires: uppercase, lowercase, digit, special character
  │
  │  Also validates: password === confirmPassword (refine check)
  │
  ├─ Invalid? → 400 { success: false, error: "Validation failed", details: [...] }
  │
  └─ Continue ↓

Step 3: Normalize Inputs
─────────────────────────
  │
  │  email = normalizeEmail(rawEmail)        → trim + lowercase
  │  phoneNumber = normalizePhone(rawPhone)  → strip spaces/dashes, convert 0xxx → +64xxx
  │
  └─ Continue ↓

Step 4: Duplicate Check
────────────────────────
  │
  │  User.findOne({ $or: [{ email }, { phoneNumber }], deletedAt: null })
  │
  ├─ Found? → 400 "An account with this email or phone number already exists"
  │
  └─ Continue ↓

Step 5: Hash Password
──────────────────────
  │
  │  passwordHash = await hashPassword(password)
  │  → bcrypt.hash(password, 12)  // 12 salt rounds
  │
  └─ Continue ↓

Step 6: Create User
────────────────────
  │
  │  User.create({
  │    email,
  │    passwordHash,
  │    fullName,
  │    phoneNumber,
  │    role: 'customer',                    // Legacy field
  │    status: 'pending_verification',
  │    emailVerified: false,
  │    phoneVerified: false,
  │    responsibilityScore: 0,
  │    failedLoginAttempts: 0,
  │    mfaEnabled: true,                    // Default ON for customers
  │  })
  │
  └─ Continue ↓

Step 7: Assign RBAC Role
─────────────────────────
  │
  │  Find CUSTOMER role:  Role.findOne({ name: 'CUSTOMER' })
  │  Create assignment:   UserRole.create({ userId, roleId, isActive: true })
  │
  └─ Continue ↓

Step 8: Generate Email Verification Token
──────────────────────────────────────────
  │
  │  token = generateSecureToken()          → 32-byte random hex
  │  tokenHash = hashToken(token)           → SHA-256 hash
  │
  │  VerificationToken.create({
  │    userId: user._id,
  │    tokenHash,
  │    type: 'email_verification',
  │    expiresAt: Date.now() + 24 hours,
  │    ipAddress,
  │    userAgent,
  │  })
  │
  └─ Continue ↓

Step 9: Send Verification Email
───────────────────────────────
  │
  │  sendVerificationEmail(email, fullName, token)
  │  → Email contains link: {FRONTEND_URL}/verify-email?token={rawToken}
  │
  │  In dev mode: URL logged to console
  │  In production: Sent via nodemailer/SMTP
  │
  └─ Continue ↓

Step 10: Audit Log
──────────────────
  │
  │  AuditLog.create({
  │    userId: user._id,
  │    action: 'registration',
  │    entity: 'User',
  │    entityId: user._id,
  │    changes: { email, phoneNumber },
  │    ipAddress,
  │    userAgent,
  │  })
  │
  └─ Continue ↓

Step 11: Response
─────────────────
  │
  │  201 {
  │    success: true,
  │    data: {
  │      message: "Registration successful. Please verify your email.",
  │      userId: user._id,
  │      email: user.email,
  │      emailSent: boolean
  │    }
  │  }
```

### Admin-Created Users

When an admin creates a user via `POST /api/admin/owners/register`:

```
Admin fills form → API validates → Create user → Send verification email
                                                    │
                                          ┌─────────┴─────────┐
                                          │                   │
                                          ▼                   ▼
                                   Email arrives         User must
                                   (click link)         verify both
                                          │              email + phone
                                          ▼
                                   Email verified
                                          │
                                          ▼
                                   Phone not verified
                                   → Account stays
                                   pending_verification
                                          │
                                          ▼
                                   Admin can skip OTP
                                   via "Skip OTP" button
                                   (sets skipInvoiceOtp)
```

**Key difference:** Admin-created users start with `status: 'pending_verification'` and must verify both email and phone before the account auto-activates.

---

## 4. Email Verification Flow

### Overview

```
User clicks email link
         │
         ▼
┌──────────────────┐
│ GET /verify-email │
│ ?token=...       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ Token valid?     │─NO─▶│ Show error page  │
└────────┬─────────┘     └──────────────────┘
         │ YES
         ▼
┌──────────────────┐     ┌──────────────────┐
│ Already verified?│─YES─▶│ Show "already    │
└────────┬─────────┘     │  verified" page  │
         │ NO            └──────────────────┘
         ▼
┌──────────────────┐
│ Mark email as    │
│ verified         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ Phone also       │─YES─▶│ Activate account │
│ verified?        │     │ Send welcome     │
└────────┬─────────┘     │ email            │
         │ NO            └──────────────────┘
         ▼
┌──────────────────┐
│ Stay pending     │
│ (wait for phone) │
└──────────────────┘
```

### Detailed Step-by-Step

**Endpoint:** `GET /api/auth/verify-email?token=...`
**Handler:** `packages/api/src/routes/auth.ts` lines 352-423

```
Step 1: Detect Request Type
────────────────────────────
  │
  │  isAjax = req.headers.accept?.includes('application/json')
  │         || req.headers['x-requested-with'] === 'XMLHttpRequest'
  │
  │  Determines: JSON response vs browser redirect
  │
  └─ Continue ↓

Step 2: Token Presence Check
─────────────────────────────
  │
  ├─ No token? → Invalid response
  │
  └─ Continue ↓

Step 3: Token Hash Lookup
──────────────────────────
  │
  │  tokenHash = SHA-256(rawToken)
  │  VerificationToken.findOne({
  │    tokenHash,
  │    type: 'email_verification',
  │    usedAt: null     // Must be unused
  │  })
  │
  ├─ Not found? → Invalid response
  │
  └─ Continue ↓

Step 4: Expiry Check
─────────────────────
  │
  ├─ Expired? → 400 "This verification link has expired."
  │             Browser: redirect to ?email_status=expired
  │
  └─ Continue ↓

Step 5: User Lookup
────────────────────
  │
  │  User.findById(token.userId)
  │
  ├─ Not found? → Invalid response
  │
  └─ Continue ↓

Step 6: Already Verified Check
──────────────────────────────
  │
  ├─ user.emailVerified === true? → Already verified response
  │
  └─ Continue ↓

Step 7: Mark Email Verified
────────────────────────────
  │
  │  user.emailVerified = true
  │  user.emailVerifiedAt = new Date()
  │  user.save()
  │
  └─ Continue ↓

Step 8: Mark Token Used
────────────────────────
  │
  │  verificationToken.usedAt = new Date()
  │  verificationToken.save()
  │
  └─ Continue ↓

Step 9: Audit Log
──────────────────
  │
  │  AuditLog.create({
  │    userId: user._id,
  │    action: 'email_verified',
  │    entity: 'User',
  │    entityId: user._id,
  │  })
  │
  └─ Continue ↓

Step 10: Auto-Activate Check
─────────────────────────────
  │
  │  checkAndActivateUser(userId)
  │  ┌─────────────────────────────────────────────────────┐
  │  │ IF user.emailVerified === true                      │
  │  │    AND user.phoneVerified === true                  │
  │  │    AND user.status === 'pending_verification'       │
  │  │ THEN                                                │
  │  │   user.status = 'active'                            │
  │  │   user.save()                                       │
  │  │   sendWelcomeEmail(user.email, user.fullName)       │
  │  │   // Fire-and-forget email                          │
  │  └─────────────────────────────────────────────────────┘
  │
  └─ Continue ↓

Step 11: Response
─────────────────
  │
  │  AJAX:  200 { success: true, data: { message, email, phoneNumber } }
  │  Browser: redirect to {FRONTEND_URL}/verify-account?email_status=verified
```

### Resend Email Verification

**Endpoint:** `POST /api/auth/resend-email-verification`
**Handler:** lines 425-503
**Rate Limit:** 3 per 15 minutes (token count based)

```
Step 1: Validate email
Step 2: Normalize email
Step 3: User lookup
         ├─ Not found → Return vague success message (prevent enumeration)
         └─ Already verified → Return "already verified" message
Step 4: Rate limit check (count recent tokens in 15 min)
         └─ ≥ 3? → 429 "Too many requests"
Step 5: Invalidate old tokens (set usedAt on all unused tokens)
Step 6: Generate new token
Step 7: Send email
Step 8: Audit log (action: 'email_verification_resent')
Step 9: Return vague success message
```

---

## 5. Phone Verification Flow

### Overview

```
User requests OTP
        │
        ▼
┌──────────────────┐
│ POST /send-phone │
│ -otp             │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ System OTP skip? │─YES─▶│ Mark phone as    │
│ (admin setting)  │     │ verified directly│
└────────┬─────────┘     └──────────────────┘
         │ NO
         ▼
┌──────────────────┐
│ Generate 6-digit │
│ OTP, send via    │
│ SMS (Twilio)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ POST /verify-    │
│ phone            │
│ { otp: "123456" }│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ OTP valid?       │─NO─▶│ Return error     │
└────────┬─────────┘     │ (remaining       │
         │ YES           │  attempts)       │
         ▼               └──────────────────┘
┌──────────────────┐
│ Mark phone as    │
│ verified         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ Email also       │─YES─▶│ Activate account │
│ verified?        │     │ Send welcome     │
└────────┬─────────┘     │ email            │
         │ NO            └──────────────────┘
         ▼
┌──────────────────┐
│ Stay pending     │
└──────────────────┘
```

### Detailed Step-by-Step: Send Phone OTP

**Endpoint:** `POST /api/auth/send-phone-otp`
**Handler:** lines 505-604

```
Step 1: Validate phone number
Step 2: Normalize phone number
Step 3: User lookup by phoneNumber
         ├─ Not found → Return vague success message
         └─ Already verified → Return "already verified" message
Step 4: System OTP skip check
         │
         │  isRegistrationOtpDisabled()
         │  → Reads Setting 'otp.noOtpDuringRegistration' (cached 1 min)
         │
         ├─ Disabled? → Mark phoneVerified=true, save, activate, return
         │
Step 5: Rate limit (count recent phone_otp tokens in 15 min)
         └─ ≥ 3? → 429
Step 6: Invalidate old OTPs
Step 7: Generate OTP → crypto.randomInt(100000, 999999) // 6 digits
Step 8: Hash and store
         │
         │  VerificationToken.create({
         │    userId,
         │    tokenHash: SHA-256(otp),
         │    type: 'phone_otp',
         │    expiresAt: Date.now() + 10 minutes,
         │    attempts: 0,
         │  })
         │
Step 9: Send SMS → sendPhoneOtpSMS(phoneNumber, otp)
Step 10: Audit log (action: 'phone_otp_sent')
Step 11: Return vague success message
```

### Detailed Step-by-Step: Verify Phone

**Endpoint:** `POST /api/auth/verify-phone`
**Handler:** lines 606-739

```
Step 1: Identify user (3 methods tried in order)
         │
         │  a. req.user.id (if authenticate middleware ran)
         │  b. Manual JWT decode from Authorization header
         │  c. Phone number from request body → look up user
         │
         ├─ None work? → 401 "Authentication required"
         │
Step 2: User lookup
Step 3: Already verified check
Step 4: OTP hash lookup
         │
         │  tokenHash = SHA-256(submittedOtp)
         │  VerificationToken.findOne({
         │    tokenHash,
         │    type: 'phone_otp',
         │    usedAt: null
         │  }).sort({ createdAt: -1 })  // newest first
         │
Step 5: Match found?
         ├─ NO → Find token with remaining attempts
         │       ├─ All exhausted? → 400 { code: "OTP_MAX_ATTEMPTS" }
         │       └─ Remaining? → Increment attempts, return 400 { code: "INVALID_OTP", data: { remainingAttempts } }
         │
         └─ YES → Continue ↓
Step 6: Expired? → 400 { code: "OTP_EXPIRED" }
Step 7: Max attempts exceeded? → 400 { code: "OTP_MAX_ATTEMPTS" }
Step 8: Mark verified → user.phoneVerified = true, user.phoneVerifiedAt = now
Step 9: Mark token used → token.usedAt = now, token.attempts++
Step 10: Audit log (action: 'phone_verified')
Step 11: Auto-activate check (same as email verification)
Step 12: Return success
```

---

## 6. Login Flow — Without MFA

This is the current production flow.

### Overview

```
                          ┌─────────────┐
                          │ POST /login │
                          └──────┬──────┘
                                 │
                    ┌────────────┴────────────┐
                    │ Rate Limit (5/15min)    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ Schema Validation       │
                    │ { email, password }     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ Normalize Email         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ User Lookup             │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ User Found?             │
                    └──┬───────────────────┬──┘
                       │ YES               │ NO
                       ▼                   ▼
              ┌────────────────┐   ┌────────────────┐
              │ CAPTCHA Check  │   │ "Invalid       │
              │ (≥2 failures?) │   │  credentials"  │
              └───────┬────────┘   └────────────────┘
                      │
              ┌───────┴────────┐
              │ CAPTCHA Valid? │
              └───────┬────────┘
                      │
         ┌────────────┴────────────┐
         │ Account Lockout Check   │
         │ (lockedUntil > now?)    │
         └────────────┬────────────┘
                      │
         ┌────────────┴────────────┐
         │ Password Verification   │
         │ bcrypt.compare()        │
         └──────┬─────────────┬────┘
                │ VALID       │ INVALID
                ▼             ▼
    ┌───────────────┐  ┌──────────────────┐
    │ Reset failed  │  │ Increment fails  │
    │ attempts      │  │ ≥ 5? → Lock 30m  │
    └───────┬───────┘  │ Admin? → Email   │
            │          └──────┬───────────┘
            │                 │
            ▼                 ▼
    ┌───────────────┐  ┌──────────────────┐
    │ Status Check  │  │ "Invalid         │
    │ active?       │  │  credentials"    │
    └───────┬───────┘  └──────────────────┘
            │
    ┌───────┴────────┐
    │ RBAC Lookup    │
    │ (isAdmin?)     │
    └───────┬────────┘
            │
    ┌───────┴────────┐
    │ Pending?       │
    │ (and !admin?)  │
    └──┬──────────┬──┘
       │ YES      │ NO
       ▼          ▼
┌──────────┐ ┌──────────────┐
│ 403      │ │ Generate JWT │
│ Requires │ │ + Refresh    │
│ Verif.   │ │ Token        │
└──────────┘ └──────┬───────┘
                    │
           ┌────────┴────────┐
           │ Admin? → Email  │
           │ login notification│
           └────────┬────────┘
                    │
           ┌────────┴────────┐
           │ Return Token    │
           └─────────────────┘
```

### Detailed Step-by-Step

**Endpoint:** `POST /api/auth/login`
**Handler:** `packages/api/src/routes/auth.ts` lines 189-350

```
Step 1: Rate Limit Check
─────────────────────────
  │
  │  loginLimiter: 5 attempts / 15 min / IP
  │  Skipped in test environment (NODE_ENV === 'test')
  │
  ├─ Exceeded? → 429 "Too many login attempts. Please try again in 15 minutes."
  │
  └─ Continue ↓

Step 2: Schema Validation
──────────────────────────
  │
  │  Schema: loginSchema
  │  ┌─────────────────────────────────────────────┐
  │  │ email:    z.string().email()                │
  │  │ password: z.string().min(1)                 │
  │  └─────────────────────────────────────────────┘
  │
  │  Note: captchaToken and captchaAnswer are NOT in schema
  │        They're extracted directly from req.body
  │
  ├─ Invalid? → 400 "Validation failed"
  │
  └─ Continue ↓

Step 3: Email Normalization
────────────────────────────
  │
  │  email = normalizeEmail(rawEmail)  → trim + lowercase
  │
  └─ Continue ↓

Step 4: User Lookup
────────────────────
  │
  │  User.findOne({ email, deletedAt: null })
  │
  │  Note: Does NOT return yet if not found — continues to Step 7
  │
  └─ Continue ↓

Step 5: CAPTCHA Check (Suspicious Account)
───────────────────────────────────────────
  │
  │  Only runs if user was found in Step 4
  │
  │  Condition: user.failedLoginAttempts >= 2
  │             AND no captchaToken in request body
  │
  ├─ CAPTCHA required but missing?
  │  → 400 {
  │      success: false,
  │      error: "CAPTCHA required. Please complete the verification.",
  │      code: "CAPTCHA_REQUIRED"
  │    }
  │
  └─ Continue ↓

Step 6: CAPTCHA Validation
───────────────────────────
  │
  │  Only runs if captchaToken AND captchaAnswer are present
  │
  │  1. jwt.verify(captchaToken, jwtSecret)
  │     → Decodes: { captchaAnswer: number, exp: number }
  │
  │  2. Compares: decoded.captchaAnswer === captchaAnswer
  │
  ├─ Wrong answer? → 400 "Invalid CAPTCHA answer. Please try again."
  ├─ Expired JWT?  → 400 "CAPTCHA expired. Please get a new one."
  │
  └─ Continue ↓

Step 7: User Existence Check
─────────────────────────────
  │
  ├─ User NOT found? → 401 "Invalid credentials"
  │
  │  Security: Same error as wrong password (prevent enumeration)
  │
  └─ Continue ↓

Step 8: Account Lockout Check
──────────────────────────────
  │
  │  Condition: user.lockedUntil exists AND > Date.now()
  │
  │  Calculates: minutesLeft = ceil((lockedUntil - now) / 60000)
  │
  ├─ Locked? → 423 {
  │      success: false,
  │      error: "Account locked due to too many failed login attempts. Try again in X minute(s).",
  │      code: "ACCOUNT_LOCKED"
  │    }
  │
  └─ Continue ↓

Step 9: Expired Lockout Cleanup
────────────────────────────────
  │
  │  Condition: user.lockedUntil exists AND <= Date.now()
  │
  │  user.failedLoginAttempts = 0
  │  user.lockedUntil = undefined
  │  user.save()
  │
  │  (Automatic — no response sent, execution continues)
  │
  └─ Continue ↓

Step 10: Password Verification
───────────────────────────────
  │
  │  valid = await verifyPassword(password, user.passwordHash)
  │  → bcrypt.compare(password, passwordHash)
  │
  ├─ WRONG PASSWORD — Lines 244-271:
  │  │
  │  │  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1
  │  │
  │  │  if (failedLoginAttempts >= 5):
  │  │    user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000)
  │  │    AuditLog.create({
  │  │      userId: user._id,
  │  │      action: 'account_locked',
  │  │      entity: 'User',
  │  │      changes: { reason: 'too_many_failed_logins', attempts }
  │  │    })
  │  │
  │  │  user.save()
  │  │
  │  │  // Admin notification (fire-and-forget)
  │  │  if (user.role === 'admin' || user.role === 'customer_service'):
  │  │    sendLoginNotification(email, name, email, ip, ua, false)
  │  │
  │  └→ 401 "Invalid credentials"
  │
  └─ VALID → Continue ↓

Step 11: Reset Failed Attempts
───────────────────────────────
  │
  │  if (user.failedLoginAttempts > 0):
  │    user.failedLoginAttempts = 0
  │    user.lockedUntil = undefined
  │    user.save()
  │
  └─ Continue ↓

Step 12: Suspended Account Check
─────────────────────────────────
  │
  ├─ user.status === 'suspended'?
  │  → 403 {
  │      success: false,
  │      error: "Your account has been suspended. Please contact support.",
  │      code: "ACCOUNT_SUSPENDED"
  │    }
  │
  └─ Continue ↓

Step 13: Inactive Account Check
────────────────────────────────
  │
  ├─ user.status === 'inactive'?
  │  → 403 {
  │      success: false,
  │      error: "Your account is inactive. Please contact support.",
  │      code: "ACCOUNT_INACTIVE"
  │    }
  │
  └─ Continue ↓

Step 14: RBAC Role Lookup
──────────────────────────
  │
  │  userRoles = await UserRole.find({ userId: user._id, isActive: true })
  │    .populate('roleId', 'name displayName isSuperAdmin')
  │
  │  rbacRoles = userRoles.map(ur => ur.roleId)
  │
  │  isAdmin = rbacRoles.some(r =>
  │    r.isSuperAdmin ||
  │    ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'WEBSITE_EDITOR'].includes(r.name)
  │  )
  │
  └─ Continue ↓

Step 15: Pending Verification Check
────────────────────────────────────
  │
  │  Condition: user.status === 'pending_verification' AND !isAdmin
  │
  ├─ Pending + not admin?
  │  → 403 {
  │      success: false,
  │      error: "Please verify your email and phone number to activate your account.",
  │      code: "REQUIRES_VERIFICATION",
  │      data: {
  │        emailVerified: user.emailVerified,
  │        phoneVerified: user.phoneVerified,
  │        email,
  │        phoneNumber: user.phoneNumber
  │      }
  │    }
  │
  │  Note: Admin users skip this check — they can log in without verification
  │
  └─ Continue ↓

Step 16: JWT Generation
─────────────────────────
  │
  │  token = generateToken({ id: user._id.toString(), email: user.email, role: user.role })
  │
  │  → jwt.sign(payload, jwtSecret, { expiresIn: '30m' })
  │
  └─ Continue ↓

Step 17: Refresh Token Generation
──────────────────────────────────
  │
  │  refreshTokens = generateRefreshToken()
  │  → { token: "32-byte random hex", tokenHash: "SHA-256 hash" }
  │
  │  await storeRefreshToken(user._id, refreshTokens.tokenHash)
  │  → RefreshToken.create({ userId, tokenHash, expiresAt: now + 30 days })
  │
  └─ Continue ↓

Step 18: Login Notification (Admin Only)
─────────────────────────────────────────
  │
  │  if (isAdmin):
  │    ip = req.ip || req.connection?.remoteAddress
  │    ua = req.headers['user-agent']
  │    sendLoginNotification(user.email, user.fullName, user.email, ip, ua, true)
  │    // Fire-and-forget email
  │
  └─ Continue ↓

Step 19: Success Response
──────────────────────────
  │
  │  200 {
  │    success: true,
  │    data: {
  │      token: "<JWT access token>",
  │      refreshToken: "<raw refresh token>",
  │      user: {
  │        id: user._id,
  │        email: user.email,
  │        fullName: user.fullName,
  │        role: user.role,
  │        status: user.status,
  │        rbacRoles: [
  │          {
  │            name: "CUSTOMER",
  │            displayName: "Pet Owner",
  │            isSuperAdmin: false
  │          }
  │        ]
  │      }
  │    }
  │  }
```

---

## 7. Login Flow — With MFA

This is the planned MFA flow. MFA is optional per-user for customers, and controlled by admin settings.

### Overview

```
                          ┌─────────────┐
                          │ POST /login │
                          └──────┬──────┘
                                 │
                    ┌────────────┴────────────┐
                    │ Steps 1-10: Same as     │
                    │ non-MFA flow            │
                    │ (rate limit → CAPTCHA → │
                    │  lockout → password)    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ Password Verified ✓     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ Is Admin/CSR?           │
                    └──┬───────────────────┬──┘
                       │ YES               │ NO
                       ▼                   ▼
              ┌──────────────┐    ┌──────────────────┐
              │ Skip MFA     │    │ user.mfaEnabled? │
              │ (admin       │    └──┬───────────┬──┘
              │  bypass)     │       │ false     │ true
              └──────┬───────┘       ▼           ▼
                     │        ┌──────────┐  ┌──────────────┐
                     │        │ Generate │  │ Send OTP to  │
                     │        │ JWT      │  │ email        │
                     │        └────┬─────┘  └──────┬───────┘
                     │             │               │
                     │             │               ▼
                     │             │       ┌──────────────┐
                     │             │       │ Return       │
                     │             │       │ { tempToken }│
                     │             │       └──────┬───────┘
                     │             │              │
                     │             │              ▼
                     │             │       ┌──────────────┐
                     │             │       │ User enters  │
                     │             │       │ OTP code     │
                     │             │       └──────┬───────┘
                     │             │              │
                     │             │              ▼
                     │             │       ┌──────────────┐
                     │             │       │ POST /mfa/   │
                     │             │       │ verify       │
                     │             │       └──────┬───────┘
                     │             │              │
                     ▼             ▼              ▼
              ┌──────────────────────────────────────┐
              │          GENERATE REAL JWT           │
              │     + Refresh Token                  │
              └──────────────────┬───────────────────┘
                                 │
                        ┌────────┴────────┐
                        │ Login           │
                        │ Notification    │
                        │ (admin only)    │
                        └────────┬────────┘
                                 │
                        ┌────────┴────────┐
                        │ Return Token    │
                        └─────────────────┘
```

### MFA Decision Tree

```
Password verified
      │
      ▼
┌─────────────────┐
│ user.role in     │
│ ['admin',       │
│  'customer_     │
│  service']?     │
└──┬──────────┬───┘
   │ YES      │ NO
   ▼          ▼
┌──────┐  ┌─────────────────┐
│ Skip │  │ user.mfaEnabled │
│ MFA  │  │ === false?      │
└──────┘  └──┬──────────┬───┘
             │ YES      │ NO
             ▼          ▼
        ┌──────┐  ┌─────────────────┐
        │ Skip │  │ mfa.adminEnabled│
        │ MFA  │  │ === 'true'?     │
        └──────┘  │ (global setting)│
                  └──┬──────────┬───┘
                     │ YES      │ NO
                     ▼          ▼
                ┌──────┐  ┌──────┐
                │ Send │  │ Skip │
                │ OTP  │  │ MFA  │
                └──────┘  └──────┘
```

**Logic:**
1. If user is admin/CSR → **always skip MFA** (admin controls their own MFA via global setting, not per-user)
2. If user is customer and `user.mfaEnabled === false` → **skip MFA** (customer opted out)
3. If user is customer and `mfa.adminEnabled === 'false'` → **skip MFA** (admin disabled MFA globally)
4. Otherwise → **require MFA**

### Detailed Step-by-Step: Send MFA OTP

**Endpoint:** `POST /api/auth/mfa/send-otp`
**Handler:** `packages/api/src/routes/auth.ts` (new endpoint)

```
Step 1: Rate Limit
──────────────────
  │
  │  mfaSendLimiter: 1 request per 30 seconds
  │
  ├─ Exceeded? → 429 "Please wait before requesting a new code"
  │
  └─ Continue ↓

Step 2: Validate Request
─────────────────────────
  │
  │  Schema: { tempToken: string }
  │
  │  tempToken is a short-lived JWT (5 min expiry) containing:
  │  { userId: string, email: string, purpose: 'login_mfa' }
  │
  ├─ Invalid/expired? → 401 "Session expired. Please log in again."
  │
  └─ Continue ↓

Step 3: Verify tempToken
─────────────────────────
  │
  │  decoded = jwt.verify(tempToken, jwtSecret)
  │
  ├─ Invalid? → 401 "Session expired. Please log in again."
  │
  └─ Continue ↓

Step 4: Generate OTP
─────────────────────
  │
  │  otp = crypto.randomInt(100000, 999999).toString()  // 6 digits
  │
  └─ Continue ↓

Step 5: Hash and Store OTP
───────────────────────────
  │
  │  VerificationToken.create({
  │    userId: decoded.userId,
  │    tokenHash: SHA-256(otp),
  │    type: 'login_mfa',
  │    expiresAt: Date.now() + 5 minutes,
  │    attempts: 0,
  │    ipAddress,
  │    userAgent,
  │  })
  │
  └─ Continue ↓

Step 6: Send OTP Email
───────────────────────
  │
  │  // Test mode: send to test email instead
  │  if (mfa.testMode === 'true'):
  │    recipient = mfa.testEmail  // e.g., arpanbhagat@yahoo.com
  │  else:
  │    recipient = user.email
  │
  │  sendLoginOtpEmail(recipient, user.fullName, otp)
  │
  │  Email contains:
  │  - 6-digit code in large, monospace font
  │  - "This code expires in 5 minutes"
  │  - "If you didn't request this code, ignore this email"
  │
  └─ Continue ↓

Step 7: Audit Log
──────────────────
  │
  │  AuditLog.create({
  │    userId: decoded.userId,
  │    action: 'login_mfa_otp_sent',
  │    entity: 'User',
  │    ipAddress,
  │    userAgent,
  │  })
  │
  └─ Continue ↓

Step 8: Response
─────────────────
  │
  │  200 {
  │    success: true,
  │    data: {
  │      message: "A verification code has been sent to your email.",
  │      expiresIn: 300,        // 5 minutes in seconds
  │      maskedEmail: "u***r@example.com"  // Show which email received it
  │    }
  │  }
```

### Detailed Step-by-Step: Verify MFA OTP

**Endpoint:** `POST /api/auth/mfa/verify`
**Handler:** `packages/api/src/routes/auth.ts` (new endpoint)

```
Step 1: Rate Limit
──────────────────
  │
  │  mfaVerifyLimiter: 5 attempts per 15 minutes
  │
  ├─ Exceeded? → 429 "Too many verification attempts. Please try again later."
  │
  └─ Continue ↓

Step 2: Validate Request
─────────────────────────
  │
  │  Schema: { tempToken: string, otp: string (6 digits) }
  │
  ├─ Invalid? → 400 "Invalid request"
  │
  └─ Continue ↓

Step 3: Verify tempToken
─────────────────────────
  │
  │  decoded = jwt.verify(tempToken, jwtSecret)
  │
  ├─ Invalid/expired? → 401 "Session expired. Please log in again."
  │
  └─ Continue ↓

Step 4: Find User
──────────────────
  │
  │  user = await User.findById(decoded.userId)
  │
  ├─ Not found? → 401 "User not found"
  ├─ Suspended? → 403 "Account suspended"
  ├─ Inactive? → 403 "Account inactive"
  │
  └─ Continue ↓

Step 5: OTP Hash Lookup
─────────────────────────
  │
  │  tokenHash = SHA-256(submittedOtp)
  │  token = await VerificationToken.findOne({
  │    userId: decoded.userId,
  │    tokenHash,
  │    type: 'login_mfa',
  │    usedAt: null
  │  }).sort({ createdAt: -1 })
  │
  ├─ No match?
  │  │
  │  │  Find any unused login_mfa token with remaining attempts
  │  │
  │  ├─ All exhausted? → 400 { code: "OTP_MAX_ATTEMPTS" }
  │  │                   Message: "Too many attempts. Please request a new code."
  │  │
  │  └─ Remaining? → Increment attempts on token
  │                   → 400 { code: "INVALID_OTP", data: { remainingAttempts } }
  │
  └─ Match found → Continue ↓

Step 6: OTP Expiry Check
─────────────────────────
  │
  ├─ token.expiresAt < Date.now()?
  │  → 400 { code: "OTP_EXPIRED" }
  │    Message: "This code has expired. Please request a new one."
  │
  └─ Continue ↓

Step 7: Max Attempts Check
───────────────────────────
  │
  ├─ token.attempts >= 5 (config.maxOtpAttempts)?
  │  → 400 { code: "OTP_MAX_ATTEMPTS" }
  │
  └─ Continue ↓

Step 8: Mark OTP Used
──────────────────────
  │
  │  token.usedAt = new Date()
  │  token.attempts += 1
  │  token.save()
  │
  └─ Continue ↓

Step 9: Generate JWT (same as non-MFA login)
──────────────────────────────────────────────
  │
  │  token = jwt.sign({ id: user._id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '30m' })
  │
  └─ Continue ↓

Step 10: Generate Refresh Token
───────────────────────────────
  │
  │  refreshTokens = generateRefreshToken()
  │  await storeRefreshToken(user._id, refreshTokens.tokenHash)
  │
  └─ Continue ↓

Step 11: Audit Log
──────────────────
  │
  │  AuditLog.create({
  │    userId: user._id,
  │    action: 'login_mfa_verified',
  │    entity: 'User',
  │    ipAddress,
  │    userAgent,
  │  })
  │
  └─ Continue ↓

Step 12: Response
─────────────────
  │
  │  200 {
  │    success: true,
  │    data: {
  │      token: "<JWT access token>",
  │      refreshToken: "<raw refresh token>",
  │      user: {
  │        id, email, fullName, role, status, rbacRoles
  │      }
  │    }
  │  }
```

### Frontend MFA Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    LOGIN PAGE                                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Step 1: Email + Password + CAPTCHA                   │   │
│  │                                                      │   │
│  │  Email:    [________________________]                │   │
│  │  Password: [________________________]                │   │
│  │  CAPTCHA:  [___] (if triggered)                      │   │
│  │                                                      │   │
│  │  [Sign In]                                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  If response.code === 'MFA_REQUIRED':                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Step 2: Enter OTP                                    │   │
│  │                                                      │   │
│  │  A verification code has been sent to u***r@email.com │   │
│  │                                                      │   │
│  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐              │   │
│  │  │   │ │   │ │   │ │   │ │   │ │   │              │   │
│  │  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘              │   │
│  │                                                      │   │
│  │  Code expires in 4:32                                │   │
│  │                                                      │   │
│  │  [Verify Code]                                       │   │
│  │                                                      │   │
│  │  Didn't receive the code? Resend (30s)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Frontend State Management

```javascript
// Login page state
const [phase, setPhase] = useState('credentials');  // 'credentials' | 'mfa'
const [tempToken, setTempToken] = useState(null);
const [maskedEmail, setMaskedEmail] = useState('');

// After password verification
if (response.code === 'MFA_REQUIRED') {
  setPhase('mfa');
  setTempToken(response.data.tempToken);
  setMaskedEmail(response.data.maskedEmail);
}

// MFA OTP submission
const handleMfaVerify = async (otp) => {
  const res = await api.post('/auth/mfa/verify', { tempToken, otp });
  // Success: store token, redirect to dashboard
};
```

---

## 8. Password Management

### Change Password (Authenticated)

```
┌─────────────────────────────────────────────────────────────┐
│ POST /api/auth/change-password                               │
│                                                              │
│ Requires: Authentication (JWT in Authorization header)       │
│                                                              │
│ Request:                                                     │
│ {                                                            │
│   "currentPassword": "OldPassword1!",                        │
│   "newPassword": "NewPassword1!"                             │
│ }                                                            │
│                                                              │
│ Flow:                                                        │
│ 1. Verify current password with bcrypt.compare()             │
│ 2. Hash new password with bcrypt (12 rounds)                 │
│ 3. Save new passwordHash                                     │
│ 4. Send "password changed" notification email (fire-forget)  │
│ 5. Return success                                            │
│                                                              │
│ Errors:                                                      │
│ - 401: "Current password is incorrect"                       │
│ - 400: Validation failed (password policy)                   │
└─────────────────────────────────────────────────────────────┘
```

### Forgot Password

```
┌─────────────────────────────────────────────────────────────┐
│ POST /api/auth/forgot-password                               │
│                                                              │
│ Rate Limit: 3 per hour per IP                                │
│                                                              │
│ Request:                                                     │
│ { "email": "user@example.com" }                              │
│                                                              │
│ Flow:                                                        │
│ 1. Normalize email                                           │
│ 2. Look up user                                              │
│ 3. Generate 32-byte random token                             │
│ 4. Hash token (SHA-256), store in VerificationToken          │
│    - type: 'password_reset'                                  │
│    - expiresAt: now + 1 hour                                 │
│ 5. Send reset email with link:                               │
│    {FRONTEND_URL}/reset-password?token={rawToken}            │
│ 6. Audit log (action: 'password_reset_requested')            │
│                                                              │
│ Response (always — even if user not found):                  │
│ {                                                            │
│   "success": true,                                           │
│   "data": { "message": "If an account exists, a reset       │
│            email has been sent." }                            │
│ }                                                            │
│                                                              │
│ Security: Always returns success to prevent email enum       │
└─────────────────────────────────────────────────────────────┘
```

### Reset Password

```
┌─────────────────────────────────────────────────────────────┐
│ POST /api/auth/reset-password                                │
│                                                              │
│ Request:                                                     │
│ {                                                            │
│   "token": "raw-token-from-email",                           │
│   "newPassword": "NewPassword1!"                             │
│ }                                                            │
│                                                              │
│ Flow:                                                        │
│ 1. Hash token, look up VerificationToken                     │
│    - type: 'password_reset'                                  │
│    - usedAt: null                                            │
│ 2. Check expiry                                              │
│ 3. Look up user by userId                                    │
│ 4. Hash new password, save to user                           │
│ 5. Mark token as used                                        │
│ 6. Audit log (action: 'password_reset_completed')            │
│ 7. Send "password changed" email (fire-forget)               │
│                                                              │
│ Errors:                                                      │
│ - 400: "Invalid or used reset link"                          │
│ - 400: "This reset link has expired"                         │
│ - 400: "User not found"                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Token Management

### Access Token (JWT)

```
┌─────────────────────────────────────────────────────────────┐
│ Structure:                                                   │
│ {                                                            │
│   "id": "user._id",                                         │
│   "email": "user@example.com",                              │
│   "role": "customer",                                       │
│   "iat": 1234567890,                                        │
│   "exp": 1234569690    // +30 minutes                       │
│ }                                                            │
│                                                              │
│ Signing: JWT_SECRET (HS256)                                  │
│ Expiry: 30 minutes (configurable via JWT_ACCESS_EXPIRES_IN)  │
│ Storage: Client-side (localStorage)                          │
│ Header: Authorization: Bearer <token>                        │
│                                                              │
│ NOT revoked on logout — continues to work until expiry       │
└─────────────────────────────────────────────────────────────┘
```

### Refresh Token

```
┌─────────────────────────────────────────────────────────────┐
│ Structure:                                                   │
│ Raw token: 32-byte random hex (64 chars)                     │
│ Stored: SHA-256 hash in RefreshToken collection              │
│                                                              │
│ Expiry: 30 days (configurable via REFRESH_TOKEN_EXPIRES_IN_DAYS)│
│ Rotation: Single-use (rotated on each refresh)               │
│ Revocation: Sets revokedAt timestamp                         │
│                                                              │
│ Flow:                                                        │
│ 1. Client sends expired/soon-to-expire access token          │
│ 2. Server looks up refresh token by hash                     │
│ 3. Validates: not revoked, not expired                       │
│ 4. Revokes old refresh token                                 │
│ 5. Generates new refresh token + new access token            │
│ 6. Returns both new tokens                                   │
│                                                              │
│ Security: If an already-rotated token is used,               │
│           it fails (detects potential token theft)            │
└─────────────────────────────────────────────────────────────┘
```

### Refresh Token Flow

```
┌─────────────────────────────────────────────────────────────┐
│ POST /api/auth/refresh                                       │
│                                                              │
│ Request:                                                     │
│ { "refreshToken": "raw-refresh-token" }                      │
│                                                              │
│ Flow:                                                        │
│ 1. Token present?                                            │
│    ├─ No → 400 "Refresh token is required"                   │
│    └─ Yes → Continue                                         │
│                                                              │
│ 2. Verify refresh token                                      │
│    │  tokenHash = SHA-256(rawToken)                          │
│    │  RefreshToken.findOne({                                 │
│    │    tokenHash,                                           │
│    │    revokedAt: null,                                     │
│    │    expiresAt: { $gt: Date.now() }                       │
│    │  })                                                     │
│    ├─ Invalid/expired → 401 "Invalid or expired refresh token"│
│    └─ Valid → Continue                                       │
│                                                              │
│ 3. Look up user                                             │
│    ├─ Not found, suspended, or inactive → 401                │
│    └─ Found → Continue                                       │
│                                                              │
│ 4. Rotate refresh token                                     │
│    │  rotateRefreshToken():                                  │
│    │  - Find old token by hash                               │
│    │  - Set revokedAt = now                                  │
│    │  - Generate new 32-byte random token                    │
│    │  - Store new hash in RefreshToken                       │
│    ├─ Failed → 401 "Failed to rotate refresh token"          │
│    └─ Success → Continue                                     │
│                                                              │
│ 5. Generate new access token                                │
│    │  jwt.sign({ id, email, role }, jwtSecret, { expiresIn })│
│                                                              │
│ 6. Response                                                  │
│    {                                                         │
│      "success": true,                                        │
│      "data": {                                               │
│        "token": "<new JWT>",                                 │
│        "refreshToken": "<new refresh token>"                 │
│      }                                                       │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Logout

```
┌─────────────────────────────────────────────────────────────┐
│ POST /api/auth/logout                                        │
│                                                              │
│ Request:                                                     │
│ { "refreshToken": "raw-refresh-token" }  // optional         │
│                                                              │
│ Flow:                                                        │
│ 1. If refreshToken provided:                                 │
│    - Hash token, find in RefreshToken                        │
│    - Set revokedAt = now                                     │
│                                                              │
│ 2. Response:                                                 │
│    {                                                         │
│      "success": true,                                        │
│      "data": { "message": "Logged out successfully" }        │
│    }                                                         │
│                                                              │
│ Note: Access token (JWT) is NOT revoked                      │
│       It continues to work until natural expiry              │
│       Only the refresh token is invalidated                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Frontend Auth Behavior

### Storage Keys

| App | Token Key | Purpose |
|---|---|---|
| Admin Portal | `admin_token` | JWT access token |
| Web Public | `pawtag_token` | JWT access token |
| Customer Portal | `customer_token` | JWT access token |
| Finder Portal | `finder_token` | JWT access token (if needed) |

### Admin Portal Login Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Admin Login Page (/login)                                    │
│                                                              │
│ 1. User enters email + password                              │
│ 2. CAPTCHA appears after 2 failed attempts                   │
│ 3. Submit → POST /auth/login                                │
│                                                              │
│ Success:                                                     │
│ - Store token as 'admin_token' in localStorage              │
│ - Fetch /auth/me to get user data + RBAC roles              │
│ - Fetch /admin/rbac/users/:id/effective-permissions         │
│ - Redirect to admin dashboard                                │
│                                                              │
│ Error: CAPTCHA_REQUIRED                                      │
│ - Show CAPTCHA challenge                                     │
│ - User solves math problem                                   │
│ - Resubmit with captchaToken + captchaAnswer                 │
│                                                              │
│ Error: REQUIRES_VERIFICATION                                 │
│ - Should not happen (admin bypass)                           │
│ - If it does, show error message                             │
│                                                              │
│ Other errors:                                                │
│ - Show error message                                         │
│ - If CAPTCHA was shown, refresh CAPTCHA                      │
└─────────────────────────────────────────────────────────────┘
```

### Web Public Login Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Web Login Page (/login)                                      │
│                                                              │
│ 1. User enters email + password                              │
│ 2. CAPTCHA appears after 2 failed attempts                   │
│ 3. Submit → POST /auth/login                                │
│                                                              │
│ Success:                                                     │
│ - Store token as 'pawtag_token' in localStorage             │
│ - Check user.rbacRoles for admin roles                       │
│                                                              │
│   If admin:                                                  │
│     - Redirect to admin portal (window.location.href)        │
│     - e.g., http://localhost:3001                            │
│                                                              │
│   If customer:                                               │
│     - Navigate to /account                                   │
│                                                              │
│ Error: CAPTCHA_REQUIRED                                      │
│ - Show CAPTCHA challenge                                     │
│                                                              │
│ Error: REQUIRES_VERIFICATION                                 │
│ - Extract email + phone from error.data                      │
│ - Redirect to /verify-account?email=...&phone=...           │
│                                                              │
│ Other errors:                                                │
│ - Show error message                                         │
└─────────────────────────────────────────────────────────────┘
```

### Customer Portal Login Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Customer Login Page (/login)                                 │
│                                                              │
│ 1. User enters email + password                              │
│ 2. CAPTCHA appears after 2 failed attempts                   │
│ 3. Submit → POST /auth/login                                │
│                                                              │
│ Success:                                                     │
│ - Store token as 'customer_token' in localStorage           │
│ - Navigate to / (dashboard)                                  │
│                                                              │
│ Error: CAPTCHA_REQUIRED                                      │
│ - Show CAPTCHA challenge                                     │
│                                                              │
│ Error: REQUIRES_VERIFICATION                                 │
│ - Show message: "Please verify your email/phone"            │
│ - After 3 seconds, redirect to /verify-account              │
│                                                              │
│ Other errors:                                                │
│ - Show error message                                         │
│ - If CAPTCHA was shown, refresh CAPTCHA                      │
└─────────────────────────────────────────────────────────────┘
```

### Auth Context Structure

```typescript
// All three apps use similar auth contexts
interface AuthContextType {
  user: User | null;           // Current user object
  token: string | null;        // JWT access token
  isLoading: boolean;          // True during initial /auth/me check
  login: (                     // Login function
    email: string,
    password: string,
    captchaToken?: string,
    captchaAnswer?: string
  ) => Promise<User>;
  logout: () => void;          // Clear token + user
  refreshUser?: () => void;    // Re-fetch user from /auth/me (customer/web)
  permissions?: Permission[];  // Effective permissions (admin only)
  hasPermission?: (name: string) => boolean;  // Permission check (admin only)
}
```

### Token Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ Token Lifecycle                                              │
│                                                              │
│ 1. Login                                                     │
│    → Receive access token (30 min) + refresh token (30 days)  │
│    → Store in localStorage                                   │
│                                                              │
│ 2. API Requests                                              │
│    → Attach Authorization: Bearer <token> header             │
│    → API verifies with jwt.verify()                          │
│                                                              │
│ 3. Token Expiry (401 response)                               │
│    → Use refresh token to get new access token               │
│    → Retry original request                                  │
│                                                              │
│ 4. Refresh Token Expiry                                       │
│    → User must log in again                                  │
│    → All tokens are invalid                                  │
│                                                              │
│ 5. Logout                                                    │
│    → Revoke refresh token (POST /auth/logout)                │
│    → Clear localStorage                                      │
│    → Access token continues to work until natural expiry     │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Security Reference

### Password Policy

```
┌─────────────────────────────────────────────────────────────┐
│ Password Requirements                                        │
│                                                              │
│ Minimum length: 8 characters                                 │
│                                                              │
│ Must contain ALL of:                                         │
│ ☐ At least one uppercase letter (A-Z)                        │
│ ☐ At least one lowercase letter (a-z)                        │
│ ☐ At least one digit (0-9)                                   │
│ ☐ At least one special character: !@#$%^&*()_+-=[]{};':"\|,.<>/? │
│                                                              │
│ Regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*...]).+$/
│                                                              │
│ Storage: bcrypt with 12 salt rounds                           │
│ Comparison: bcrypt.compare() (timing-safe)                   │
└─────────────────────────────────────────────────────────────┘
```

### Account Lockout

```
┌─────────────────────────────────────────────────────────────┐
│ Brute-Force Protection                                        │
│                                                              │
│ Trigger: 5 consecutive failed login attempts                 │
│ Lockout duration: 30 minutes                                 │
│                                                              │
│ Behavior:                                                    │
│ - After 5th failure: lockedUntil = now + 30min               │
│ - All subsequent attempts blocked with 423                    │
│ - Response includes minutes remaining                        │
│ - AuditLog entry: action = 'account_locked'                  │
│                                                              │
│ Recovery:                                                    │
│ - Wait 30 minutes (automatic unlock)                         │
│ - Admin unlocks via PUT /admin/users/:id/unlock              │
│   (also clears failedLoginAttempts)                          │
│                                                              │
│ Reset on success:                                            │
│ - When password is correct, failedLoginAttempts = 0          │
│ - lockedUntil = undefined                                    │
└─────────────────────────────────────────────────────────────┘
```

### CAPTCHA System

```
┌─────────────────────────────────────────────────────────────┐
│ Math Challenge CAPTCHA                                        │
│                                                              │
│ Trigger: After 2+ failed login attempts for a specific user  │
│                                                              │
│ Flow:                                                        │
│ 1. GET /auth/captcha                                         │
│    → Returns { question: "What is 3 + 7?", token: "..." }   │
│    → Answer is signed into the JWT (5 min expiry)            │
│                                                              │
│ 2. User solves math problem                                  │
│    → Submits answer + token with login request               │
│                                                              │
│ 3. Server verifies:                                          │
│    → jwt.verify(token) → decode captchaAnswer                │
│    → Compare decoded.answer === submitted answer             │
│                                                              │
│ Characters: +, -, × (addition, subtraction, multiplication)  │
│ Numbers: 1-10                                                │
│ Expiry: 5 minutes                                            │
│                                                              │
│ Note: This is a simple math challenge, not reCAPTCHA         │
│       Suitable for basic bot protection                      │
└─────────────────────────────────────────────────────────────┘
```

### Token Security Summary

| Token Type | Length | Storage | Expiry | Rotation | Revocable |
|---|---|---|---|---|---|
| Access (JWT) | ~200 chars | Client localStorage | 30 min | No (but short-lived) | No |
| Refresh | 64 chars (hex) | Client localStorage + DB hash | 30 days | Yes (single-use) | Yes |
| Email Verification | 64 chars (hex) | DB hash only | 24 hours | No | Single-use |
| Phone OTP | 6 digits | DB hash only | 10 minutes | No | Single-use (5 attempts) |
| Password Reset | 64 chars (hex) | DB hash only | 1 hour | No | Single-use |
| CAPTCHA | JWT (signed answer) | Client-side | 5 minutes | No | N/A |
| Login MFA OTP | 6 digits | DB hash only | 5 minutes | No | Single-use (5 attempts) |
| MFA tempToken | JWT (signed) | Client-side | 5 minutes | No | N/A |

---

## 12. MFA Settings Reference

### Global Settings (Admin-Controlled)

| Setting Key | Default | Description |
|---|---|---|
| `mfa.adminEnabled` | `'false'` | Global toggle for admin/CSR MFA |
| `mfa.customerEnabled` | `'true'` | Default `mfaEnabled` for new customer registrations |
| `mfa.testMode` | `'false'` | Send OTP to test email instead of actual user |
| `mfa.testEmail` | `'arpanbhagat@yahoo.com'` | Test email address for dev mode |

### Per-User Setting

| Field | Type | Default | Description |
|---|---|---|---|
| `user.mfaEnabled` | Boolean | `true` (customers) / `false` (admins) | Individual MFA opt-in/opt-out |

### Decision Matrix

```
┌──────────────────┬───────────────────┬─────────────────────────┐
│ User Type        │ Global Setting    │ Per-User Setting        │
├──────────────────┼───────────────────┼─────────────────────────┤
│ Admin/CSR        │ mfa.adminEnabled  │ N/A (not used)          │
│                  │ 'true' → MFA ON   │ Admin MFA is global     │
│                  │ 'false' → MFA OFF │ only, no per-user       │
├──────────────────┼───────────────────┼─────────────────────────┤
│ Customer         │ mfa.customerUsed  │ user.mfaEnabled         │
│ (new)            │ determines        │ defaults to true        │
│                  │ default           │                         │
├──────────────────┼───────────────────┼─────────────────────────┤
│ Customer         │ mfa.customerUsed  │ user.mfaEnabled         │
│ (existing)       │ NOT checked       │ checked directly        │
│                  │ (only for new     │ Customer can toggle     │
│                  │ registrations)    │ in Settings page        │
└──────────────────┴───────────────────┴─────────────────────────┘
```

### MFA Toggle Flow (Customer)

```
Customer clicks "Disable MFA" in Settings page
         │
         ▼
┌─────────────────────────────┐
│ PUT /api/customer/settings/mfa │
│ { enabled: false }          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Update user.mfaEnabled = false │
│ Save to database             │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Audit log:                  │
│ action: 'mfa_disabled'      │
│ userId: user._id            │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Return success              │
│ Next login: no MFA step     │
└─────────────────────────────┘
```

### Admin Override Flow

```
Admin clicks "Disable MFA" for a user in Users page
         │
         ▼
┌─────────────────────────────┐
│ PUT /api/admin/users/:id    │
│ { mfaEnabled: false }       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Update user.mfaEnabled = false │
│ (works for any user type)   │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Audit log:                  │
│ action: 'admin_mfa_override'│
│ adminId: admin._id          │
│ userId: target user._id     │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Return success              │
└─────────────────────────────┘
```

---

## 13. Database Models

### User Model

```typescript
// packages/db/src/models/User.ts

interface IUserDocument extends Document {
  // Auth fields
  email: string;                    // unique, lowercase, indexed
  passwordHash: string;             // bcrypt hash
  role: string;                     // Legacy: 'customer' | 'admin' | 'customer_service'
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';

  // Verification
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  phoneVerified: boolean;
  phoneVerifiedAt?: Date;
  phoneNumber: string;

  // MFA
  mfaEnabled: boolean;              // NEW: per-user MFA toggle (default: true for customers)

  // Brute-force protection
  failedLoginAttempts: number;      // default: 0
  lockedUntil?: Date;               // default: null

  // Profile
  fullName: string;
  profilePicture?: string;
  address?: { line1, line2?, city, state, zip, country };
  emergencyContact?: { name, phone, email?, relationship };
  responsibilityScore: number;      // default: 0

  // Skip OTP (admin feature)
  skipInvoiceOtp: boolean;
  skipInvoiceOtpExpiresAt?: Date;

  // Notifications
  notificationPreferences?: {
    email: boolean;
    push: boolean;
    inApp: boolean;
    channels: {
      petFound: boolean;
      orderUpdate: boolean;
      subscriptionReminder: boolean;
      referral: boolean;
      marketing: boolean;
    };
  };

  // Soft delete
  deletedAt?: Date;
}
```

### VerificationToken Model

```typescript
// packages/db/src/models/VerificationToken.ts

interface IVerificationTokenDocument extends Document {
  userId: ObjectId;                 // ref: User
  tokenHash: string;                // SHA-256 hash of raw token
  type: 'email_verification' | 'phone_otp' | 'password_reset' | 'login_mfa';
  expiresAt: Date;                  // TTL index (auto-delete)
  usedAt?: Date;                    // null = unused
  attempts: number;                 // for OTP types
  resendCount: number;
  lastSentAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Indexes:
// { userId, type }
// { tokenHash, type }
// TTL on expiresAt (auto-delete expired tokens)
```

### RefreshToken Model

```typescript
// packages/db/src/models/RefreshToken.ts

interface IRefreshTokenDocument extends Document {
  userId: ObjectId;                 // ref: User
  tokenHash: string;                // SHA-256 hash, unique
  expiresAt: Date;                  // TTL index
  revokedAt?: Date;                 // null = active
  deviceInfo?: string;
}

// TTL on expiresAt (auto-delete expired tokens)
```

### AuditLog Model

```typescript
// packages/db/src/models/AuditLog.ts

// Auth-related actions:
// - 'registration'
// - 'email_verified'
// - 'phone_verified'
// - 'phone_otp_sent'
// - 'phone_otp_resent'
// - 'phone_otp_skipped_system'
// - 'password_reset_requested'
// - 'password_reset_completed'
// - 'account_locked'
// - 'login_mfa_otp_sent'
// - 'login_mfa_verified'
// - 'mfa_disabled'
// - 'mfa_enabled'
// - 'admin_mfa_override'
// - 'login_notification_sent'
// - 'login_notification_failed'
```

---

## 14. Configuration Reference

### Environment Variables

```bash
# JWT
JWT_SECRET=your-secret-key          # Required in production
JWT_ACCESS_EXPIRES_IN=30m           # Access token expiry

# Refresh Tokens
REFRESH_TOKEN_EXPIRES_IN_DAYS=30    # Refresh token expiry

# OTP
OTP_EXPIRY_MINUTES=10               # Phone OTP expiry
MAX_OTP_ATTEMPTS=5                  # Max OTP verification attempts
MAX_RESEND_COUNT=3                  # Max resends per 15-min window
RESEND_COOLDOWN_SECONDS=60          # Cooldown between resends (UI hint)

# Email Verification
EMAIL_TOKEN_EXPIRY_HOURS=24         # Email verification token expiry

# Rate Limiting
RATE_LIMIT_MAX=1000                 # Global: per 15 min per IP
AUTH_RATE_LIMIT_MAX=20              # Auth routes: per 15 min per IP
LOGIN_RATE_LIMIT_MAX=5              # Login: per 15 min per IP
REGISTER_RATE_LIMIT_MAX=3           # Register: per hour per IP
FORGOT_PASSWORD_RATE_LIMIT_MAX=3    # Forgot password: per hour per IP

# MFA
MFA_SEND_RATE_LIMIT_MAX=1           # MFA OTP send: per 30 seconds
MFA_VERIFY_RATE_LIMIT_MAX=5         # MFA OTP verify: per 15 min per IP

# Frontend
FRONTEND_URL=http://localhost:3000   # Used in email links
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,...

# SMS
SMS_PROVIDER=demo                   # 'demo' | 'twilio'
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Email
EMAIL_PROVIDER=smtp                 # 'smtp' | 'demo'
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

### Config Object

```typescript
// packages/api/src/config.ts

export const config = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '30m',
  refreshTokenExpiresInDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || '30'),
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
  maxOtpAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS || '5'),
  maxResendCount: parseInt(process.env.MAX_RESEND_COUNT || '3'),
  resendCooldownSeconds: parseInt(process.env.RESEND_COOLDOWN_SECONDS || '60'),
  emailTokenExpiryHours: parseInt(process.env.EMAIL_TOKEN_EXPIRY_HOURS || '24'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  smsProvider: process.env.SMS_PROVIDER || 'demo',
  emailProvider: process.env.EMAIL_PROVIDER || 'demo',
};
```

---

## Appendix A: Complete Endpoint Reference

### Auth Endpoints (`/api/auth`)

| Method | Endpoint | Rate Limit | Auth Required | Description |
|---|---|---|---|---|
| POST | `/register` | 3/hour | No | Register new customer |
| POST | `/login` | 5/15min | No | Login (returns JWT) |
| GET | `/captcha` | None | No | Get math challenge |
| GET | `/verify-email` | None | No | Verify email (click link) |
| POST | `/resend-email-verification` | 3/15min | No | Resend verification email |
| POST | `/send-phone-otp` | 3/15min | No | Send phone OTP |
| POST | `/verify-phone` | 5/token | No | Verify phone OTP |
| POST | `/resend-phone-otp` | 3/15min | No | Resend phone OTP |
| POST | `/forgot-password` | 3/hour | No | Send password reset email |
| POST | `/reset-password` | None | No | Reset password with token |
| POST | `/mfa/send-otp` | 1/30s | No | Send MFA OTP (needs tempToken) |
| POST | `/mfa/verify` | 5/15min | No | Verify MFA OTP |
| GET | `/me` | None | Yes | Get current user |
| PUT | `/profile` | None | Yes | Update profile |
| POST | `/change-password` | None | Yes | Change password |
| POST | `/refresh` | None | No | Refresh access token |
| POST | `/logout` | None | No | Revoke refresh token |

### Admin Endpoints (`/api/admin`)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| PUT | `/users/:id/lock` | `user.update` | Lock user account |
| PUT | `/users/:id/unlock` | `user.update` | Unlock user account (clears brute-force) |
| PUT | `/users/:id` | `user.update` | Update user (including mfaEnabled) |
| GET | `/settings` | `setting.read` | List settings |
| PUT | `/settings/:key` | `setting.update` | Update setting value |
| POST | `/settings` | `setting.create` | Create new setting |

### Customer Endpoints (`/api/customer`)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| PUT | `/settings/mfa` | `pet.read` | Toggle customer MFA |

---

## Appendix B: Error Codes Reference

| Code | HTTP Status | Meaning |
|---|---|---|
| `CAPTCHA_REQUIRED` | 400 | CAPTCHA needed (2+ failed attempts) |
| `ACCOUNT_LOCKED` | 423 | Account locked (5+ failed attempts, 30 min) |
| `ACCOUNT_SUSPENDED` | 403 | Account suspended by admin |
| `ACCOUNT_INACTIVE` | 403 | Account inactive |
| `REQUIRES_VERIFICATION` | 403 | Email/phone not verified (non-admin) |
| `MFA_REQUIRED` | 200 | Password OK, MFA OTP needed |
| `OTP_EXPIRED` | 400 | OTP token expired |
| `OTP_MAX_ATTEMPTS` | 400 | Too many OTP attempts |
| `INVALID_OTP` | 400 | Wrong OTP (with remainingAttempts) |
| `SESSION_EXPIRED` | 401 | tempToken expired or invalid |

---

*This document is a complete reference for the PawTag authentication system. When implementing similar systems, use this as a blueprint and adapt the rate limits, expiry times, and security measures to your specific requirements.*
