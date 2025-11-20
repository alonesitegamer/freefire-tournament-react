// /api/verify-otp.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT env var");
  } else {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(sa)),
    });
  }
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Missing fields" });

  try {
    const docId = encodeURIComponent(email.toLowerCase());
    const snap = await db.collection("otpRequests").doc(docId).get();

    if (!snap.exists) return res.status(400).json({ error: "OTP not found" });

    const data = snap.data();
    const now = admin.firestore.Timestamp.now();

    if (!data.code || !data.expiresAt) {
      // cleanup for safety
      await db.collection("otpRequests").doc(docId).delete().catch(()=>{});
      return res.status(400).json({ error: "Invalid OTP entry" });
    }

    if (now.toMillis() > data.expiresAt.toMillis()) {
      // expired: delete and inform
      await db.collection("otpRequests").doc(docId).delete().catch(()=>{});
      return res.status(400).json({ error: "OTP expired" });
    }

    if (String(code).trim() !== String(data.code).trim()) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // OTP ok -> delete entry (one-time use)
    await db.collection("otpRequests").doc(docId).delete();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("verify-otp error", err);
    return res.status(500).json({ error: "Server error verifying OTP" });
  }
}
