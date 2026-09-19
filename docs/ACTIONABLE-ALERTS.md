# Actionable Alerts Runbook

> Define alerts for critical conditions that require human action.
> Logging/Sentry/OTel hooks are useful only if someone acts on them.
>
> Last updated: 2026-09-19

## Alert Principles

1. **Every alert must have an owner** — Someone must be responsible for responding
2. **Every alert must have a response path** — Know what to do when it fires
3. **Avoid noise** — Dozens of unactionable alerts dilute critical ones
4. **Alert on symptoms, not causes** — Alert when customers are affected, not when CPU is at 80%

---

## Critical Alerts (Immediate Response Required)

### 1. Stripe Webhook Verification Failures Spike

| Attribute | Value |
|---|---|
| **Condition** | >5 webhook verification failures in 5 minutes |
| **Severity** | P1 — Critical |
| **Impact** | Payments may not be processed, orders may not be created |
| **Owner** | Founder / On-call engineer |
| **Response** | Check Stripe dashboard for failed webhooks. Verify STRIPE_WEBHOOK_SECRET is correct. Check API logs for signature errors. |
| **Runbook** | `docs/disaster-recovery.md` Scenario 3 |

### 2. Paid PaymentIntent Without Completed Order

| Attribute | Value |
|---|---|
| **Condition** | PaymentIntent succeeded but no Order created within 5 minutes |
| **Severity** | P1 — Critical |
| **Impact** | Customer charged but no order — potential revenue loss and customer frustration |
| **Owner** | Founder / On-call engineer |
| **Response** | Check orphan payment detection job logs. Manually verify payment in Stripe. Create order if missing. Notify customer. |
| **Runbook** | `docs/disaster-recovery.md` Scenario 1 |

### 3. Database Unavailable

| Attribute | Value |
|---|---|
| **Condition** | MongoDB connection fails for >1 minute |
| **Severity** | P1 — Critical |
| **Impact** | All API requests fail — complete service outage |
| **Owner** | Founder / On-call engineer |
| **Response** | Check MongoDB Atlas status. Verify connection string. Check IP whitelist. If cluster is down, follow disaster recovery. |
| **Runbook** | `docs/disaster-recovery.md` Scenario 4 |

---

## High-Priority Alerts (Response Within 1 Hour)

### 4. Checkout Confirmation Errors Spike

| Attribute | Value |
|---|---|
| **Condition** | >3 checkout confirmation errors in 10 minutes |
| **Severity** | P2 — High |
| **Impact** | Customers unable to complete purchases |
| **Owner** | Founder / On-call engineer |
| **Response** | Check Stripe dashboard for payment issues. Verify API logs. Check for database locks. Test checkout flow manually. |

### 5. Refund Repair Required

| Attribute | Value |
|---|---|
| **Condition** | Refund reconciliation job finds discrepancies |
| **Severity** | P2 — High |
| **Impact** | Customer refunds may not be processed correctly |
| **Owner** | Founder / On-call engineer |
| **Response** | Check refund reconciliation job logs. Verify refund status in Stripe. Manually process if needed. |

### 6. Finder Notify Errors Spike

| Attribute | Value |
|---|---|
| **Condition** | >3 Finder notification errors in 10 minutes |
| **Severity** | P2 — High |
| **Impact** | Pet owners may not be notified when their pet is found |
| **Owner** | Founder / On-call engineer |
| **Response** | Check Finder route logs. Verify email/SMS delivery. Test Finder flow manually. |

### 7. Worker Job Repeatedly Failing

| Attribute | Value |
|---|---|
| **Condition** | Same job fails >3 times consecutively |
| **Severity** | P2 — High |
| **Impact** | Background processing may be stuck |
| **Owner** | Founder / On-call engineer |
| **Response** | Check worker logs. Identify failing job. Check external service status. Restart worker if needed. |

---

## Medium-Priority Alerts (Response Within 24 Hours)

### 8. Email/SMS/Push Delivery Failure Spike

| Attribute | Value |
|---|---|
| **Condition** | >5 delivery failures in 1 hour |
| **Severity** | P3 — Medium |
| **Impact** | Notifications not reaching customers |
| **Owner** | Founder |
| **Response** | Check provider status (Resend, Twilio, Firebase). Verify API keys. Check for rate limiting. |

### 9. API Error Rate Severe

| Attribute | Value |
|---|---|
| **Condition** | >10% error rate (5xx) for 5 minutes |
| **Severity** | P3 — Medium |
| **Impact** | Degraded service quality |
| **Owner** | Founder |
| **Response** | Check API logs for errors. Identify failing endpoints. Check database and external service status. |

### 10. API Latency Severe

| Attribute | Value |
|---|---|
| **Condition** | p95 latency >5 seconds for 5 minutes |
| **Severity** | P3 — Medium |
| **Impact** | Slow response times affecting user experience |
| **Owner** | Founder |
| **Response** | Check database queries. Identify slow endpoints. Check for resource contention. |

---

## Low-Priority Alerts (Response Within 1 Week)

### 11. Disk/Storage Provider Failures

| Attribute | Value |
|---|---|
| **Condition** | R2/storage upload failures >3 in 1 day |
| **Severity** | P4 — Low |
| **Impact** | File uploads may fail |
| **Owner** | Founder |
| **Response** | Check R2/storage provider status. Verify credentials. Check disk space if using local storage. |

### 12. External Service Degraded

| Attribute | Value |
|---|---|
| **Condition** | External service (Stripe, email, SMS) responding slowly or with errors |
| **Severity** | P4 — Low |
| **Impact** | Dependent features may be slow or unavailable |
| **Owner** | Founder |
| **Response** | Check provider status pages. Implement graceful degradation if possible. |

---

## Alert Configuration

### Sentry Alerts

Configure in Sentry dashboard:

1. **Stripe webhook failures** — Alert on `stripe-webhook-error` events
2. **Checkout errors** — Alert on `checkout-confirmation-error` events
3. **Finder errors** — Alert on `finder-notify-error` events

### Database Alerts

Configure in MongoDB Atlas:

1. **Connection failures** — Alert when connections drop below threshold
2. **Replication lag** — Alert when lag exceeds 10 seconds
3. **Storage usage** — Alert when usage exceeds 80%

### Application Alerts

Configure via logging/monitoring:

1. **Job failures** — Alert on repeated job failures
2. **Error rate** — Alert on elevated 5xx rate
3. **Latency** — Alert on elevated p95 latency

---

## Alert Response Template

When an alert fires:

```
[ALERT] <alert-name>

Severity: <P1/P2/P3/P4>
Time: <timestamp>
Condition: <what triggered the alert>
Impact: <what is affected>
Owner: <who is responsible>

Immediate actions:
1. <action 1>
2. <action 2>
3. <action 3>

Status: Investigating / Identified / Mitigated / Resolved
```

---

## Alert Review Process

1. **Weekly**: Review alert history, adjust thresholds if too noisy
2. **Monthly**: Review alert effectiveness, add/remove as needed
3. **After incidents**: Add alerts for conditions that were not caught

---

## Related Documents

- `docs/JOB-ERROR-POLICY.md` — Background job error handling
- `docs/disaster-recovery.md` — Disaster recovery procedures
- `docs/ROLLBACK-PROCEDURE.md` — Rollback procedures
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
