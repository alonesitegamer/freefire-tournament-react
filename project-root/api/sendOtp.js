import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  // generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Gmail SMTP
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.OTP_EMAIL,
      pass: process.env.OTP_PASS,
    },
  });

  const mailOptions = {
    from: `"Imperial X Esports" <${process.env.OTP_EMAIL}>`,
    to: email,
    subject: "Your Verification OTP",
    html: `
      <h2>Your OTP Code</h2>
      <p style="font-size: 22px; font-weight: bold;">${otp}</p>
      <p>Enter this OTP in the app to verify your account.</p>
      <p>Do not share this code with anyone.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ otp });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Sending failed" });
  }
}
