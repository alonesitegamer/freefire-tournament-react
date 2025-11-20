// /api/send-otp.js
import nodemailer from "nodemailer";
import admin from "firebase-admin";

// -------------------------------
//  FIREBASE ADMIN INITIALIZATION
// -------------------------------
if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!sa) {
    console.error("❌ Missing FIREBASE_SERVICE_ACCOUNT env var");
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(sa)),
      });
      console.log("✔ Firebase Admin initialized");
    } catch (err) {
      console.error("❌ Failed to initialize Firebase Admin:", err);
    }
  }
}

const db = admin.firestore();

// -------------------------------
//  API ROUTE HANDLER
// -------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Missing or invalid email" });
  }

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Expire in 10 minutes
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 10 * 60 * 1000)
  );

  try {
    // Encode email to safe Firestore doc ID
    const docId = encodeURIComponent(email.toLowerCase());

    await db.collection("otpRequests").doc(docId).set({
      email: email.toLowerCase(),
      code: otp,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // -------------------------------
    //  SEND EMAIL
    // -------------------------------
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
      subject: "Your Verification OTP — Imperial Esports",
      html: `
        <div style="font-family: Arial; padding: 18px; background:#000; color:white;">
          <h2 style="color:#ffb347;">Your OTP Code</h2>
          <p style="font-size: 16px;">Use the OTP below to verify your account.</p>
          <h1 style="font-size: 42px; letter-spacing: 6px; margin: 12px 0;">${otp}</h1>
          <p style="color:#ccc;">OTP expires in 10 minutes.</p>
          <p style="margin-top: 10px; font-size: 12px; color:#777;">If you didn’t request this, ignore this mail.</p>
        </div>
      `,
    });

    console.log(`✔ OTP sent to ${email}: ${otp}`);

    return res.status(200).json({ success: true, message: "OTP sent" });
  } catch (err) {
    console.error("❌ send-otp error:", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
}
