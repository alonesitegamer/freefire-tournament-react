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

    const admin = getAdmin();
    const db = admin.firestore();
    let referrerRef = null;

    if (code) {
      const matches = await db.collection("users").where("referralCode", "==", code).limit(2).get();
      if (matches.empty) return json(res, 400, { error: "Referral code not found" });
      if (matches.size > 1) return json(res, 409, { error: "Referral code is ambiguous" });
      referrerRef = matches.docs[0].ref;
      if (referrerRef.id === user.uid) return json(res, 400, { error: "Self-referrals are not allowed" });
    }

    const userRef = db.collection("users").doc(user.uid);
    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      let current = userSnap.exists ? userSnap.data() : null;

      if (!current) {
        current = {
          email: user.email || "",
          displayName: user.name || "",
          username: "",
          coins: 0,
          xp: 0,
          level: 1,
          referralCode: user.uid.substring(0, 8).toUpperCase(),
          referral: code || null,
          hasRedeemedReferral: false,
          welcomeBonusGiven: false,
          referralBonusGiven: false,
          adsWatched: 0,
          adsWatchedSinceReferral: 0,
          referrerRewardGiven: false,
          lastDaily: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        tx.create(userRef, current);
      }

      if (current.welcomeBonusGiven || current.hasRedeemedReferral) return { status: 200, alreadyProcessed: true, reward: 0 };
      if (Number(current.coins || 0) !== 0) return { status: 409, error: "Initial reward requires an untouched account" };

      const reward = referrerRef ? REFERRED_BONUS : WELCOME_BONUS;
      tx.set(userRef, {
        ...current,
        email: current.email || user.email || "",
        displayName: current.displayName || user.name || "",
        coins: reward,
        welcomeBonusGiven: true,
        hasRedeemedReferral: Boolean(referrerRef),
        referral: code || current.referral || null,
        referrerId: referrerRef?.id || null,
        referralBonusGiven: Boolean(referrerRef),
        adsWatchedSinceReferral: 0,
        referrerRewardGiven: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const eventId = crypto.createHash("sha256").update(`${user.uid}:${referrerRef?.id || "none"}:${reward}`).digest("hex");
      tx.create(db.collection("economyLedger").doc(`welcome_${eventId}`), {
        type: referrerRef ? "referral_welcome" : "welcome_bonus",
        uid: user.uid,
        referrerId: referrerRef?.id || null,
        amount: reward,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: 200, reward, referrerId: referrerRef?.id || null };
    });

    return json(res, result.status, result.status >= 400 ? { error: result.error } : result);
  } catch (error) { return handleError(res, error); }
}
