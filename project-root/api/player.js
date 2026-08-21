import crypto from "crypto";
import {
  getAdmin,
  handleError,
  json,
  method,
  requireUserWithAppCheck,
} from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";
import { finiteInt, requireBody, stringField, username } from "./_input.js";

const XP_LEVELS = [100, 200, 350, 500, 700, 900, 1200, 1500, 1900, 2300, 2800, 3400, 4000, 4700, 5500, 6300, 7200, 9999999];
const WELCOME_BONUS = 10;
const REFERRAL_BONUS = 20;

function xpToLevel(xp = 0) {
  for (let i = 0; i < XP_LEVELS.length; i += 1) if (xp < XP_LEVELS[i]) return i + 1;
  return XP_LEVELS.length;
}

function ledgerId(type, uid, key = crypto.randomUUID()) {
  return `${type}_${uid}_${crypto.createHash("sha256").update(String(key)).digest("hex")}`;
}

async function initProfile(uid, body) {
  const admin = getAdmin();
  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const referral = String(body.referral || "").trim().toUpperCase();
  const displayName = String(body.displayName || "").trim().slice(0, 80);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    if (existing.exists) return { status: 200, created: false, profile: existing.data() };

    let referrerId = null;
    if (referral) {
      const query = await db.collection("users").where("referralCode", "==", referral).limit(2).get();
      if (query.size === 1 && query.docs[0].id !== uid) referrerId = query.docs[0].id;
    }

    const coins = referrerId ? REFERRAL_BONUS : WELCOME_BONUS;
    const referralCode = uid.substring(0, 8).toUpperCase();
    const data = {
      email: admin.auth().getUser(uid).then?.name ? "" : undefined,
      displayName,
      username: "",
      coins,
      xp: 0,
      level: 1,
      lastDaily: null,
      referral: referral || null,
      referralCode,
      hasRedeemedReferral: Boolean(referrerId),
      referrerId,
      welcomeBonusGiven: true,
      referralBonusGiven: Boolean(referrerId),
      adsWatched: 0,
      adsWatchedSinceReferral: 0,
      referrerRewardGiven: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Email is copied from the verified Auth account, never supplied by the browser.
    const authUser = await admin.auth().getUser(uid);
    data.email = authUser.email || "";
    tx.create(userRef, data);
    tx.set(db.collection("economyLedger").doc(ledgerId("welcome", uid)), {
      type: referrerId ? "referral_welcome" : "welcome_bonus",
      uid,
      amount: coins,
      referrerId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { status: 201, created: true, profile: { ...data, email: authUser.email || "" } };
  });
}

async function updateProfile(uid, body) {
  const admin = getAdmin();
  const db = admin.firestore();
  const ref = db.collection("users").doc(uid);
  const patch = {};

  if (body.username !== undefined) patch.username = username(body.username);
  if (body.displayName !== undefined) patch.displayName = String(body.displayName).trim().slice(0, 80);
  if (body.bio !== undefined) patch.bio = String(body.bio).trim().slice(0, 300);
  if (body.avatar !== undefined) {
    const avatar = stringField(body.avatar, "avatar", { min: 1, max: 120 });
    if (!avatar.startsWith("/avatars/") || avatar.includes("..")) {
      const error = new Error("Invalid avatar"); error.status = 400; throw error;
    }
    patch.avatar = avatar;
  }

  if (!Object.keys(patch).length) return { status: 400, error: "No profile fields supplied" };
  await ref.update(patch);
  const snap = await ref.get();
  return { status: 200, profile: snap.data() };
}

async function addHistory(uid, body) {
  const admin = getAdmin();
  const db = admin.firestore();
  const matchId = stringField(body.matchId, "matchId", { min: 1, max: 128 });
  const result = stringField(body.result, "result", { min: 1, max: 40 });
  const kills = finiteInt(body.kills ?? 0, "kills", { min: 0, max: 100 });
  const placement = finiteInt(body.placement ?? 0, "placement", { min: 0, max: 100 });
  const idempotencyKey = stringField(body.idempotencyKey, "idempotencyKey", { min: 8, max: 128 });
  const ref = db.collection("matchHistory").doc(`history_${uid}_${crypto.createHash("sha256").update(idempotencyKey).digest("hex")}`);
  if ((await ref.get()).exists) return { status: 200, existing: true, id: ref.id };

  await ref.create({ uid, userId: uid, matchId, result, kills, placement, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { status: 201, id: ref.id };
}

async function updateStats(uid, body) {
  const matches = finiteInt(body.matches ?? 0, "matches", { min: 0, max: 1000 });
  const kills = finiteInt(body.kills ?? 0, "kills", { min: 0, max: 10000 });
  const booyah = finiteInt(body.booyah ?? 0, "booyah", { min: 0, max: 1000 });
  const idempotencyKey = stringField(body.idempotencyKey, "idempotencyKey", { min: 8, max: 128 });
  const admin = getAdmin(); const db = admin.firestore();
  const ledgerRef = db.collection("economyLedger").doc(ledgerId("stats", uid, idempotencyKey));
  const userRef = db.collection("users").doc(uid);

  return db.runTransaction(async (tx) => {
    if ((await tx.get(ledgerRef)).exists) return { status: 200, existing: true };
    const snap = await tx.get(userRef);
    if (!snap.exists) return { status: 404, error: "Profile not found" };
    const data = snap.data(); const stats = data.stats || {};
    const next = {
      matchesPlayed: Number(stats.matchesPlayed || 0) + matches,
      totalKills: Number(stats.totalKills || 0) + kills,
      booyahs: Number(stats.booyahs || 0) + booyah,
      coinsEarned: Number(stats.coinsEarned || 0),
    };
    tx.update(userRef, { stats: next });
    tx.create(ledgerRef, { type: "stats_update", uid, matches, kills, booyah, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { status: 200, stats: next };
  });
}

export default async function handler(req, res) {
  try {
    method(req, "POST");
    const { user } = await requireUserWithAppCheck(req);
    const body = requireBody(req);
    const allowed = await rateLimit({ key: `player:${user.uid}`, limit: 30, windowSeconds: 60 });
    if (!allowed) return json(res, 429, { error: "Too many requests" });

    const action = String(body.action || "");
    let result;
    if (action === "init") result = await initProfile(user.uid, body);
    else if (action === "profile") result = await updateProfile(user.uid, body);
    else if (action === "history") result = await addHistory(user.uid, body);
    else if (action === "stats") result = await updateStats(user.uid, body);
    else result = { status: 400, error: "Unknown player action" };

    return json(res, result.status, result.status >= 400 ? { error: result.error } : result);
  } catch (error) {
    return handleError(res, error);
  }
}
