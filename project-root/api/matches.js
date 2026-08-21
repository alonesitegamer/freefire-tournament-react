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

function serialize(match, includePrivate = false) {
  const output = {};
  for (const field of PUBLIC_FIELDS) {
    if (match[field] !== undefined) output[field] = field.includes("At") || field === "startTime" || field === "createdAt" ? timestamp(match[field]) : match[field];
  }

  const players = Array.isArray(match.playersJoined) ? match.playersJoined : [];
  output.playersJoined = players.map((player) => ({ uid: player.uid, username: player.username || "Player", joinedAt: timestamp(player.joinedAt) }));

  if (includePrivate) {
    output.roomID = match.roomID || "";
    output.roomPassword = match.roomPassword || "";
  }
  return output;
}

function isJoined(match, uid) {
  return Array.isArray(match.playersJoined) && match.playersJoined.some((player) => player?.uid === uid);
}

function revealAllowed(match) {
  const revealAt = match.revealAt;
  if (!revealAt) return false;
  const millis = typeof revealAt.toMillis === "function" ? revealAt.toMillis() : new Date(revealAt).getTime();
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
      const privateVisible = user.admin === true || (isJoined(match, user.uid) && revealAllowed(match));
      return json(res, 200, { match: { id: snap.id, ...serialize(match, privateVisible) }, joined: isJoined(match, user.uid), privateVisible });
    }

    const snap = await db.collection("matches").where("status", "==", "upcoming").orderBy("createdAt", "desc").limit(50).get();
    const matches = snap.docs.map((doc) => ({ id: doc.id, ...serialize(doc.data(), false) }));
    return json(res, 200, { matches });
  } catch (error) {
    return handleError(res, error);
  }
}
