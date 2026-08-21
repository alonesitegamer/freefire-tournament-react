# Phase 6 — Operations hardening

Phase 6 turns the production codebase from a release candidate into an operable service. It focuses on health/readiness, safe incident handling, observability, rollback discipline, and maintenance.

## Health endpoints

- `GET /api/health` is a lightweight configuration/liveness check.
- `GET /api/ready` verifies the server can initialize Firebase Admin and reach Firestore.
- Both endpoints are non-cacheable and never expose secret values.

Use `/api/ready` for deployment smoke checks and external uptime monitoring. Treat any `503` as a release/incident signal.

## Incident response

1. Check `/api/ready`.
2. Check Vercel runtime errors and deployment status.
3. Check the last successful deployment.
4. If money/economy integrity is uncertain, stop financial approvals first.
5. Roll back to the last verified deployment rather than patching production blindly.
6. Preserve request IDs and ledger IDs when investigating a transaction.

## Financial safety

- Never edit `users.coins` directly in the Firebase console during an incident.
- Never delete `economyLedger`, `settlements`, `topupRequests`, or `withdrawRequests` to hide a bad transaction.
- Corrections should be represented as compensating ledger events through a trusted server operation.

## Migration discipline

Before every production data migration:

1. Run against a backup/export or a staging copy first.
2. Record counts before/after.
3. Stop on collisions.
4. Keep the migration idempotent.
5. Do not mix migrations with unrelated feature changes.

## Observability

Production logs must not contain:

- OTP codes
- Firebase service account contents
- ID tokens
- App Check tokens
- UPI credentials/passwords
- full payment secrets

Log identifiers, event types, outcome, and safe correlation data instead.

## Maintenance

- Keep a committed `package-lock.json` and use `npm ci` in CI/deploy builds.
- Run `npm audit --audit-level=high` on every protected branch.
- Update unsupported dependencies in a separate dependency-maintenance PR.
- Keep the production-readiness smoke-test matrix in sync with every money/economy feature.
