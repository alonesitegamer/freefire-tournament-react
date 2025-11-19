import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.OTP_EMAIL,
      pass: process.env.OTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Imperial X Esports" <${process.env.OTP_EMAIL}>`,
      to: email,
      subject: "Your Verification Code",
      html: `
        <h2>Your OTP</h2>
        <div style="font-size:32px;font-weight:bold;margin:20px 0;">${otp}</div>
        <p>Enter this code in the app to verify your email.</p>
        <p>Do not share this code with anyone.</p>
      `,
    });

    return res.status(200).json({ otp });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
}
