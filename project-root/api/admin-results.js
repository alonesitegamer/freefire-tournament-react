import { getAdmin, handleError, json, requireAdminWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const MAX_RESULTS = 48;

function positiveInt(value, field, max = 1000000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) {
    const error = new Error(`${field} must be a non-negative integer`);
    error.status = 400;
    throw error;
  }
  return number;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed", allow: "POST" });
    const { user } = await requireAdminWithAppCheck(req);
    const allowed = await rateLimit({ key: `admin-results:${user.uid}`, limit: 30, windowSeconds: 60 });
    if (!allowed) return json(res, 429, { error: "Too many requests" });

    const matchId = String(req.body?.matchId || "").trim();
    const submitted = Array.isArray(req.body?.results) ? req.body.results : [];
    if (!matchId) return json(res, 400, { error: "matchId is required" });
    if (!submitted.length || submitted.length > MAX_RESULTS) return json(res, 400, { error: `results must contain 1-${MAX_RESULTS} players` });

    const admin = getAdmin();
    const db = admin.firestore();
    const matchRef = db.collection("matches").doc(matchId);
    const settlementRef = db.collection("settlements").doc(matchId);

    const result = await db.runTransaction(async (tx) => {
      const [matchSnap, settlementSnap] = await Promise.all([tx.get(matchRef), tx.get(settlementRef)]);
      if (!matchSnap.exists) return { status: 404, error: "Match not found" };
      if (settlementSnap.exists) return { status: 200, alreadySettled: true, settlement: settlementSnap.data() };

      const match = matchSnap.data();
      if (!["live", "upcoming"].includes(match.status)) return { status: 409, error: "Match cannot be settled from its current status" };

      const players = Array.isArray(match.playersJoined) ? match.playersJoined : [];
      const playerByUid = new Map(players.map((player) => [String(player.uid), player]));
      const seen = new Set();
      const normalized = [];

      for (const item of submitted) {
        const uid = String(item?.uid || "").trim();
        if (!uid || seen.has(uid) || !playerByUid.has(uid)) return { status: 400, error: "Results contain an invalid or duplicate player" };
        seen.add(uid);

        const kills = positiveInt(item.kills, "kills", 1000);
        const placement = positiveInt(item.placement, "placement", MAX_RESULTS);
        if (placement < 1) return { status: 400, error: "placement must be at least 1" };
        normalized.push({ uid, username: playerByUid.get(uid).username || "Player", kills, placement });
      }

      const killReward = positiveInt(match.killReward || 0, "killReward", 100000);
      const winnerReward = positiveInt(match.reward || 0, "reward", 10000000);
      const paid = new Map();

      for (const item of normalized) {
        const amount = item.kills * killReward + (item.placement === 1 ? winnerReward : 0);
        paid.set(item.uid, amount);
      }

      for (const item of normalized) {
        const userRef = db.collection("users").doc(item.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) return { status: 404, error: "Result player account not found" };
        const currentCoins = Number(userSnap.data().coins || 0);
        const earned = paid.get(item.uid) || 0;
        tx.update(userRef, {
          coins: currentCoins + earned,
          wins: Number(userSnap.data().wins || 0) + (item.placement === 1 ? 1 : 0),
        });
        tx.create(db.collection("economyLedger").doc(`match_${matchId}_${item.uid}`), {
          type: "match_payout",
          uid: item.uid,
          matchId,
          amount: earned,
          kills: item.kills,
          placement: item.placement,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          processedBy: user.uid,
        });
      }

      const publicResults = normalized.map((item) => ({
        uid: item.uid,
        username: item.username,
        kills: item.kills,
        placement: item.placement,
        coinsEarned: paid.get(item.uid) || 0,
      }));

      tx.create(settlementRef, {
        matchId,
        results: publicResults,
        totalCoinsPaid: publicResults.reduce((sum, item) => sum + item.coinsEarned, 0),
        processedBy: user.uid,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.update(matchRef, {
        status: "completed",
        results: publicResults,
        settledAt: admin.firestore.FieldValue.serverTimestamp(),
        settledBy: user.uid,
      });

      return { status: 200, settled: true, results: publicResults };
    });

    return json(res, result.status, result.status >= 400 ? { error: result.error } : result);
  } catch (error) {
    return handleError(res, error);
  }
}
