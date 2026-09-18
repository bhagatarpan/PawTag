# Finder Privacy Retention Policy

> This document describes the technical retention policy for Finder data in PawTag.
> It should be reviewed with a privacy/legal professional before production launch.

## Overview

PawTag collects sensitive finder data during pet recovery. This data must be retained only as long as necessary for:
- Active incident resolution
- Operational audit
- Legal compliance

## Data Collected

### FinderScan Records

| Field | Sensitivity | Purpose | Retention |
|-------|-------------|---------|-----------|
| `finderPhone` | High | Contact owner | Anonymize 30 days after resolution |
| `finderEmail` | High | Contact owner | Anonymize 30 days after resolution |
| `finderName` | Medium | Contact owner | Anonymize 30 days after resolution |
| `gpsLocation` | High | Share with owner | Anonymize 30 days after resolution |
| `ipLocation` | Medium | Approximate location | Anonymize 90 days |
| `deviceInfo` | Low | Analytics | Anonymize 90 days |
| `consent` | Medium | Legal compliance | Retain 1 year |

### LocationEvent Records

| Field | Sensitivity | Purpose | Retention |
|-------|-------------|---------|-----------|
| `location` | High | Track pet location | Anonymize 30 days |

### EscalationRecord Records

| Field | Sensitivity | Purpose | Retention |
|-------|-------------|---------|-----------|
| `finderPhone` | High | Emergency contact | Anonymize 30 days after resolution |
| `finderEmail` | High | Emergency contact | Anonymize 30 days after resolution |
| `finderName` | Medium | Emergency contact | Anonymize 30 days after resolution |
| `scanLocation` | High | Incident location | Anonymize 30 days after resolution |

## Anonymization Strategy

Rather than deleting records (which can break references and audit trails), PawTag **anonymizes** sensitive fields:

- Phone numbers → `[anonymized]`
- Email addresses → `[anonymized]`
- Names → `[anonymized]`
- GPS coordinates → removed (set to null)
- IP addresses → `[anonymized]`

This preserves:
- Aggregate analytics (scan counts, device types)
- Audit trail integrity (references remain valid)
- Operational history (what happened, when)

## Cleanup Job

The `privacyRetention` job runs daily and:

1. Finds resolved escalation records older than 30 days
2. Anonymizes finder contact info and GPS locations
3. Anonymizes IP locations older than 90 days
4. Anonymizes device info older than 90 days
5. Anonymizes old escalation records (1 year)
6. Anonymizes old location events (30 days)

### Configuration

Retention periods are configured in `packages/api/src/jobs/privacyRetention.ts`:

```typescript
export const RETENTION_CONFIG = {
  finderContactRetentionDays: 30,
  gpsLocationRetentionDays: 30,
  ipLocationRetentionDays: 90,
  deviceInfoRetentionDays: 90,
  consentRetentionDays: 365,
  escalationRetentionDays: 365,
};
```

## Legal Considerations

This policy should be reviewed for compliance with:
- New Zealand Privacy Act 2020
- GDPR (if EU users are expected)
- Any applicable health/safety regulations for pet recovery

Key principles:
1. **Data minimization**: Only collect what's needed
2. **Purpose limitation**: Only use for stated purpose
3. **Storage limitation**: Don't keep longer than necessary
4. **Integrity and confidentiality**: Protect with appropriate security

## Implementation Notes

- Anonymization is irreversible by design
- Records are not deleted to preserve audit trails
- Active incidents (status: 'pending') are never anonymized
- The cleanup job is idempotent — running it multiple times is safe
- All cleanup actions are logged for operational visibility
