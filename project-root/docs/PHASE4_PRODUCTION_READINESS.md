# Phase 4 production-readiness pass

This pass closes the remaining issues found in the full-project audit.

## Referral compatibility

- New referral codes are exactly 8 alphanumeric characters.
- Existing 6-16 character referral codes are migrated into either `referralCodes/{code}` or `referralAliases/{code}`.
- Existing advertised codes are therefore resolved without being silently regenerated.
- Collisions are reported and cause the migration to exit non-zero.

Run:

```bash
FIREBASE_SERVICE_ACCOUNT='...' node scripts/migrate-referral-codes.mjs
```

Inspect the JSON output before relying on migrated codes.

## Replay protection

The custom backend already verifies Firebase App Check. The browser API client now requests a limited-use App Check token for replay-protected custom backend requests. Firebase documents `getLimitedUseToken()` as the API intended for non-Firebase backends using replay protection.

Enable replay protection in Firebase App Check only after the updated client is deployed and the legacy client traffic has been drained.

## Tournament settlement

`/api/admin-results` provides an authenticated/App Check/rate-limited settlement endpoint.

It:

- accepts only players already present in the match
- rejects duplicate/unknown players
- requires exactly one first-place result
- requires unique placements
- computes kill earnings from the stored match `killReward`
- awards the stored `reward` to first place
- reads all payout accounts before writing inside the Firestore transaction
- writes one immutable economy ledger entry per player
- writes an idempotent `settlements/{matchId}` record
- transitions the match to `completed`

Double settlement returns the existing settlement rather than paying again.

## Automated checks

CI now runs:

- API syntax checks
- security checks
- client/server boundary check
- production contract tests
- lint
- Vite build
- high-severity dependency audit

The repository still does not contain a generated `package-lock.json` because dependency installation cannot be performed through the GitHub connector in this environment. Before production merge, generate and commit the lockfile locally and switch CI from `npm install` to `npm ci`.

## Final production prerequisites

1. Run the referral-code migration.
2. Verify there are no referral-code collisions.
3. Deploy the limited-use App Check client and enable replay protection.
4. Configure `FIREBASE_SERVICE_ACCOUNT`, `OTP_EMAIL`, and `OTP_PASS` in Vercel.
5. Set the real admin Firebase custom claim.
6. Run the match-secret migration.
7. Deploy the final Firestore/Storage rules.
8. Exercise registration, valid/invalid/self referral, match join, settlement, top-up, withdrawal, and admin approval flows.
9. Confirm the CI contract tests and Vercel deployment are green.
10. Merge only after the above checks pass.
