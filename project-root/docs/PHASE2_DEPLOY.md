# Phase 2 server-authoritative hardening

Phase 2 builds on Phase 1 and focuses on data exposure, privileged CRUD, and server-owned match secrets.

## What changed

- `/api/matches` returns a sanitized match projection and only returns room credentials after server-side membership + reveal-time checks.
- `/api/admin-matches` owns match creation, editing, and deletion behind Firebase Auth custom claims + App Check + rate limiting.
- `/api/referral` provides transactional welcome/referral onboarding.
- `matchSecrets/{matchId}` is a server-only collection. Room ID/password should no longer live in public `matches` documents.
- `scripts/migrate-match-secrets.mjs` migrates existing room credentials out of `matches`.
- Firestore user reads are private by default; only the owner or an admin can read a user document.
- Profile fields are validated by type/length/path in Firestore Rules.
- Vercel adds baseline security headers and disables API caching.
- CI now runs API syntax checks, security-script checks, lint, build, and a high-severity dependency audit.

## Required migration

Before removing the temporary signed-in read access to `matches`, run:

```bash
FIREBASE_SERVICE_ACCOUNT='...' node scripts/migrate-match-secrets.mjs
```

Verify that every existing match has its room credentials in `matchSecrets/{matchId}` and that the original `roomID` / `roomPassword` fields have disappeared from `matches`.

After verification, change the `matches` rule from:

```text
allow get, list: if signedIn();
```

to:

```text
allow get, list: if false;
```

At that point all client match reads must use `/api/matches`.

## Admin match API

- `GET /api/admin-matches`
- `POST /api/admin-matches`
- `PATCH /api/admin-matches?matchId=<id>`
- `DELETE /api/admin-matches?matchId=<id>`

Every operation requires a Firebase ID token whose custom claims contain `admin: true`, plus a valid Firebase App Check token.

Deletion is refused once a match has players. Cancel instead of deleting joined matches.

## Referral onboarding

`POST /api/referral` is available after Firebase Authentication has created the user. It performs the initial welcome/referral reward atomically and prevents self-referrals, duplicate claims, and non-zero-balance reclaims.

The existing Login/Dashboard registration path still contains legacy client-side onboarding writes for compatibility. Do not remove the temporary `users.create` allowance until the registration UI is migrated to the server onboarding endpoint.

## Ad rewards

Client-side simulated ad rewards remain disabled server-side. Phase 2 does not treat a browser timer as proof of an ad impression. A real ad provider callback/S2S verification must be integrated before coin rewards are enabled.

## Verification checklist

- [ ] Configure `FIREBASE_SERVICE_ACCOUNT` in a trusted environment.
- [ ] Confirm the production web App Check site key is configured.
- [ ] Run `npm run check:security`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm audit --audit-level=high` and resolve high/critical findings.
- [ ] Run `migrate-match-secrets.mjs` once.
- [ ] Verify room credentials are absent from `matches`.
- [ ] Verify direct `matchSecrets` reads fail.
- [ ] Verify a non-admin receives 403 from `/api/admin-matches`.
- [ ] Verify a signed-in non-member cannot obtain room credentials from `/api/matches`.
- [ ] Verify a joined user still cannot obtain room credentials before `revealAt`.
- [ ] Verify the same user can obtain room credentials after `revealAt`.
- [ ] Verify user A cannot read user B's Firestore profile directly.
- [ ] Verify admin match deletion fails when players are already joined.
