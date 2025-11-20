// /api/check-email.js
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

function isDisposableEmail(email) {
  const disposableDomains = [
    "10minutemail.com","mailinator.com","tempmail.com","guerrillamail.com",
    "maildrop.cc","trashmail.com","tempmail.net","yopmail.com","dispostable.com",
    "getnada.com","spamgourmet.com","disposablemail.com","mail-temporaire.com","moakt.com",
  ];
  const domain = (email || "").split("@")[1] || "";
  return disposableDomains.includes(domain.toLowerCase());
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;
  if (!email || typeof email !== "string") return res.status(400).json({ error: "Missing email" });

  const adminApp = initAdmin();
  if (!adminApp) return res.status(500).json({ error: "Server configuration error" });

  try {
    // disposable check
    const disposable = isDisposableEmail(email);

    // check existing user
    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user) {
        return res.status(200).json({ existing: true, disposable });
      }
    } catch (err) {
      if (err.code && String(err.code).includes("auth/user-not-found")) {
        // not found -> ok
        return res.status(200).json({ existing: false, disposable });
      } else {
        console.error("check-email lookup error:", err);
        return res.status(200).json({ existing: false, disposable });
      }
    }
  } catch (err) {
    console.error("check-email error:", err);
    return res.status(500).json({ error: "Failed to check email" });
  }
}
