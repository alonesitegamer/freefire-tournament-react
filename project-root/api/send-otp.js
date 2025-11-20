// /api/send-otp.js
import nodemailer from "nodemailer";
import admin from "firebase-admin";

if (!admin.apps.length) {
  // Expect a JSON-stringified service account in env var FIREBASE_SERVICE_ACCOUNT
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

  const { email } = req.body;
  if (!email || typeof email !== "string") return res.status(400).json({ error: "Missing email" });

  // simple 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // expiry: 10 minutes from now
  const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));

  try {
    // store OTP in Firestore (doc id = encoded email to be safe)
    const docId = encodeURIComponent(email.toLowerCase());
    await db.collection("otpRequests").doc(docId).set({
      email: email.toLowerCase(),
      code: otp,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.OTP_EMAIL,
        pass: process.env.OTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Imperial Esports" <${process.env.OTP_EMAIL}>`,
      to: email,
      subject: "Your verification OTP — Imperial Esports",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 18px; background:#000; color:#fff">
          <h2 style="color:#ffb347; margin:0 0 8px">Imperial Esports — Your OTP</h2>
          <p style="margin:0 0 8px">Use the 6-digit code below to verify your account. It expires in 10 minutes.</p>
          <div style="font-size:36px; font-weight:700; letter-spacing:6px; margin:10px 0; color:#fff">${otp}</div>
          <small style="color:#ddd">If you did not request this, ignore this message.</small>
        </div>
      `,
    });

    // For dev convenience log the OTP to Vercel logs (do NOT enable in prod)
    console.log(`[send-otp] OTP to ${email}: ${otp}`);

    return res.status(200).json({ success: true, message: "OTP sent" });
  } catch (err) {
    console.error("send-otp error", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
}
