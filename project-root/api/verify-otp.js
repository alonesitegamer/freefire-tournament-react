// /api/verify-otp.js
import admin from "firebase-admin";
import fs from "fs";

const LOCAL_SA_PATH = "/mnt/data/imperial-esports-da816-firebase-adminsdk-fbsvc-bdfc7db5b4.json";

function initAdmin() {
  if (admin.apps.length) return admin;

  let sa;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (sa.private_key && sa.private_key.includes("\\n")) {
        sa.private_key = sa.private_key.replace(/\\n/g, "\n");
      }
    } catch (e) {
      sa = null;
    }
  }

  if (!sa) {
    try {
      if (fs.existsSync(LOCAL_SA_PATH)) {
        const raw = fs.readFileSync(LOCAL_SA_PATH, "utf8");
        sa = JSON.parse(raw);
      }
    } catch (err) {
      console.error("Failed to load local service account:", err);
    }
  }

  if (!sa) {
    console.error("Missing Firebase service account configuration.");
    return null;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
    });
    return admin;
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Missing email or code" });

  const adminApp = initAdmin();
  if (!adminApp) return res.status(500).json({ error: "Server configuration error" });

  const db = admin.firestore();
  const docId = encodeURIComponent(email.toLowerCase());

  try {
    const docRef = db.collection("otpRequests").doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(400).json({ error: "OTP not found" });

    const data = snap.data();
    if (!data.code) return res.status(400).json({ error: "Invalid OTP record" });

    const now = admin.firestore.Timestamp.now();
    if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
      await docRef.delete().catch(() => {});
      return res.status(400).json({ error: "OTP expired" });
    }

    if (data.code !== String(code)) {
      return res.status(400).json({ error: "Incorrect OTP" });
    }

    // success - delete OTP record
    await docRef.delete().catch(() => {});
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("verify-otp error", err);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
}
