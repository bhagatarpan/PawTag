# Phase 11 — Risk Register

| ID | Risk | Severity | Domain | Mitigation |
|---|---|---|---|---|
| R1 | Overselling inventory on concurrent checkout | Critical | Commerce | Conditional writes + concurrency tests (Phase 02 pattern on DynamoDB) |
| R2 | Double-spend PawRewards | Critical | Rewards | Unique RES item + conditional balance/reserved |
| R3 | Duplicate orders/invoices | Critical | Commerce | Unique orderNumber/invoiceNumber + counter items |
| R4 | Stripe webhook double-processing | Critical | Webhooks | Unique source+eventId; retry lease |
| R5 | Free membership activation | Critical | Membership | Stripe status gate before local active (Phase 03) |
| R6 | Finder public tag miss | Critical | Recovery | GSI on public tagId; integration tests |
| R7 | PII leakage from FinderScan | High | Privacy | Retention jobs; minimal public DTO (already) |
| R8 | Hot partition on scans/logs | Medium | Ops | Shard SK by tag/date; avoid Scan |
| R9 | TTL deletes PendingOrder before stock release | High | Commerce | Keep expiry job; longer TTL safety net |
| R10 | Populate-heavy admin queries break | Medium | Admin | Repository multi-get / denormalize lists |
| R11 | Regex admin search unavailable | Medium | Admin | GSI equality filters; optional OpenSearch later |
| R12 | Dual-write money divergence | Critical | All money | Never dual-write money without authority flip plan |
| R13 | Credential leak to browser | Critical | Security | Keys only server env; never web bundles |
| R14 | ID format change breaks clients | High | API | Preserve Mongo IDs as strings |
| R15 | First customer blocked on DynamoDB | High | Product | **Do not** gate web launch on DynamoDB |
| R16 | Phase 10 store confusion | Medium | Mobile | Web first; store later |

## Residual after Phase 11

All risks above are **design-level**. Implementation evidence required in Phase 12–13 + staging.
