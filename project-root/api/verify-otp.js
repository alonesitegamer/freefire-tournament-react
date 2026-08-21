import crypto from "crypto";
import { getAdmin, handleError, json, method, normalizeEmail } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a), "hex");
  const right = Buffer.from(String(b), "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(forwarded || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

export default async function handler(req, res) {
  try {
    method(req, "POST");

    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();
    if (!email || !/^\d{6}$/.test(code)) {
      return json(res, 400, { error: "Invalid OTP request" });
    }

    const ip = getClientIp(req);
    const allowed = await rateLimit({
      key: `otp-verify:ip:${crypto.createHash("sha256").update(ip).digest("hex")}`,
      limit: 30,
      windowSeconds: 3600,
    });
    if (!allowed) return json(res, 429, { error: "Too many verification attempts" });

    const admin = getAdmin();
    const db = admin.firestore();
    const ref = db.collection("otpRequests").doc(encodeURIComponent(email));
    const submittedHash = hashOtp(code);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { status: 400, error: "OTP not found or expired" };

      const data = snap.data();
      const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
      if (!expiresAt || expiresAt < Date.now()) {
        tx.delete(ref);
        return { status: 400, error: "OTP not found or expired" };
      }

      const attempts = Number(data.attempts || 0);
      const maxAttempts = Math.min(Number(data.maxAttempts || 5), 5);
      if (attempts >= maxAttempts) {
        tx.delete(ref);
        return { status: 429, error: "Too many incorrect OTP attempts" };
      }

      if (!safeEqualHex(data.codeHash, submittedHash)) {
        const nextAttempts = attempts + 1;
        if (nextAttempts >= maxAttempts) tx.delete(ref);
        else tx.update(ref, { attempts: nextAttempts });
        return { status: 400, error: "Incorrect OTP" };
      }

      // One-time use. The registration flow can proceed only after this record is consumed.
      tx.delete(ref);
      return { status: 200, success: true };
    });

    return json(res, result.status, result.success ? { success: true } : { error: result.error });
  } catch (error) {
    return handleError(res, error);
  }
}
