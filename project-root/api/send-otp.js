import nodemailer from "nodemailer";
import admin from "firebase-admin";

// -----------------------
// Initialize Firebase Admin
// -----------------------
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin:", err);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });

  const cleanEmail = email.toLowerCase().trim();

  // ----------------------------------------
  // 1️⃣ BLOCK TEMPORARY / DISPOSABLE EMAILS
  // ----------------------------------------
  const tempDomains = [
    "10minutemail.com", "tempmail.com", "guerrillamail.com", "yopmail.com",
    "mailinator.com", "bablace.com", "canvect.com", "getnada.com",
    "dispostable.com", "throwawaymail.com", "trashmail.com", "sharklasers.com",
    "inboxbear.com", "fakeinbox.com"
  ];

  const emailDomain = cleanEmail.split("@")[1];

  if (tempDomains.includes(emailDomain)) {
    return res.status(403).json({
      success: false,
      reason: "temp-email-blocked",
      message: "Temporary / disposable email addresses are not allowed."
    });
  }

  // ----------------------------------------
  // 2️⃣ CHECK IF USER ALREADY EXISTS
  // ----------------------------------------
  try {
    const existingUser = await admin.auth().getUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        reason: "email-exists",
        message: "This email is already registered. Please login instead."
      });
    }
  } catch (e) {
    // If NOT FOUND → continue
    if (e.code !== "auth/user-not-found") {
      console.error("Firebase auth check error:", e);
    }
  }

  // ----------------------------------------
  // 3️⃣ Generate OTP
  // ----------------------------------------
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 10 * 60 * 1000)
  );

  try {
    // store otp
    await db.collection("otpRequests").doc(encodeURIComponent(cleanEmail)).set({
      email: cleanEmail,
      code: otp,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ----------------------------------------
    // 4️⃣ Send Stylish OTP Email
    // ----------------------------------------
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.OTP_EMAIL,
        pass: process.env.OTP_PASS,
      },
    });

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; background:#0a0a0a; padding:24px; color:#fff;">
        <div style="max-width:480px; margin:auto; background:#111; border-radius:10px; padding:20px; border:1px solid #222;">
          <h2 style="text-align:center; color:#ffb347; margin-bottom:10px;">Imperial Esports Verification</h2>

          <p style="font-size:15px; opacity:0.85;">
            Your One-Time Password (OTP) is:
          </p>

          <div style="text-align:center; margin:18px 0;">
            <div style="
              display:inline-block;
              padding:16px 30px;
              background:#ffb347;
              color:#000;
              font-size:32px;
              border-radius:12px;
              letter-spacing:8px;
              font-weight:700;">
              ${otp}
            </div>
          </div>

          <p style="font-size:14px; opacity:0.8;">
            This OTP will expire in <b>10 minutes</b>.
          </p>

          <p style="font-size:13px; opacity:0.6; margin-top:20px;">
            If you didn’t request this, you can safely ignore this message.
          </p>

          <div style="text-align:center; margin-top:20px;">
            <small style="opacity:0.4;">© Imperial Esports</small>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Imperial Esports" <${process.env.OTP_EMAIL}>`,
      to: cleanEmail,
      subject: "Your OTP Code – Imperial Esports",
      html: htmlTemplate,
    });

    console.log(`[OTP SENT] ${cleanEmail} → ${otp}`);

    return res.status(200).json({ success: true, message: "OTP sent." });
  } catch (err) {
    console.error("❌ send-otp error", err);
    return res.status(500).json({
      success: false,
      error: "otp-failed",
      message: "Failed to send OTP. Try again."
    });
  }
}
