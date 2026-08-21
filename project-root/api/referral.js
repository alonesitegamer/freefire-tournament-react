import crypto from "crypto";
import { getAdmin, handleError, json, method, requireUserWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const REFERRAL_CODE = /^[A-Z0-9]{8}$/;
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

export default async function handler(req, res) {
  try {
    method(req, "POST");
    const { user } = await requireUserWithAppCheck(req);
    const allowed = await rateLimit({ key: `referral:${user.uid}`, limit: 10, windowSeconds: 3600 });
    if (!allowed) return json(res, 429, { error: "Too many referral attempts" });

    const requestedCode = String(req.body?.referralCode || "").trim().toUpperCase();
    if (requestedCode && !REFERRAL_CODE.test(requestedCode)) {
      return json(res, 400, { error: "Referral code must be exactly 8 letters/numbers" });
    }

    const admin = getAdmin();
    const db = admin.firestore();
    const userRef = db.collection("users").doc(user.uid);
    const generatedCode = await findUnusedReferralCode(db);

    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const current = userSnap.exists ? userSnap.data() : null;

      if (current?.welcomeBonusGiven || current?.referralCompletedAt) {
        return { status: 200, alreadyProcessed: true, reward: 0, referrerBonus: 0, referralAccepted: Boolean(current.referrerId), referralCode: current.referralCode || "" };
      }
      if (current && Number(current.coins || 0) !== 0) return { status: 409, error: "Initial reward requires an untouched account" };

      let referrerRef = null;
      let ignoredReferralReason = null;
      if (requestedCode) {
        const codeRef = db.collection("referralCodes").doc(requestedCode);
        const codeSnap = await tx.get(codeRef);
        if (!codeSnap.exists) ignoredReferralReason = "Referral code not found";
        else if (codeSnap.data().uid === user.uid) ignoredReferralReason = "Self-referrals are not allowed";
        else referrerRef = db.collection("users").doc(codeSnap.data().uid);
      }

      const codeToUse = current?.referralCode || generatedCode;
      const ownCodeRef = db.collection("referralCodes").doc(codeToUse);
      const ownCodeSnap = await tx.get(ownCodeRef);
      if (ownCodeSnap.exists && ownCodeSnap.data().uid !== user.uid) return { status: 409, error: "Generated referral code collision, please retry" };

      let referrerBonus = 0;
      if (referrerRef) {
        const referrerSnap = await tx.get(referrerRef);
        if (!referrerSnap.exists) {
          referrerRef = null;
          ignoredReferralReason = "Referral account no longer exists";
        } else {
          const claimRef = db.collection("referralClaims").doc(`${referrerRef.id}_${user.uid}`);
          const claimSnap = await tx.get(claimRef);
          if (claimSnap.exists) {
            referrerRef = null;
            ignoredReferralReason = "Referral reward already claimed";
          } else {
            referrerBonus = REFERRER_BONUS;
            tx.create(claimRef, { referrerId: referrerRef.id, referredUserId: user.uid, amount: REFERRER_BONUS, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            tx.update(referrerRef, { coins: Number(referrerSnap.data().coins || 0) + REFERRER_BONUS, referralCount: Number(referrerSnap.data().referralCount || 0) + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            tx.create(db.collection("economyLedger").doc(`referrer_${eventHash(referrerRef.id, user.uid)}`), { type: "referrer_bonus", uid: referrerRef.id, referredUserId: user.uid, amount: REFERRER_BONUS, createdAt: admin.firestore.FieldValue.serverTimestamp() });
          }
        }
      }

      const referralAccepted = Boolean(referrerRef);
      const reward = referralAccepted ? REFERRED_BONUS : WELCOME_BONUS;
      const initialProfile = {
        email: user.email || "", displayName: user.name || "", username: "", coins: 0, xp: 0, level: 1,
        referralCode: codeToUse, referral: null, hasRedeemedReferral: false, welcomeBonusGiven: false,
        referralBonusGiven: false, referrerRewardGiven: false, lastDaily: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!current) tx.create(userRef, initialProfile);
      tx.create(ownCodeRef, { uid: user.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.set(userRef, {
        ...(current || initialProfile),
        email: current?.email || user.email || "",
        displayName: current?.displayName || user.name || "",
        referralCode: codeToUse,
        coins: reward,
        welcomeBonusGiven: true,
        hasRedeemedReferral: referralAccepted,
        referral: referralAccepted ? requestedCode : null,
        referrerId: referrerRef?.id || null,
        referralBonusGiven: referralAccepted,
        referrerRewardGiven: false,
        referralCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.create(db.collection("economyLedger").doc(`welcome_${eventHash(user.uid, referrerRef?.id || "none", String(reward))}`), { type: referralAccepted ? "referred_user_bonus" : "welcome_bonus", uid: user.uid, referrerId: referrerRef?.id || null, amount: reward, createdAt: admin.firestore.FieldValue.serverTimestamp() });

      return { status: 200, reward, referrerBonus, referralAccepted, referrerId: referrerRef?.id || null, referralCode: codeToUse, ignoredReferralReason };
    });

    return json(res, result.status, result.status >= 400 ? { error: result.error } : result);
  } catch (error) { return handleError(res, error); }
}
