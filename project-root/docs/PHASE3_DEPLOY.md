# Phase 3 production finalization

Phase 3 removes direct browser access to Firestore application data. The React client now treats API endpoints as the application boundary and Firebase Admin SDK as the authoritative data layer.

## Architecture after Phase 3

```text
React client
  │
  ├── Firebase Auth (identity only)
  └── /api/*
        │
        ├── Firebase ID token validation
        ├── App Check validation
        ├── rate limits
        ├── input validation
        └── Firebase Admin SDK
              │
              └── Firestore
```

## Important deployment steps

1. Deploy the current Firestore and Storage rules. Browser Firestore access is intentionally denied.
2. Run `node scripts/migrate-match-secrets.mjs` from a trusted environment before deleting any legacy room credentials from the old `matches` documents.
3. Confirm the Vercel environment contains `FIREBASE_SERVICE_ACCOUNT`, `OTP_EMAIL` and `OTP_PASS`.
4. Confirm the Firebase Auth custom admin claim is set for the actual administrator UID.
5. Verify Firebase App Check is registered for the production hostname and that the backend verifier can validate tokens.
6. Deploy Vercel and wait for the Security CI workflow to pass.

## Account onboarding

The client no longer creates the Firestore user profile. Email registration verifies OTP first, creates Firebase Auth, then calls `/api/referral`. The server creates the profile if needed and awards the one-time welcome/referral bonus transactionally.

Google sign-in uses the same server onboarding endpoint, so there is one source of truth for initial account state.

## Daily reward and ads

Daily reward is server-side through `/api/economy` and is transactionally protected.

Ad rewards are intentionally disabled. The previous simulated timer is gone. Do not re-enable coin/XP rewards until the ad provider can send a server-verifiable completion signal to a trusted endpoint. Never treat a client timer or callback alone as proof of an impression.

## Match access

The browser no longer reads the `matches` collection. `/api/matches` returns sanitized public data and conditionally reveals room credentials only after the server determines that the authenticated player is entitled to them and the reveal time has passed.

Room credentials belong in `matchSecrets/{matchId}`. The collection is server-only.

## Admin access

Admin match CRUD and queue reads run through `/api/admin-matches` and `/api/admin-queue` and require both the admin custom claim and App Check.

## Verification checklist

- [ ] New email registration: OTP -> Auth user -> `/api/referral` -> profile + welcome reward.
- [ ] Existing email registration cannot create a duplicate Auth user.
- [ ] Invalid/expired OTP is rejected and the attempt limit works.
- [ ] Daily reward can only be claimed once per 24 hours.
- [ ] Ad reward returns unavailable instead of crediting coins.
- [ ] Match listing works without client Firestore reads.
- [ ] Joining a match still succeeds under concurrent load.
- [ ] Room credentials remain hidden before reveal time.
- [ ] Room credentials are not present in normal match API responses.
- [ ] User profile updates only modify the four allowed profile fields.
- [ ] Feedback is rate limited and authenticated.
- [ ] Non-admin users receive 403 from admin endpoints.
- [ ] Direct Firestore reads/writes from the browser fail.
- [ ] `npm run check:security` passes.
- [ ] `npm run check:client-boundary` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `npm audit --audit-level=high` passes.
