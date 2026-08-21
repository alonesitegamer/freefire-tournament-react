import crypto from "crypto";
import { getAdmin, handleError, json, method, requireUserWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const REFERRAL_CODE = /^[A-Z0-9]{6,16}$/i;
const WELCOME_BONUS = 10;
const REFERRED_BONUS = 20;

export default async function handler(req, res) {
  try {
    method(req, "POST");
    const { user } = await requireUserWithAppCheck(req);
    const allowed = await rateLimit({ key: `referral:${user.uid}`, limit: 10, windowSeconds: 3600 });
    if (!allowed) return json(res, 429, { error: "Too many referral attempts" });

    const code = String(req.body?.referralCode || "").trim().toUpperCase();
    if (code && !REFERRAL_CODE.test(code)) return json(res, 400, { error: "Invalid referral code" });

    const db = getAdmin().firestore();
    const userRef = db.collection("users").doc(user.uid);

    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return { status: 404, error: "Profile not found" };
      const current = userSnap.data();
      if (current.welcomeBonusGiven || current.hasRedeemedReferral) return { status: 409, error: "Welcome/referral reward already processed" };

      let referrerId = null;
      if (code) {
        const querySnap = await db.collection("users").where("referralCode", "==", code).limit(2).get();
        if (querySnap.empty) return { status: 400, error: "Referral code not found" };
        if (querySnap.size > 1) return { status: 409, error: "Referral code is ambiguous" };
        referrerId = querySnap.docs[0].id;
        if (referrerId === user.uid) return { status: 400, error: "Self-referrals are not allowed" };
      }

      const coins = Number(current.coins || 0);
      if (coins !== 0) return { status: 409, error: "Initial reward can only be claimed on an untouched account" };

      const reward = referrerId ? REFERRED_BONUS : WELCOME_BONUS;
      tx.update(userRef, {
        coins: reward,
        welcomeBonusGiven: true,
        hasRedeemedReferral: Boolean(referrerId),
        referral: code || null,
        referrerId: referrerId || null,
        referralBonusGiven: Boolean(referrerId),
        adsWatchedSinceReferral: 0,
        referrerRewardGiven: false,
      });

      const eventId = crypto.createHash("sha256").update(`${user.uid}:${referrerId || "none"}:${reward}`).digest("hex");
      tx.set(db.collection("economyLedger").doc(`welcome_${eventId}`), {
        type: referrerId ? "referral_welcome" : "welcome_bonus",
        uid: user.uid,
        referrerId,
        amount: reward,
        createdAt: getAdmin().firestore.FieldValue.serverTimestamp(),
      });

      return { status: 200, reward, referrerId };
    });

    return json(res, result.status, result.status >= 400 ? { error: result.error } : result);
  } catch (error) {
    return handleError(res, error);
  }
}
