import React, { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, provider } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import { secureApi } from "../utils/apiClient";
import "../styles/Login.css";

export default function LoginServer() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [resend, setResend] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => timer.current && clearInterval(timer.current), []);

  function beginCountdown(seconds = 30) {
    setResend(seconds);
    clearInterval(timer.current);
    timer.current = setInterval(() => setResend((value) => {
      if (value <= 1) { clearInterval(timer.current); return 0; }
      return value - 1;
    }), 1000);
  }

  async function postOtp(path, body) {
    const response = await secureApi(path, { method: "POST", body: JSON.stringify(body) });
    return response;
  }

  async function sendOtp() {
    setError("");
    try {
      await postOtp("/api/check-email", { email });
      await postOtp("/api/send-otp", { email });
      beginCountdown();
      setOtpOpen(true);
    } catch (err) { setError(err.message || "Unable to send OTP"); }
  }

  async function verifyOtpAndRegister() {
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit OTP.");
    setLoading(true); setError("");
    try {
      await postOtp("/api/verify-otp", { email, code: otp });
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await postOtp("/api/referral", { referralCode: referral.trim() });
      setOtpOpen(false); setOtp(""); setIsRegister(false); setEmail(""); setPassword(""); setReferral("");
      navigate("/", { replace: true });
      void credential;
    } catch (err) { setError(err.message || "Registration failed"); }
    finally { setLoading(false); }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!email || !password) return setError("Please enter email and password.");
    setLoading(true);
    try {
      if (isReset) {
        await sendPasswordResetEmail(auth, email);
        setError("Password reset email sent.");
      } else if (isRegister) {
        await sendOtp();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        navigate("/", { replace: true });
      }
    } catch (err) { setError(err.message || "Authentication failed"); }
    finally { setLoading(false); }
  }

  async function google() {
    setError(""); setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      await postOtp("/api/referral", { referralCode: referral.trim() });
      navigate("/", { replace: true });
    } catch (err) { setError(err.message || "Google sign-in failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="auth-root login-screen">
      <video className="bg-video" autoPlay loop muted playsInline><source src="/bg.mp4" type="video/mp4" /></video>
      <div className="auth-overlay" />
      <div className="auth-card login-card">
        <img src="/icon.jpg" className="logo-small" alt="Imperial X Esports" />
        <h2 className="login-title">{isReset ? "Reset Password" : isRegister ? "Create Account" : "Welcome Back"}</h2>
        <p className="muted">{isReset ? "We'll send a secure reset email." : isRegister ? "Email verification happens before account creation." : "Sign in to continue."}</p>
        <form onSubmit={submit}>
          <input className="modern-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" required />
          {!isReset && <input className="modern-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete={isRegister ? "new-password" : "current-password"} required />}
          {isRegister && <input className="modern-input" value={referral} onChange={(e) => setReferral(e.target.value)} placeholder="Referral code (optional)" maxLength={16} />}
          <button className="btn large glow" type="submit" disabled={loading}>{loading ? "Please wait..." : isReset ? "Send Reset Email" : isRegister ? "Verify Email" : "Sign In"}</button>
        </form>
        {!isReset && <button className="btn large ghost" type="button" onClick={google} disabled={loading}>Continue with Google</button>}
        <div style={{ marginTop: 12 }}>{error && <div className="login-error">{error}</div>}</div>
        <div className="login-links">
          {!isRegister && !isReset && <button className="link-button" onClick={() => setIsReset(true)}>Forgot password?</button>}
          <button className="link-button" onClick={() => { setIsRegister(!isRegister); setIsReset(false); setError(""); }}>{isRegister ? "Already have an account? Sign in" : "Create an account"}</button>
          {isReset && <button className="link-button" onClick={() => { setIsReset(false); setError(""); }}>Back to sign in</button>}
          <Link to="/privacy-policy">Privacy</Link><Link to="/terms">Terms</Link>
        </div>
      </div>

      {otpOpen && <div className="modal-overlay"><div className="modal-content" style={{ maxWidth: 420 }}><h3>Verify your email</h3><p className="muted">Enter the 6-digit code sent to {email}.</p><input className="modern-input" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus /><button className="btn large glow" disabled={loading} onClick={verifyOtpAndRegister}>{loading ? "Verifying..." : "Verify & Create Account"}</button><button className="btn large ghost" disabled={resend > 0 || loading} onClick={sendOtp}>{resend > 0 ? `Resend in ${resend}s` : "Resend OTP"}</button><button className="btn small ghost" disabled={loading} onClick={() => setOtpOpen(false)}>Cancel</button></div></div>}
    </div>
  );
}
