// /api/send-otp.js
import nodemailer from "nodemailer";
import admin from "firebase-admin";

// ------- INIT FIREBASE ADMIN (fixed, safe for Vercel edge) -------
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase Admin Init Error:", err);
  }
}

const db = admin.firestore();

// ----------------- MAIN HANDLER -----------------
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;

  if (!email || typeof email !== "string")
    return res.status(400).json({ error: "Missing email" });

  const cleanEmail = email.toLowerCase();

  try {
    // ------------------ CHECK IF USER ALREADY EXISTS ------------------
    const userExists = await admin
      .auth()
      .getUserByEmail(cleanEmail)
      .then(() => true)
      .catch(() => false);

    if (userExists) {
      return res.status(409).json({
        success: false,
        reason: "email-already-used",
      });
    }

    // ------------------ GENERATE OTP ------------------
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 10 * 60 * 1000)
    );

    // ------------------ STORE OTP IN FIRESTORE ------------------
    await db.collection("otpRequests").doc(encodeURIComponent(cleanEmail)).set({
      email: cleanEmail,
      code: otp,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ------------------ SEND EMAIL VIA NODEMAILER ------------------
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.OTP_EMAIL,
        pass: process.env.OTP_PASS,
      },
    });

    // ------------------ STYLE B — NEON GLOW EMAIL ------------------
    const htmlTemplate = `
      <div style="background:#050505; padding:30px; border-radius:16px; font-family:Arial; max-width:480px; margin:auto; border:1px solid #202020;">
        <h2 style="color:#00eaff; text-align:center; margin-bottom:10px;">Your OTP Code</h2>

        <p style="color:#ddd; text-align:center; margin:0 0 18px;">
          Enter this code to verify your Imperial Esports account:
        </p>

        <div style="background:#0f1d20; border:2px solid #00eaff; padding:16px; border-radius:12px; margin:auto; width:fit-content; box-shadow:0 0 14px #00ebff66;">
          <span style="font-size:38px; letter-spacing:8px; color:#00eaff;">${otp}</span>
        </div>

        <p style="color:#aaa; text-align:center; margin-top:20px; font-size:13px;">
          Code expires in 10 minutes.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Imperial Esports" <${process.env.OTP_EMAIL}>`,
      to: cleanEmail,
      subject: "Your Verification OTP — Imperial Esports",
      html: htmlTemplate,
    });

    console.log("[send-otp] OTP sent:", otp);

    return res.json({ success: true, message: "otp-sent" });
  } catch (err) {
    console.error("send-otp ERROR:", err);
    return res.status(500).json({ error: "send-otp-failed" });
  }
}
