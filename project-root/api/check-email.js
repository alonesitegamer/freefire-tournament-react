import crypto from "crypto";
import { getAdmin, handleError, json, method, normalizeEmail } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "mailinator.com", "tempmail.com", "guerrillamail.com",
  "maildrop.cc", "trashmail.com", "tempmail.net", "yopmail.com", "dispostable.com",
  "getnada.com", "spamgourmet.com", "disposablemail.com", "mail-temporaire.com", "moakt.com",
]);
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(forwarded || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

export default async function handler(req, res) {
  try {
    method(req, "POST");
    const email = normalizeEmail(req.body?.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: "A valid email is required" });

    const allowed = await rateLimit({ key: `check-email:${crypto.createHash("sha256").update(getClientIp(req)).digest("hex")}`, limit: 30, windowSeconds: 3600 });
    if (!allowed) return json(res, 429, { error: "Too many requests" });

    const disposable = DISPOSABLE_DOMAINS.has(email.split("@")[1]);
    let existing = false;
    try {
      await getAdmin().auth().getUserByEmail(email);
      existing = true;
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
    return json(res, 200, { existing, disposable });
  } catch (error) {
    return handleError(res, error);
  }
}
