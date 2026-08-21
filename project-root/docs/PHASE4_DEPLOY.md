# Phase 4: Referral finalization

## What changed

- Referral codes are now 8-character alphanumeric values backed by a server-only `referralCodes/{code}` ownership document.
- Referral redemption and both bonuses are granted in one Firestore transaction.
- The referred user receives 20 coins when a valid referral is accepted, otherwise the normal 10-coin welcome reward.
- The referrer receives 20 coins exactly once per referred Firebase UID.
- Every referral reward creates an immutable `economyLedger` event.
- `referralClaims/{referrerUid}_{referredUid}` prevents duplicate referrer payouts.
- Self-referrals and invalid/ambiguous codes fail safely to the normal welcome reward.
- Existing processed accounts remain idempotent and cannot be rewarded again.

## Important migration note

The previous implementation generated referral codes from the first 8 characters of the Firebase UID and did not actually credit the referrer. New accounts use the new ownership model. Existing referral codes should be migrated deliberately if they are already distributed to users.

Before production use:

1. Inventory existing `users.referralCode` values.
2. For every existing code, create the matching `referralCodes/{code}` document pointing to the correct user.
3. Resolve collisions before enabling referral redemption for old codes.
4. Keep existing user codes where they are publicly advertised so old referral links do not break.
5. Do not mass-regenerate existing codes without a communication/migration plan.

## Security model

The browser can call `/api/referral` only with Firebase Auth + Firebase App Check. Direct Firestore access to `referralCodes`, `referralClaims`, and `economyLedger` remains denied by the client rules.

## Test matrix

- first registration without code => +10
- first registration with valid code => referred user +20, referrer +20
- invalid code => +10 and no referrer payout
- self-referral => +10 and no payout
- same user retries => 0 additional reward
- same referral pair retries => 0 additional referrer reward
- concurrent redemption attempts => exactly one successful payout
- two users attempting the same generated code => only one owner
- existing advertised legacy code => works after migration
