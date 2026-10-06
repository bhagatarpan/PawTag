# Copy/Paste Prompt — Execute One DynamoDB Domain Migration Packet

Execute only the named DynamoDB domain packet from the approved Phase 11/12/13 migration documents.

For `<DOMAIN>`:

- confirm documented access patterns/callers first;
- preserve API contracts and application IDs;
- implement/verify repository interface and both current/target adapters as required;
- do not expose DynamoDB types to services;
- design keys/indexes from access patterns;
- implement conditional/transaction behavior required for concurrency;
- migrate with dry-run/resume/idempotency;
- compare normalized domain representations;
- run ownership/security tests;
- run failure injection for concurrent/financial/job domains;
- record current source of truth, cutover step, rollback trigger, reconciliation requirement;
- do not migrate a second domain automatically;
- stop after evidence is recorded.
