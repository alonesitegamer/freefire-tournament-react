import crypto from "crypto";
import nodemailer from "nodemailer";
import { getAdmin, handleError, json, method, normalizeEmail } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_IP = 5;
const MAX_SENDS_PER_EMAIL = 3;

const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "mailinator.com", "tempmail.com", "guerrillamail.com",
  "maildrop.cc", "trashmail.com", "tempmail.net", "yopmail.com",
  "dispostable.com", "getnada.com", "spamgourmet.com", "disposablemail.com",
  "mail-temporaire.com", "moakt.com",
]);

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(forwarded || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

export default async function handler(req, res) {
  try {
    method(req, "POST");

    const email = normalizeEmail(req.body?.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(res, 400, { error: "A valid email is required" });
    }

    const domain = email.split("@")[1];
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return json(res, 400, { error: "Disposable email addresses are not allowed" });
    }

    const ip = getClientIp(req);
    const [ipAllowed, emailAllowed] = await Promise.all([
      rateLimit({ key: `otp-send:ip:${crypto.createHash("sha256").update(ip).digest("hex")}`, limit: MAX_SENDS_PER_IP, windowSeconds: 3600 }),
      rateLimit({ key: `otp-send:email:${crypto.createHash("sha256").update(email).digest("hex")}`, limit: MAX_SENDS_PER_EMAIL, windowSeconds: 3600 }),
    ]);

    if (!ipAllowed || !emailAllowed) {
      return json(res, 429, { error: "Too many OTP requests. Please try again later." });
    }

    const admin = getAdmin();
    try {
      await admin.auth().getUserByEmail(email);
      return json(res, 400, { error: "An account already exists with this email" });
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const db = admin.firestore();
    const docId = encodeURIComponent(email);
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + OTP_TTL_MS);

    await db.collection("otpRequests").doc(docId).set({
      email,
      codeHash: hashOtp(otp),
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.OTP_EMAIL, pass: process.env.OTP_PASS },
    });

    await transporter.sendMail({
      from: `"Imperial Esports" <${process.env.OTP_EMAIL}>`,
      to: email,
      subject: "Your verification OTP — Imperial Esports",
      text: `Your Imperial Esports verification code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2>Imperial Esports</h2><p>Your verification code:</p><p style="font-size:36px;font-weight:700;letter-spacing:8px">${otp}</p><p>This code expires in 10 minutes.</p></div>`,
    });

    // Never log the OTP in production.
    return json(res, 200, { success: true, message: "OTP sent" });
  } catch (error) {
    return handleError(res, error);
  }
}
