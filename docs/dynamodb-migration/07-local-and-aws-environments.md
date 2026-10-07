# Phase 11 — Local and AWS Environments

## Decisions locked (founder Option A)

| Item | Value |
|---|---|
| First customer channel | Website only (browser) |
| MongoDB | Stays authoritative for first customers |
| AWS region | **ap-southeast-2** |
| AWS project | PawTag (founder account) |
| DynamoDB start | Discovery now; cutovers after staging |

## Development (Phase 12+)

| Component | Purpose |
|---|---|
| **DynamoDB Local** | Free local DB via Docker; unit/integration without AWS bill |
| Test env vars | `DYNAMODB_ENDPOINT=http://localhost:8000`, `AWS_ACCESS_KEY_ID=test`, `AWS_SECRET_ACCESS_KEY=test`, `AWS_REGION=ap-southeast-2` |
| Separate table names | `pawtag-dev-*` vs `pawtag-staging-*` vs `pawtag-prod-*` |

## Staging / AWS non-prod (founder)

Before Phase 12 code that writes DynamoDB:

1. In AWS Console → **IAM** → create user e.g. `pawtag-dynamodb-dev`  
2. Attach **AmazonDynamoDBFullAccess** (non-prod only; tighten later)  
3. Create **access key** + secret  
4. Store only in local `.env` (never Git, never web app)  
5. Create DynamoDB tables in **ap-southeast-2** with `pawtag-dev-` prefix (or let IaC create them)

### Example env (server only — do not commit)

```bash
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
DYNAMODB_ENDPOINT=          # empty = real AWS; or http://localhost:8000 for local
DYNAMODB_TABLE_PREFIX=pawtag-dev-
```

## What Phase 11 needs from AWS

**Nothing yet.** Discovery is code + docs.  
DynamoDB Local + IAM keys are required when Phase 12 starts writing.

## Security rules

- Never expose AWS keys to `apps/web`, `apps/admin`, `apps/finder`, mobile  
- Never log secrets  
- Prefer least-privilege IAM before production  
- Production DynamoDB credentials only on API/worker hosts

## Frontend remains database-agnostic

All apps continue to call HTTP APIs. No DynamoDB SDK in browser code.
