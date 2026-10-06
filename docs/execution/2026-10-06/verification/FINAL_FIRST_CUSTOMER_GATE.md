# Final First-Customer Gate — Core PawTag

This gate applies to the controlled first real PawTag customer. DynamoDB, Donations, and public store app are separate unless explicitly included in launch scope.

## Security/auth
- [ ] login/refresh/MFA/logout/reset proven;
- [ ] browser refresh token not exposed to localStorage under intended design;
- [ ] object ownership negative tests pass;
- [ ] admin RBAC high-risk actions pass;
- [ ] production secrets/config fail closed.

## Finder web
- [ ] public tag works in browser without app/account;
- [ ] public DTO minimal;
- [ ] notify owner works in production-like abuse-control mode;
- [ ] denied location and weak network recover;
- [ ] duplicate submission controlled;
- [ ] retention/privacy cleanup defined/proven.

## Commerce
- [ ] server-authoritative quote/totals/shipping;
- [ ] rewards/promo concurrency safe;
- [ ] inventory reserve/confirm/release safe;
- [ ] abandoned checkout cleanup releases reservations;
- [ ] payment/order idempotency/recovery;
- [ ] Stripe signed webhook/retry/reconciliation;
- [ ] zero-total path if business allows it;
- [ ] no fake/demo success in production;
- [ ] refunds/returns/cancellation state correct.

## UX
- [ ] premium `/cart` 8/4 desktop + intentional mobile;
- [ ] Delivery/Review/Payment persistent 8/4 checkout shell;
- [ ] loading/empty/error/success/price/inventory states;
- [ ] keyboard/accessibility checks;
- [ ] real-person desktop + phone-browser UX test.

## Communications/docs
- [ ] order confirmation delivered;
- [ ] invoice available/emailed securely;
- [ ] refund/cancel communications correct;
- [ ] subscription entitlement/email only after authoritative state;
- [ ] critical email failures retry/alert.

## Operations
- [ ] worker/job ownership/idempotency proven;
- [ ] production Docker/build/env validation;
- [ ] monitoring alerts tested;
- [ ] backup restore rehearsal executed;
- [ ] rollback rehearsal documented/tested;
- [ ] staging dress rehearsal complete.

## Automated gate
- [ ] typecheck
- [ ] lint where applicable
- [ ] unit
- [ ] integration
- [ ] regression
- [ ] smoke
- [ ] build
- [ ] critical Playwright E2E

**Launch decision:** `READY | BLOCKED | CONTROLLED_PILOT_ONLY`  
**Evidence date:**  
**Approved by:**
