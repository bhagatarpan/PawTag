# Source of Truth, Plan Precedence, and Conflict Rules

## Runtime truth hierarchy

When two sources disagree:

1. Security/data-integrity invariants and observed provider/runtime behavior
2. Current source code + configuration + migrations/index definitions
3. Executed tests and reproducible validation evidence
4. Root `AGENTS.md`
5. Current phase file from this execution pack
6. Relevant repository skills
7. Current README/docs
8. Historical plans/status reports

A historical document claiming “Complete” never overrides current code or missing runtime evidence.

## Superseded guidance

The following ideas are superseded:

- Building/maintaining a separate React Native customer product UI as the long-term mobile architecture.
- Building a Finder native app.
- Building an Admin mobile app in the current MVP.
- Treating `MVP_IMPLEMENTATION_STATUS.md` as proof of real-device, staging, provider, or launch validation.
- Big-bang MongoDB→DynamoDB replacement.
- Building donations directly against Mongoose if the repository/persistence boundary is available or being introduced.

## Current strategic decisions

### Customer mobile

`apps/web` becomes the customer UI source used by browser and installed iOS/Android shell. Capacitor provides packaging/native bridges. The current Expo application is reference code during migration and may be removed only after parity evidence exists.

### Finder

`apps/finder` stays browser-only. Do not deep-link public Finder tag URLs into the customer app.

### Admin

Desktop web only in current MVP.

### Database

Incremental domain-by-domain migration, access-pattern first, repository interfaces, DynamoDB Local + real AWS integration environment, explicit cutover/rollback.

### Donations

Distinct financial domain with independent receipt semantics. Reuse platform primitives, not business meaning. NZ tax/donee claims are externally gated.

## Autonomous decision policy

The agent should make reasonable implementation decisions without repeatedly stopping the non-technical founder for choices that can be safely resolved from code, current product direction, or conservative engineering practice.

The agent must stop for real external decisions only when they materially affect:

- legal/tax/accounting classification;
- irreversible production data migration;
- customer money/refund policy where no existing rule exists;
- public privacy exposure;
- store payment policy interpretation that changes product monetization;
- production credentials/access that are not available;
- a destructive cutover with no rollback path.
