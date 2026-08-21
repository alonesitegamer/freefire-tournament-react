import { getAdmin, handleError, json, requireUserWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const PROFILE_FIELDS = ["username", "displayName", "avatar", "bio"];
const MAX = { username: 32, displayName: 80, bio: 500, avatar: 200 };

function clean(value, field) {
  const text = String(value ?? "").trim();
  if (text.length > MAX[field]) {
    const error = new Error(`${field} is too long`); error.status = 400; throw error;
  }
  if (field === "username" && text && !/^[\w .-]{2,32}$/u.test(text)) {
    const error = new Error("Username contains invalid characters"); error.status = 400; throw error;
  }
  return text;
}

function serialize(id, data) {
  return {
    id,
    email: data.email || "",
    username: data.username || "",
    displayName: data.displayName || "",
    avatar: data.avatar || "/avatars/default.jpg",
    bio: data.bio || "",
    coins: Number(data.coins || 0),
    xp: Number(data.xp || 0),
    level: Number(data.level || 1),
    wins: Number(data.wins || 0),
    played: Number(data.played || 0),
    referralCode: data.referralCode || "",
    lastDaily: data.lastDaily?.toDate?.()?.toISOString?.() || null,
    adsWatched: Number(data.adsWatched || 0),
    adsWatchedSinceReferral: Number(data.adsWatchedSinceReferral || 0),
    hasRedeemedReferral: Boolean(data.hasRedeemedReferral),
    referralRewardGiven: Boolean(data.referralRewardGiven),
    referrerId: data.referrerId || null,
  };
}

export default async function handler(req, res) {
  try {
    if (!["GET", "PATCH"].includes(req.method)) return json(res, 405, { error: "Method not allowed", allow: "GET, PATCH" });
    const { user } = await requireUserWithAppCheck(req);
    const allowed = await rateLimit({ key: `user-api:${user.uid}`, limit: 120, windowSeconds: 60 });
    if (!allowed) return json(res, 429, { error: "Too many requests" });

    const db = getAdmin().firestore();
    const ref = db.collection("users").doc(user.uid);

    if (req.method === "GET") {
      const snap = await ref.get();
      if (!snap.exists) return json(res, 404, { error: "Profile not found" });
      return json(res, 200, { profile: serialize(snap.id, snap.data()) });
    }

    const body = req.body || {};
    const patch = {};
    for (const field of PROFILE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = clean(body[field], field);
    }
    if (patch.avatar && !/^\/avatars\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i.test(patch.avatar)) {
      const error = new Error("Invalid avatar path"); error.status = 400; throw error;
    }
    if (!Object.keys(patch).length) return json(res, 400, { error: "No editable fields supplied" });

    await ref.update({ ...patch, updatedAt: getAdmin().firestore.FieldValue.serverTimestamp() });
    const snap = await ref.get();
    return json(res, 200, { profile: serialize(snap.id, snap.data()) });
  } catch (error) { return handleError(res, error); }
}
