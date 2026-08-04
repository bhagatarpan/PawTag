# Environment Variables

Reference for all environment variables used by the PawTag platform.

## Required

These must be set for the server to start. In production, missing values cause an immediate startup error.

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_URL` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/pawtag` |
| `JWT_SECRET` | Secret key for JWT signing (use a long random string, min 32 chars) | `your-random-secret-here` |

## Authentication & Sessions

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_ACCESS_EXPIRES_IN` | `30m` | Access token lifetime (short-lived for security) |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | `30` | Refresh token lifetime in days (long-lived for mobile UX) |

## Seed Credentials

Used during database seeding to create initial accounts. Required in production if seeding is run.

| Variable | Default | Description |
|----------|---------|-------------|
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@pawtag.co.nz` | Admin account email |
| `BOOTSTRAP_ADMIN_PASSWORD` | *(random if unset in dev)* | Admin account password |
| `BOOTSTRAP_TEST_EMAIL` | `john@example.com` | Test customer email |
| `BOOTSTRAP_TEST_PASSWORD` | *(random if unset in dev)* | Test customer password |

## Frontend URLs

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | `http://localhost:3000` | Public web app URL (used in emails, CORS) |
| `ADMIN_URL` | `http://localhost:3001` | Admin portal URL |
| `CUSTOMER_URL` | `http://localhost:3002` | Customer portal URL |
| `FINDER_URL` | `http://localhost:3003` | Finder page URL |
| `ALLOWED_ORIGINS` | `localhost:3000-3003` (dev) | Comma-separated CORS allowed origins. Required in production. |

## Payment (Stripe)

| Variable | Default | Description |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | *(demo mode)* | Stripe API secret key. Without this, payments run in demo mode. |

## Email (SMTP)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | `localhost` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Use TLS for SMTP connection |
| `SMTP_USER` | *(empty)* | SMTP username |
| `SMTP_PASS` | *(empty)* | SMTP password |

Without SMTP configured, emails are logged to console in development mode.

## SMS (Twilio)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMS_PROVIDER` | `demo` | `demo` (logs OTP to console) or `twilio` |
| `TWILIO_ACCOUNT_SID` | *(empty)* | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | *(empty)* | Twilio Auth Token |
| `TWILIO_FROM_NUMBER` | *(empty)* | Twilio phone number |

## Admin Notifications

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_ALERT_EMAIL` | *(empty)* | Email address for order alerts, low-stock warnings |

## Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | API server port |
| `NODE_ENV` | `development` | `development`, `staging`, or `production` |

## Verification

| Variable | Default | Description |
|----------|---------|-------------|
| `OTP_EXPIRY_MINUTES` | `10` | OTP validity window |
| `EMAIL_TOKEN_EXPIRY_HOURS` | `24` | Email verification token validity |
| `MAX_OTP_ATTEMPTS` | `5` | Max failed OTP attempts before lockout |
| `MAX_RESEND_COUNT` | `3` | Max OTP resends per window |
| `RESEND_COOLDOWN_SECONDS` | `60` | Cooldown between OTP resends |

## Environment Strategy

| Environment | DB | Stripe | Email | SMS |
|-------------|-----|--------|-------|-----|
| **Local** | Local MongoDB or Atlas free tier | Test mode (`sk_test_...`) | Console logging | `demo` |
| **Staging** | Separate Atlas cluster | Test mode | Real SMTP (staging) | `demo` or Twilio |
| **Production** | Atlas paid tier with backups | Live mode (`sk_live_...`) | Real SMTP (production) | Twilio |
