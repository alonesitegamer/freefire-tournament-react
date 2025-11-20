import nodemailer from "nodemailer";
import admin from "firebase-admin";

// ---------------------------
// 1. FIREBASE ADMIN INIT
// ---------------------------
if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountJson) {
    console.error("❌ Missing FIREBASE_SERVICE_ACCOUNT env var");
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
      });
      console.log("✅ Firebase Admin Initialized");
    } catch (err) {
      console.error("❌ Failed to initialize Firebase Admin:", err);
    }
  }
}

const db = admin.firestore();

// ---------------------------
// 2. TEMP MAIL DETECTOR
// ---------------------------
const tempDomains = [
  "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "mailinator.com", "yopmail.com", "bablace.com", "canvect.com"
];

// ---------------------------
// 3. API HANDLER
// ---------------------------
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;

  if (!email || typeof email !== "string")
    return res.status(400).json({ error: "Missing email" });

  const lowerEmail = email.toLowerCase();
  const domain = lowerEmail.split("@")[1];

  // ---------------------------
  // TEMP MAIL CHECK
  // ---------------------------
  if (tempDomains.includes(domain)) {
    return res.status(403).json({
      success: false,
      reason: "temp-email-blocked",
      message: "Unverified email addresses aren’t allowed."
    });
  }

  try {
    // ---------------------------
    // CHECK IF USER ALREADY EXISTS
    // ---------------------------
    const existingUser = await admin.auth().getUserByEmail(lowerEmail).catch(() => null);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        reason: "email-exists",
        message: "You already have an account."
      });
    }

    // ---------------------------
    // GENERATE & STORE OTP
    // ---------------------------
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 10 * 60 * 1000)
    );

    const docId = encodeURIComponent(lowerEmail);

    await db.collection("otpRequests").doc(docId).set({
      email: lowerEmail,
      code: otp,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ---------------------------
    // SEND OTP EMAIL
    // ---------------------------
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.OTP_EMAIL,
        pass: process.env.OTP_PASS
      },
    });

    await transporter.sendMail({
      from: `"Imperial Esports" <${process.env.OTP_EMAIL}>`,
      to: lowerEmail,
      subject: "Your Imperial Esports Verification Code",
      html: `
      <div style="font-family:Arial; padding:20px; background:#0d0d0d; color:white; border-radius:10px;">
        <h2 style="color:#ffb347; margin-bottom:8px;">Your OTP Code</h2>
        <p style="font-size:16px; opacity:0.8;">Use this code to verify your Imperial Esports account:</p>

        <div style="
            font-size:40px;
            font-weight:bold;
            letter-spacing:6px;
            margin:15px 0;
            padding:15px;
            background:#1b1b1b;
            border-radius:8px;
            text-align:center;
            color:#fff;">
            ${otp}
        </div>

        <p style="opacity:0.7;">This OTP expires in <b>10 minutes</b>.</p>
        <p style="opacity:0.5; font-size:12px;">If you didn’t request this, simply ignore this email.</p>
      </div>
      `,
    });

    console.log(`[send-otp] OTP sent to: ${lowerEmail} (${otp})`);

    return res.status(200).json({
      success: true,
      message: "OTP sent"
    });

  } catch (err) {
    console.error("❌ send-otp error", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP"
    });
  }
}
