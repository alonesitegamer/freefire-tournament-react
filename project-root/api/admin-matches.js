import { getAdmin, handleError, json, method, requireAdminWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const MAX_PLAYERS = 48;
const MAX_STRING = 500;

function cleanString(value, field, max = MAX_STRING) {
  const result = String(value ?? "").trim();
  if (result.length > max) {
    const error = new Error(`${field} is too long`); error.status = 400; throw error;
  }
  return result;
}
function integer(value, field, min, max) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < min || result > max) {
    const error = new Error(`${field} must be an integer between ${min} and ${max}`); error.status = 400; throw error;
  }
  return result;
}
function timestamp(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) { const error = new Error(`${field} is invalid`); error.status = 400; throw error; }
  return getAdmin().firestore.Timestamp.fromDate(date);
}
function validatePayload(body, existing = {}) {
  const mode = ["Solo", "Duo", "Squad"].includes(body.mode) ? body.mode : existing.mode || "Solo";
  const type = ["tournament", "custom"].includes(body.type) ? body.type : existing.type || "tournament";
  const maxPlayers = integer(body.maxPlayers ?? existing.maxPlayers ?? 4, "maxPlayers", 2, MAX_PLAYERS);
  const entryFee = integer(body.entryFee ?? existing.entryFee ?? 0, "entryFee", 0, 100000);
  const reward = integer(body.reward ?? existing.reward ?? 0, "reward", 0, 10000000);
  const killReward = integer(body.killReward ?? existing.killReward ?? 75, "killReward", 0, 100000);
  const title = cleanString(body.title ?? existing.title, "title", 120);
  if (!title) { const error = new Error("title is required"); error.status = 400; throw error; }

  const mapPool = Array.isArray(body.mapPool) ? body.mapPool.map((item) => cleanString(item, "map", 50)).filter(Boolean).slice(0, 10) : (existing.mapPool || ["Bermuda", "Purgatory", "Kalahari"]);
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.map((item) => cleanString(item, "imageUrl", 1000)).slice(0, 10) : (existing.imageUrls || []);
  const startTime = body.startTime ? timestamp(body.startTime, "startTime") : existing.startTime || null;
  const revealDelayMinutes = integer(body.revealDelayMinutes ?? existing.revealDelayMinutes ?? 5, "revealDelayMinutes", 0, 1440);
  const revealAt = startTime ? getAdmin().firestore.Timestamp.fromMillis(startTime.toMillis() - revealDelayMinutes * 60000) : existing.revealAt || null;

  return {
    title, type, mode, mapPool, maxPlayers, entryFee, reward, killReward,
    imageUrls, startTime, revealDelayMinutes, revealAt,
    roomID: cleanString(body.roomID ?? existing.roomID, "roomID", 100),
    roomPassword: cleanString(body.roomPassword ?? existing.roomPassword, "roomPassword", 100),
    status: ["upcoming", "live", "completed", "cancelled"].includes(body.status) ? body.status : existing.status || "upcoming",
    autoRotate: Boolean(body.autoRotate ?? existing.autoRotate ?? false),
  };
}

export default async function handler(req, res) {
  try {
    const { user } = await requireAdminWithAppCheck(req);
    const allowed = await rateLimit({ key: `admin-matches:${user.uid}`, limit: 60, windowSeconds: 60 });
    if (!allowed) return json(res, 429, { error: "Too many requests" });

    const db = getAdmin().firestore();
    const id = String(req.query?.matchId || req.body?.matchId || "").trim();

    if (req.method === "GET") {
      const snap = await db.collection("matches").orderBy("createdAt", "desc").limit(100).get();
      return json(res, 200, { matches: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    }

    if (req.method === "POST") {
      const data = validatePayload(req.body || {});
      const ref = db.collection("matches").doc();
      await ref.create({ ...data, playersJoined: [], createdAt: getAdmin().firestore.FieldValue.serverTimestamp(), createdBy: user.uid });
      return json(res, 201, { id: ref.id });
    }

    if (req.method === "PATCH") {
      if (!id) return json(res, 400, { error: "matchId is required" });
      const ref = db.collection("matches").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return json(res, 404, { error: "Match not found" });
      const data = validatePayload(req.body || {}, snap.data());
      await ref.update({ ...data, updatedAt: getAdmin().firestore.FieldValue.serverTimestamp(), updatedBy: user.uid });
      return json(res, 200, { id });
    }

    if (req.method === "DELETE") {
      if (!id) return json(res, 400, { error: "matchId is required" });
      const ref = db.collection("matches").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return json(res, 404, { error: "Match not found" });
      if ((snap.data().playersJoined || []).length > 0) return json(res, 409, { error: "Joined matches cannot be deleted; cancel them instead" });
      await ref.delete();
      return json(res, 200, { deleted: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return handleError(res, error);
  }
}
