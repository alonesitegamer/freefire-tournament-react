# Phase 5 — Production release gate

Phase 5 is the final code-side release gate. It does not mutate production data and it does not claim Firebase Console configuration or migrations have happened.

## Automatic checks

CI runs:

1. `npm run check:release`
2. `npm run check:security`
3. `npm run check:client-boundary`
4. `npm test`
5. `npm run lint`
6. `npm run build`
7. `npm audit --audit-level=high`

The strict local gate is:

```bash
npm run release:gate
```

The strict gate intentionally fails until `package-lock.json` is committed.

## Production health

After deployment, check:

```text
GET /api/health
```

A healthy response must be HTTP 200 and report Firebase Admin and OTP as configured. The endpoint does not return secret values.

## Required one-time migrations

Run these from a trusted environment with the production Firebase service account:

```bash
node scripts/migrate-match-secrets.mjs
node scripts/migrate-referral-codes.mjs
```

Inspect their output for collisions before enforcing any final data assumptions.

## Required production configuration

Verify in Vercel/Firebase:

- `FIREBASE_SERVICE_ACCOUNT`
- `OTP_EMAIL`
- `OTP_PASS`
- Firebase Auth admin custom claim for the real admin UID
- App Check production site key
- App Check enforcement/replay protection appropriate for the custom APIs
- final Firestore rules
- final Storage rules

## Smoke-test matrix

Run as a real user/admin test pair, not only as static tests:

### Identity

- register with OTP
- wrong OTP rejected
- sixth OTP attempt rejected
- expired OTP rejected
- duplicate registration handled

### Referral

- no referral → welcome reward once
- valid canonical referral → referred user +20 / referrer +20
- valid legacy referral alias → same payout
- self referral → no referrer payout
- duplicate request → no second payout
- concurrent redemption → exactly one payout

### Match lifecycle

- upcoming match visible
- non-participant cannot see room credentials
- joined participant sees credentials only after reveal time
- duplicate join rejected
- full match rejected
- match result settlement pays exactly once
- duplicate settlement rejected
- payout ledger entry exists for every payout

### Money lifecycle

- top-up request created once per idempotency key
- admin approval credits exactly once
- withdrawal reserves balance atomically
- rejected withdrawal refunds exactly once
- approved withdrawal does not refund
- insufficient balance rejected

### Security

- unauthenticated API calls rejected
- missing/invalid App Check rejected
- non-admin admin API rejected
- direct Firestore client reads/writes denied according to final rules
- Storage client writes denied until a validated upload policy exists

## Merge rule

Do not merge the production branch until:

- Phase 5 Vercel deployment is READY
- GitHub Actions is green
- the package lock is committed
- the two Firebase migrations have been executed and reviewed
- production environment variables and custom claims are verified
- `/api/health` returns 200
- the smoke-test matrix passes

A green Vercel build alone is not sufficient evidence of production readiness.
