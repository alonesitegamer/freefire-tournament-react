# Phase 1 production hardening

This branch moves money/economy mutations behind authenticated server endpoints and locks Firestore/Storage writes down to explicit roles.

## Required Vercel environment variables

Set these in the production environment. Never commit the values:

- `FIREBASE_SERVICE_ACCOUNT`: JSON service account used by the Admin SDK.
- `OTP_EMAIL`: mailbox used to send registration OTPs.
- `OTP_PASS`: SMTP/Gmail app password for that mailbox.

The existing client Firebase config is not a server secret. The service account is.

## Required Firebase setup

1. Deploy `firestore.rules` and `storage.rules` from this directory.
2. Register the production web app's App Check reCAPTCHA v3 site key in Firebase.
3. Keep App Check enforcement enabled for the Firebase services used by the app after validating production traffic.
4. Grant the Firebase App Check Token Verifier role to the server identity if replay protection is enabled for a custom backend endpoint.

## Admin authorization

Admin access is no longer based on a browser-visible email comparison. Set the Firebase Auth custom claim for the real admin UID from a trusted environment:

```bash
FIREBASE_SERVICE_ACCOUNT='...' node scripts/set-admin.mjs <ADMIN_FIREBASE_UID>
```

The admin must sign out/in or refresh the ID token after the claim is granted.

## Economy API

`/api/economy` requires:

- a non-expired, non-revoked Firebase ID token in `Authorization: Bearer ...`
- a valid Firebase App Check token in `X-Firebase-AppCheck`
- server-side validation and rate limiting

Supported user actions:

- `daily`
- `join`
- `topup`
- `withdraw`

Ad rewards intentionally return an error until a real ad provider can send a server-verifiable completion signal. A client-side timer is not considered proof of an ad view.

Admin actions:

- `admin_topup`
- `admin_withdrawal`

Both are transactional and idempotent at the request/ledger level.

## Important migration behavior

Direct browser writes to coins, XP, match mutations, financial requests, OTP records, rate-limit records, and the economy ledger are denied by Firestore Rules.

Top-up, withdrawal, and match joining have already been switched to the secure API in the client. The remaining legacy Dashboard reward/referral functions must be migrated to `/api/economy` before those UI controls are considered production-ready. Until that migration is completed, their direct Firestore writes will fail safely rather than minting currency.

## Verification checklist

Before merging this branch:

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Test registration OTP send/verify and five-attempt lockout.
- [ ] Test duplicate top-up submission with the same idempotency key.
- [ ] Test concurrent withdrawals from one account.
- [ ] Test concurrent match joins at the player limit.
- [ ] Test double approval of the same top-up/withdrawal.
- [ ] Confirm non-admin users receive 403 from admin economy actions.
- [ ] Confirm direct Firestore coin writes are denied.
- [ ] Confirm direct financial request writes are denied.
- [ ] Confirm Storage writes are denied until an explicit upload policy is added.
