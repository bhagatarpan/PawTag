# Copy/Paste Prompt — Execute One Donation Work Packet

Execute only the requested donation packet from Phases 14–17.

Before coding:

- read `skills/donation-domain/SKILL.md`, `commerce-safety`, `stripe-integration`, `financial-document-integrity`, `security-boundary-review`, and `testing-regression` as relevant;
- inspect current PawTag identity, Stripe, webhook, document/PDF, email, portal, admin, audit, worker, and persistence implementations;
- confirm external legal/accounting values from the approved configuration/status file; never invent them.

Financial rules:

- server-authoritative amount/currency/frequency;
- provider/webhook authoritative payment state;
- idempotent creation/subscription/webhook/refund/receipt;
- immutable issued receipts;
- no financial deletion;
- no account enumeration;
- ownership/RBAC enforced server-side;
- no tax-credit claim unless approved donee/tax configuration explicitly permits it.

Implement, test, report evidence, and stop after the packet.
