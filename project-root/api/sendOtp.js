// /api/send-otp.js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
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
      subject: "Your Verification OTP",
      html: `
        <div style="font-family: Arial; padding: 20px; background: #000; color: white;">
          <h2 style="color:#ffb347">Your OTP Code</h2>
          <p style="font-size: 18px">Use the OTP below to verify your account:</p>
          <h1 style="font-size: 40px; letter-spacing: 4px;">${otp}</h1>
          <p>This OTP will expire in 10 minutes.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Mail error", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
}
