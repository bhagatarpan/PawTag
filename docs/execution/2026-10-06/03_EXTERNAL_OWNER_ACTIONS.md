# Business Owner / External Actions

This file contains the few tasks an AI coding agent cannot safely decide or complete alone.

## A. AWS / DynamoDB

Before real AWS integration testing:

- [ ] AWS account exists.
- [ ] Root account MFA enabled.
- [ ] Founder/admin identity exists; root account is not used for normal work.
- [ ] Billing budget/alerts configured.
- [ ] Non-production PawTag AWS environment/account/profile exists.
- [ ] Agent/developer credentials are least-privilege and non-production.
- [ ] Production credentials are separate.

Do not give an AI agent root AWS credentials.

## B. iOS / Android

- [ ] Apple Developer account active.
- [ ] App Store Connect access available.
- [ ] Google Play Console access available.
- [ ] Final customer app display name approved.
- [ ] iOS bundle ID approved.
- [ ] Android application ID approved.
- [ ] Support URL and privacy-policy URL ready.
- [ ] App icon/splash assets approved.
- [ ] At least one physical iPhone and one physical Android/NFC device available for validation.

### Digital membership payment decision

Before store release, obtain a current store-policy/product decision for Gold/digital membership purchase inside the app. Physical PawTag products may use the normal commerce path, but digital entitlement/subscription rules can differ.

## C. Donation legal/accounting gate

The coding agent must not invent these answers:

- [ ] PawTag legal organisation name. — **BLOCKED_EXTERNAL** (engineering uses config default `PawTag` until you set the legal name)
- [ ] NZ IRD number to appear on receipt, if applicable. — **BLOCKED_EXTERNAL**
- [ ] Charities Services registration number/status, if applicable. — **BLOCKED_EXTERNAL**
- [ ] Approved-donee status: NOT_ENABLED / PENDING_APPROVAL / APPROVED_DONEE / SUSPENDED. — **BLOCKED_EXTERNAL**
- [ ] Accountant/tax adviser confirms donation vs sponsorship classification. — **BLOCKED_EXTERNAL**
- [ ] Accountant confirms GST/accounting treatment. — **BLOCKED_EXTERNAL**
- [ ] Legal/accounting review confirms tax-credit wording. — **BLOCKED_EXTERNAL**
- [ ] Legal/accounting review confirms receipt fields/signatory requirements. — **BLOCKED_EXTERNAL**
- [ ] Refund policy and effect on donation receipts/tax claims reviewed. — **BLOCKED_EXTERNAL**
- [ ] Data retention period for donation financial records approved. — **BLOCKED_EXTERNAL**

Until confirmed, the product must not promise an IRD donation tax credit.  
Phase 14 architecture allows **neutral** configurable receipt wording only.

## D. Production provider access

Before final public release, scoped production access/configuration must exist for applicable providers:

- Stripe live account/webhook;
- Resend transactional email;
- R2/object storage;
- shipping/NZ Post or explicit manual-fulfilment mode;
- push provider for Capacitor app;
- monitoring/Sentry/OTel endpoints;
- domain/DNS/TLS configuration.
