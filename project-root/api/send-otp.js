// /api/send-otp.js
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import fs from "fs";

const LOCAL_SA_PATH = "/mnt/data/imperial-esports-da816-firebase-adminsdk-fbsvc-bdfc7db5b4.json";

function initAdmin() {
  if (admin.apps.length) return admin;

  let sa;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      // fix private_key if escaped newlines
      if (sa.private_key && sa.private_key.includes("\\n")) {
        sa.private_key = sa.private_key.replace(/\\n/g, "\n");
      }
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env var:", e);
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Missing email" });
  }

  const adminApp = initAdmin();
  if (!adminApp) return res.status(500).json({ error: "Server configuration error" });

  const db = admin.firestore();

  // dispose check
  if (isDisposableEmail(email)) {
    return res.status(400).json({ error: "Disposable email addresses are not allowed" });
  }

  // check if user already exists
  try {
    const user = await admin.auth().getUserByEmail(email);
    if (user) {
      return res.status(400).json({ error: "An account already exists with this email" });
    }
  } catch (err) {
    // if error code is "auth/user-not-found", it's expected and OK
    if (err.code && String(err.code).includes("auth/user-not-found")) {
      // ok, proceed
    } else {
      console.error("getUserByEmail error (non not-found):", err);
      // continue anyway (to avoid blocking) but log
    }
  }

  // generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));
  const docId = encodeURIComponent(email.toLowerCase());

  try {
    await db.collection("otpRequests").doc(docId).set({
      email: email.toLowerCase(),
      code: otp,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.OTP_EMAIL,
        pass: process.env.OTP_PASS,
      },
    });

    const html = `
      <div style="font-family: Arial, sans-serif; padding:24px; background:#0b0b0b; color:#fff; border-radius:8px;">
        <div style="max-width:600px;margin:0 auto;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <img src="https://tournament-react.vercel.app/icon.jpg" alt="logo" style="width:48px;height:48px;border-radius:8px;object-fit:cover"/>
            <div>
              <h2 style="margin:0;color:#ffb347;">Imperial Esports — Account verification</h2>
              <div style="color:#bfc7d1;font-size:14px;">Use the code below to finish registration. Expires in 10 minutes.</div>
            </div>
          </div>
          <div style="background:#0f0f0f;padding:18px;border-radius:10px;text-align:center;margin-top:8px;">
            <div style="font-size:36px;font-weight:700;letter-spacing:6px;color:#fff">${otp}</div>
          </div>
          <div style="margin-top:14px;color:#bfc7d1;font-size:13px;">
            If you did not request this, you can safely ignore this email.
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Imperial Esports" <${process.env.OTP_EMAIL}>`,
      to: email,
      subject: "Your verification OTP — Imperial Esports",
      html,
    });

    console.log(`[send-otp] OTP to ${email}: ${otp}`); // dev log
    return res.status(200).json({ success: true, message: "OTP sent" });
  } catch (err) {
    console.error("send-otp error", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
}
