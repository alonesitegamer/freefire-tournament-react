import crypto from "crypto";
import { getAdmin, handleError, json, method, requireUserWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const CANONICAL_CODE = /^[A-Z0-9]{8}$/;
const LEGACY_CODE = /^[A-Z0-9]{6,16}$/;
const WELCOME_BONUS = 10;
const REFERRED_BONUS = 20;
const REFERRER_BONUS = 20;
const MAX_CODE_ATTEMPTS = 12;

function makeReferralCode() {
  return crypto.randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
}

async function findUnusedReferralCode(db) {
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
    const code = makeReferralCode();
    const snap = await db.collection("referralCodes").doc(code).get();
    if (!snap.exists) return code;
  }
  const error = new Error("Unable to allocate a unique referral code");
  error.status = 503;
  throw error;
}

function eventHash(...parts) {
  return crypto.createHash("sha256").update(parts.join(":")).digest("hex");
}

async function resolveReferrer(db, requestedCode, uid, tx) {
  if (!requestedCode) return { referrerRef: null, ignoredReferralReason: null };

  let referrerUid = null;
  let ignoredReferralReason = null;
  const canonicalRef = db.collection("referralCodes").doc(requestedCode);
  const canonicalSnap = await tx.get(canonicalRef);
  if (canonicalSnap.exists) {
    referrerUid = canonicalSnap.data()?.uid || null;
  } else {
    const aliasRef = db.collection("referralAliases").doc(requestedCode);
    const aliasSnap = await tx.get(aliasRef);
    if (aliasSnap.exists) referrerUid = aliasSnap.data()?.uid || null;
    else ignoredReferralReason = "Referral code not found";
  }

  if (!referrerUid) return { referrerRef: null, ignoredReferralReason };
  if (referrerUid === uid) return { referrerRef: null, ignoredReferralReason: "Self-referrals are not allowed" };
  return { referrerRef: db.collection("users").doc(referrerUid), ignoredReferralReason };
}

export default async function handler(req, res) {
  try {
    method(req, "POST");
    const { user } = await requireUserWithAppCheck(req);
    const allowed = await rateLimit({ key: `referral:${user.uid}`, limit: 10, windowSeconds: 3600 });
    if (!allowed) return json(res, 429, { error: "Too many referral attempts" });

    const requestedCode = String(req.body?.referralCode || "").trim().toUpperCase();
    if (requestedCode && !LEGACY_CODE.test(requestedCode)) {
      return json(res, 400, { error: "Invalid referral code" });
    }

    const admin = getAdmin();
    const db = admin.firestore();
    const userRef = db.collection("users").doc(user.uid);
    const generatedCode = await findUnusedReferralCode(db);

    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const current = userSnap.exists ? userSnap.data() : null;

      if (current?.welcomeBonusGiven || current?.referralCompletedAt) {
        return {
          status: 200,
          alreadyProcessed: true,
          reward: 0,
          referrerBonus: 0,
          referralAccepted: Boolean(current.referrerId),
          referralCode: current.referralCode || "",
        };
      }
      if (current && Number(current.coins || 0) !== 0) {
        return { status: 409, error: "Initial reward requires an untouched account" };
      }

      const { referrerRef, ignoredReferralReason: initialIgnoredReason } = await resolveReferrer(db, requestedCode, user.uid, tx);
      let ignoredReferralReason = initialIgnoredReason;

      const codeToUse = current?.referralCode || generatedCode;
      const ownCodeRef = db.collection("referralCodes").doc(codeToUse);
      const ownCodeSnap = await tx.get(ownCodeRef);
      if (ownCodeSnap.exists && ownCodeSnap.data()?.uid !== user.uid) {
        return { status: 409, error: "Generated referral code collision, please retry" };
      }

      let effectiveReferrerRef = referrerRef;
      let referrerBonus = 0;
      if (effectiveReferrerRef) {
        const referrerSnap = await tx.get(effectiveReferrerRef);
        if (!referrerSnap.exists) {
          effectiveReferrerRef = null;
          ignoredReferralReason = "Referral account no longer exists";
        } else {
          const claimRef = db.collection("referralClaims").doc(`${effectiveReferrerRef.id}_${user.uid}`);
          const claimSnap = await tx.get(claimRef);
          if (claimSnap.exists) {
            effectiveReferrerRef = null;
            ignoredReferralReason = "Referral reward already claimed";
          } else {
            referrerBonus = REFERRER_BONUS;
            tx.create(claimRef, {
              referrerId: effectiveReferrerRef.id,
              referredUserId: user.uid,
              amount: REFERRER_BONUS,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.update(effectiveReferrerRef, {
              coins: Number(referrerSnap.data().coins || 0) + REFERRER_BONUS,
              referralCount: Number(referrerSnap.data().referralCount || 0) + 1,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.create(db.collection("economyLedger").doc(`referrer_${eventHash(effectiveReferrerRef.id, user.uid)}`), {
              type: "referrer_bonus",
              uid: effectiveReferrerRef.id,
              referredUserId: user.uid,
              amount: REFERRER_BONUS,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }

      const referralAccepted = Boolean(effectiveReferrerRef);
      const reward = referralAccepted ? REFERRED_BONUS : WELCOME_BONUS;
      const initialProfile = {
        email: user.email || "",
        displayName: user.name || "",
        username: "",
        coins: 0,
        xp: 0,
        level: 1,
        referralCode: codeToUse,
        referral: null,
        hasRedeemedReferral: false,
        welcomeBonusGiven: false,
        referralBonusGiven: false,
        referrerRewardGiven: false,
        lastDaily: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!current) {
        tx.create(userRef, {
          ...initialProfile,
          coins: reward,
          welcomeBonusGiven: true,
          hasRedeemedReferral: referralAccepted,
          referral: referralAccepted ? requestedCode : null,
          referrerId: effectiveReferrerRef?.id || null,
          referralBonusGiven: referralAccepted,
          referralCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(userRef, {
          referralCode: codeToUse,
          coins: reward,
          welcomeBonusGiven: true,
          hasRedeemedReferral: referralAccepted,
          referral: referralAccepted ? requestedCode : null,
          referrerId: effectiveReferrerRef?.id || null,
          referralBonusGiven: referralAccepted,
          referralCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (!ownCodeSnap.exists) {
        tx.create(ownCodeRef, {
          uid: user.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      tx.create(db.collection("economyLedger").doc(`welcome_${eventHash(user.uid, effectiveReferrerRef?.id || "none", String(reward))}`), {
        type: referralAccepted ? "referred_user_bonus" : "welcome_bonus",
        uid: user.uid,
        referrerId: effectiveReferrerRef?.id || null,
        amount: reward,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        status: 200,
        reward,
        referrerBonus,
        referralAccepted,
        referrerId: effectiveReferrerRef?.id || null,
        referralCode: codeToUse,
        ignoredReferralReason,
      };
    });

    return json(res, result.status, result.status >= 400 ? { error: result.error } : result);
  } catch (error) {
    return handleError(res, error);
  }
}
