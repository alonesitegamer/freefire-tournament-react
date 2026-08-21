import crypto from "crypto";
import {
  getAdmin,
  handleError,
  json,
  method,
  positiveInt,
  requireAdminWithAppCheck,
  requireUserWithAppCheck,
} from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const XP_LEVELS = [100, 200, 350, 500, 700, 900, 1200, 1500, 1900, 2300, 2800, 3400, 4000, 4700, 5500, 6300, 7200, 9999999];
const TOPUP_RATE = 10;
const WITHDRAW_AMOUNTS = new Set([50, 100, 200]);

function xpToLevel(xp = 0) {
  for (let i = 0; i < XP_LEVELS.length; i += 1) if (xp < XP_LEVELS[i]) return i + 1;
  return XP_LEVELS.length;
}
function idempotencyId(prefix, uid, key) { return `${prefix}_${uid}_${crypto.createHash("sha256").update(String(key || crypto.randomUUID())).digest("hex")}`; }
function assertIdempotencyKey(key) {
  if (!key || typeof key !== "string" || key.length < 8 || key.length > 128) {
    const error = new Error("A valid idempotency key is required"); error.status = 400; throw error;
  }
  return key;
}

async function dailyReward(uid) {
  const admin = getAdmin(); const db = admin.firestore(); const ref = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); if (!snap.exists) return { status: 404, error: "Profile not found" };
    const data = snap.data(); const last = data.lastDaily?.toMillis?.() ?? 0;
    if (last && Date.now() - last < 24 * 60 * 60 * 1000) return { status: 409, error: "Daily reward already claimed" };
    const coins = Number(data.coins || 0) + 1; const xp = Number(data.xp || 0) + 10; const level = xpToLevel(xp);
    tx.update(ref, { coins, xp, level, lastDaily: admin.firestore.FieldValue.serverTimestamp() });
    tx.set(db.collection("economyLedger").doc(`daily_${uid}_${Date.now()}`), { type: "daily_reward", uid, amount: 1, xp: 10, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { status: 200, coins, xp, level };
  });
}

async function joinMatch(uid, body) {
  const matchId = String(body?.matchId || "");
  if (!matchId || matchId.length > 128) return { status: 400, error: "Invalid matchId" };
  const admin = getAdmin(); const db = admin.firestore();
  const userRef = db.collection("users").doc(uid); const matchRef = db.collection("matches").doc(matchId); const ledgerRef = db.collection("economyLedger").doc(`join_${uid}_${matchId}`);
  return db.runTransaction(async (tx) => {
    const [userSnap, matchSnap, ledgerSnap] = await Promise.all([tx.get(userRef), tx.get(matchRef), tx.get(ledgerRef)]);
    if (!userSnap.exists) return { status: 404, error: "Profile not found" };
    if (!matchSnap.exists) return { status: 404, error: "Match not found" };
    if (ledgerSnap.exists) return { status: 409, error: "Already joined" };
    const user = userSnap.data(); const match = matchSnap.data();
    if (match.status !== "upcoming") return { status: 409, error: "Match is not open for joining" };
    const players = Array.isArray(match.playersJoined) ? match.playersJoined : [];
    if (players.some((player) => player?.uid === uid)) return { status: 409, error: "Already joined" };
    if (players.length >= Number(match.maxPlayers || 0)) return { status: 409, error: "Match is full" };
    const entryFee = Number(match.entryFee || 0); const coins = Number(user.coins || 0);
    if (!Number.isInteger(entryFee) || entryFee < 0) return { status: 500, error: "Invalid match entry fee" };
    if (coins < entryFee) return { status: 409, error: "Insufficient coins" };
    tx.update(userRef, { coins: coins - entryFee, played: Number(user.played || 0) + 1 });
    tx.update(matchRef, { playersJoined: [...players, { uid, username: user.username || user.displayName || "Player", joinedAt: admin.firestore.Timestamp.now() }] });
    tx.set(ledgerRef, { type: "match_join", uid, matchId, amount: -entryFee, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { status: 200, joined: true, coins: coins - entryFee };
  });
}

async function createTopup(uid, body) {
  const key = assertIdempotencyKey(body?.idempotencyKey); const amount = positiveInt(body?.amount, "amount");
  if (amount < 20 || amount > 100000) return { status: 400, error: "Top-up amount must be between ₹20 and ₹100000" };
  const upiId = String(body?.upiId || "").trim(); if (upiId.length < 3 || upiId.length > 100) return { status: 400, error: "Invalid payer UPI ID" };
  const admin = getAdmin(); const db = admin.firestore(); const requestRef = db.collection("topupRequests").doc(idempotencyId("topup", uid, key));
  const userSnap = await db.collection("users").doc(uid).get(); if (!userSnap.exists) return { status: 404, error: "Profile not found" };
  if ((await requestRef.get()).exists) return { status: 200, requestId: requestRef.id, existing: true };
  const email = userSnap.data().email || ""; const coins = amount * TOPUP_RATE;
  await requestRef.create({ userId: uid, email, amount, coins, upiId, status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { status: 201, requestId: requestRef.id, amount, coins };
}

async function createWithdrawal(uid, body) {
  const key = assertIdempotencyKey(body?.idempotencyKey); const amount = Number(body?.amount);
  if (!WITHDRAW_AMOUNTS.has(amount)) return { status: 400, error: "Choose ₹50, ₹100 or ₹200" };
  const type = String(body?.type || "UPI"); if (!["UPI", "Google Play", "Amazon"].includes(type)) return { status: 400, error: "Invalid withdrawal method" };
  const upiId = String(body?.upiId || "").trim(); const email = String(body?.email || "").trim();
  if (type === "UPI" && (upiId.length < 3 || upiId.length > 100)) return { status: 400, error: "A valid UPI ID is required" };
  const reservedCoins = amount * TOPUP_RATE; const admin = getAdmin(); const db = admin.firestore(); const userRef = db.collection("users").doc(uid); const requestRef = db.collection("withdrawRequests").doc(idempotencyId("withdraw", uid, key));
  return db.runTransaction(async (tx) => {
    const [userSnap, requestSnap] = await Promise.all([tx.get(userRef), tx.get(requestRef)]);
    if (requestSnap.exists) return { status: 200, requestId: requestRef.id, existing: true };
    if (!userSnap.exists) return { status: 404, error: "Profile not found" };
    const user = userSnap.data(); const coins = Number(user.coins || 0);
    if (coins < reservedCoins) return { status: 409, error: "Insufficient coins" };
    tx.update(userRef, { coins: coins - reservedCoins });
    tx.create(requestRef, { userId: uid, email: email || user.email || "", amount, reservedCoins, type, upiId: type === "UPI" ? upiId : "", status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { status: 201, requestId: requestRef.id, coins: coins - reservedCoins };
  });
}

async function adminTopup(uid, body) {
  const requestId = String(body?.requestId || ""); const approve = Boolean(body?.approve); if (!requestId) return { status: 400, error: "requestId is required" };
  const admin = getAdmin(); const db = admin.firestore(); const requestRef = db.collection("topupRequests").doc(requestId);
  return db.runTransaction(async (tx) => {
    const requestSnap = await tx.get(requestRef); if (!requestSnap.exists) return { status: 404, error: "Top-up request not found" };
    const request = requestSnap.data(); if (request.status !== "pending") return { status: 200, statusAlreadySet: true, status: request.status };
    const userRef = db.collection("users").doc(String(request.userId || uid));
    if (!approve) { tx.update(requestRef, { status: "rejected", processedAt: admin.firestore.FieldValue.serverTimestamp(), processedBy: uid }); return { status: 200, rejected: true }; }
    const userSnap = await tx.get(userRef); if (!userSnap.exists) return { status: 404, error: "User not found" };
    const user = userSnap.data(); const credit = Number(request.coins || 0); if (!Number.isInteger(credit) || credit <= 0) return { status: 500, error: "Invalid top-up credit" };
    tx.update(userRef, { coins: Number(user.coins || 0) + credit });
    tx.set(db.collection("economyLedger").doc(`topup_${requestRef.id}`), { type: "topup_approved", requestId, uid: request.userId, amount: credit, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.update(requestRef, { status: "approved", processedAt: admin.firestore.FieldValue.serverTimestamp(), processedBy: uid });
    return { status: 200, approved: true };
  });
}

async function adminWithdrawal(uid, body) {
  const requestId = String(body?.requestId || ""); const approve = Boolean(body?.approve); if (!requestId) return { status: 400, error: "requestId is required" };
  const admin = getAdmin(); const db = admin.firestore(); const requestRef = db.collection("withdrawRequests").doc(requestId);
  return db.runTransaction(async (tx) => {
    const requestSnap = await tx.get(requestRef); if (!requestSnap.exists) return { status: 404, error: "Withdrawal request not found" };
    const request = requestSnap.data(); if (request.status !== "pending") return { status: 200, statusAlreadySet: true, status: request.status };
    if (approve) {
      tx.update(requestRef, { status: "approved", processedAt: admin.firestore.FieldValue.serverTimestamp(), processedBy: uid });
      tx.set(db.collection("economyLedger").doc(`withdraw_${requestRef.id}`), { type: "withdraw_approved", requestId, uid: request.userId, amount: Number(request.reservedCoins || 0), createdAt: admin.firestore.FieldValue.serverTimestamp() });
      return { status: 200, approved: true };
    }
    const userRef = db.collection("users").doc(String(request.userId || "")); const userSnap = await tx.get(userRef); if (!userSnap.exists) return { status: 404, error: "User not found" };
    tx.update(userRef, { coins: Number(userSnap.data().coins || 0) + Number(request.reservedCoins || 0) });
    tx.update(requestRef, { status: "rejected", processedAt: admin.firestore.FieldValue.serverTimestamp(), processedBy: uid });
    tx.set(db.collection("economyLedger").doc(`withdraw_rejected_${requestRef.id}`), { type: "withdraw_rejected_refund", requestId, uid: request.userId, amount: Number(request.reservedCoins || 0), createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { status: 200, rejected: true };
  });
}

export default async function handler(req, res) {
  try {
    method(req, "POST"); const action = String(req.body?.action || "");
    if (action.startsWith("admin_")) {
      const { user: adminUser } = await requireAdminWithAppCheck(req);
      const allowed = await rateLimit({ key: `economy-admin:${adminUser.uid}`, limit: 120, windowSeconds: 60 });
      if (!allowed) return json(res, 429, { error: "Too many requests" });
      const result = action === "admin_topup" ? await adminTopup(adminUser.uid, req.body) : action === "admin_withdrawal" ? await adminWithdrawal(adminUser.uid, req.body) : { status: 400, error: "Unknown admin action" };
      return json(res, result.status, result.status >= 400 ? { error: result.error } : result);
    }
    const { user } = await requireUserWithAppCheck(req);
    const allowed = await rateLimit({ key: `economy:${user.uid}`, limit: 60, windowSeconds: 60 });
    if (!allowed) return json(res, 429, { error: "Too many requests" });
    let result;
    if (action === "daily") result = await dailyReward(user.uid);
    else if (action === "join") result = await joinMatch(user.uid, req.body);
    else if (action === "topup") result = await createTopup(user.uid, req.body);
    else if (action === "withdraw") result = await createWithdrawal(user.uid, req.body);
    else if (action === "ad") result = { status: 503, error: "Ad rewards are disabled until a server-verifiable ad provider callback is configured." };
    else result = { status: 400, error: "Unknown economy action" };
    return json(res, result.status, result.status >= 400 ? { error: result.error } : result);
  } catch (error) { return handleError(res, error); }
}
