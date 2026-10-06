# Master Dependency Map

## Default path

```text
00 Evidence reset
      |
01 Production safety/providers
      |
02 Financial state integrity
      |
03 Communications/docs/auth
      |
04 Premium Cart/Checkout/customer web
      |
05 Finder web recovery
      |
06 Admin/workers/deployment/observability
      |
07 Browser E2E + staging + first controlled web customer
      |
08 Shared mobile-responsive/app-aware web
      |
09 Capacitor shell + native bridges
      |
10 iOS/Android real-device/store gate
      |
11 DynamoDB discovery only
      |
12 DynamoDB boundary + low-risk migration
      |
13 DynamoDB high-risk migration/cutover
      |
14 Donation legal/architecture gate
      |
15 Donation one-time core
      |
16 Donation recurring/receipts/portals/admin
      |
17 Donation reconciliation/public launch
      |
18 System-wide final reconciliation
```

## Parallel owner actions that should start early

These can proceed while engineering phases run:

- create/secure AWS account, MFA, budget alarms, non-production IAM identity;
- Apple Developer / App Store Connect setup;
- Google Play Console setup;
- confirm app identifiers, privacy URLs, support URLs;
- confirm whether PawTag is or will be an approved NZ donee organisation;
- obtain/confirm legal entity name, IRD number, Charities Services number if applicable;
- obtain accountant/legal review for donation/GST/receipt/refund wording;
- confirm digital Gold/membership store-payment approach before iOS/Android public release.

## Hard dependencies

- Premium Cart/Checkout must use authoritative server financial state from Phases 01–03.
- Capacitor app must reuse the corrected customer web experience from Phase 04.
- Store release cannot precede physical-device tests in Phase 10.
- DynamoDB implementation cannot precede discovery/access-pattern design in Phase 11.
- High-risk DynamoDB migration cannot precede low-risk repository/infrastructure proof in Phase 12.
- Donation implementation cannot claim NZ tax-credit eligibility until external legal/tax inputs are confirmed.
- Donation financial code should not be directly tied to Mongoose; it depends on a repository contract or established target persistence adapter.

## Deliberate non-dependencies

- First controlled web customer does not require DynamoDB.
- First controlled web customer does not require Donations.
- Finder recovery does not require a native app.
- Admin operations do not require a native app.
- Mobile store app does not require duplicated Cart/Checkout code.
