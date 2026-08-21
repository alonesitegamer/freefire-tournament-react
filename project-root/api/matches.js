import { getAdmin, handleError, json, method, requireUserWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const PUBLIC_FIELDS = [
  "title", "type", "mode", "mapPool", "map", "autoRotate", "maxPlayers",
  "entryFee", "reward", "killReward", "startTime", "revealAt", "revealDelayMinutes",
  "imageUrls", "imageUrl", "status", "createdAt", "playersJoined",
];

function timestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value.toMillis === "function") return new Date(value.toMillis()).toISOString();
  return value;
}
function serialize(match) {
  const output = {};
  for (const field of PUBLIC_FIELDS) {
    if (match[field] !== undefined) output[field] = ["startTime", "revealAt", "createdAt"].includes(field) ? timestamp(match[field]) : match[field];
  }
  const players = Array.isArray(match.playersJoined) ? match.playersJoined : [];
  output.playersJoined = players.map((player) => ({ uid: player.uid, username: player.username || "Player", joinedAt: timestamp(player.joinedAt) }));
  return output;
}
function isJoined(match, uid) { return Array.isArray(match.playersJoined) && match.playersJoined.some((player) => player?.uid === uid); }
function revealAllowed(match) {
  if (!match.revealAt) return false;
  const millis = typeof match.revealAt.toMillis === "function" ? match.revealAt.toMillis() : new Date(match.revealAt).getTime();
  return Number.isFinite(millis) && Date.now() >= millis;
}

export default async function handler(req, res) {
  try {
    method(req, "GET");
    const { user } = await requireUserWithAppCheck(req);
    const allowed = await rateLimit({ key: `matches:${user.uid}`, limit: 120, windowSeconds: 60 });
    if (!allowed) return json(res, 429, { error: "Too many requests" });

    const db = getAdmin().firestore();
    const matchId = String(req.query?.matchId || "").trim();
    if (matchId) {
      const snap = await db.collection("matches").doc(matchId).get();
      if (!snap.exists) return json(res, 404, { error: "Match not found" });
      const match = snap.data();
      const joined = isJoined(match, user.uid);
      const privateVisible = user.admin === true || (joined && revealAllowed(match));
      let room = null;
      if (privateVisible) {
        const secretSnap = await db.collection("matchSecrets").doc(matchId).get();
        if (secretSnap.exists) room = secretSnap.data();
      }
      return json(res, 200, { match: { id: snap.id, ...serialize(match), ...(room ? { roomID: room.roomID || "", roomPassword: room.roomPassword || "" } : {}) }, joined, privateVisible });
    }

    const snap = await db.collection("matches").where("status", "==", "upcoming").orderBy("createdAt", "desc").limit(50).get();
    return json(res, 200, { matches: snap.docs.map((doc) => ({ id: doc.id, ...serialize(doc.data()) })) });
  } catch (error) { return handleError(res, error); }
}
