// src/pages/Login.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db, provider } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";

import "../styles/Login.css"; // your neon/gaming css (you said you've added this)

// -------------------- utility --------------------
const friendlyFirebaseError = (err) => {
  if (!err || !err.code) return err?.message || "Unknown error";
  switch (err.code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "This email is already registered. Try signing in or reset password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return err.message || err.code;
  }
};

// -------------------- component --------------------
export default function Login() {
  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // OTP states for registration
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  // UI states
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pwdTyping, setPwdTyping] = useState(false);

  const navigate = useNavigate();
  const otpRef = useRef(null);

  useEffect(() => {
    let t;
    if (otpResendTimer > 0) {
      t = setTimeout(() => setOtpResendTimer((s) => s - 1), 1000);
    }
    return () => clearTimeout(t);
  }, [otpResendTimer]);

  // -------------------- helper: save firestore user --------------------
  async function saveInitialUser(user, referralCode = "") {
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const newReferralCode = user.uid.substring(0, 8).toUpperCase();
        await setDoc(ref, {
          email: user.email,
          displayName: user.displayName || "",
          username: "",
          coins: 0,
          lastDaily: null,
          referral: referralCode || null,
          referralCode: newReferralCode,
          hasRedeemedReferral: !!referralCode,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error("Firestore user creation failed:", e);
    }
  }

  // -------------------- OTP helpers --------------------
  const generateOtp = () => {
    // 6-digit numeric OTP
    return String(Math.floor(100000 + Math.random() * 900000));
  };

  async function sendOtpToEmail(emailToSend, otp) {
    // Try your server endpoint first
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSend, otp }),
      });
      if (!res.ok) throw new Error("server-failed");
      return { ok: true, msg: "sent" };
    } catch (err) {
      // graceful fallback: log OTP to console (dev only)
      console.warn("send-otp failed, falling back to console log. Implement /api/send-otp for real email sending.", err);
      console.info(`DEV OTP for ${emailToSend}: ${otp}`);
      return { ok: false, msg: "dev-logged" };
    }
  }

  function startResendCooldown() {
    setOtpResendTimer(45); // 45s cooldown
  }

  // -------------------- registration flow with OTP --------------------
  async function beginRegistration(e) {
    e.preventDefault();
    setErr("");
    if (!email) return setErr("Please enter email.");
    if (!password || password.length < 6) return setErr("Password must be 6+ characters.");
    setLoading(true);
    try {
      const otp = generateOtp();
      setGeneratedOtp(otp);
      setOtpLoading(true);
      const r = await sendOtpToEmail(email, otp);
      setOtpLoading(false);
      setOtpSent(true);
      startResendCooldown();
      // Focus OTP input
      setTimeout(() => otpRef.current?.focus?.(), 200);
      if (r.ok) {
        setErr("OTP sent — check your email.");
      } else {
        setErr("OTP logged to console for development.");
      }
    } catch (err) {
      console.error("beginRegistration error", err);
      setErr("Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmOtpAndCreate(e) {
    e.preventDefault();
    setErr("");
    if (!otpValue) return setErr("Enter the OTP sent to your email.");
    if (!generatedOtp) return setErr("No OTP generated. Please resend and try again.");
    setLoading(true);
    try {
      if (otpValue !== generatedOtp) {
        setErr("Invalid OTP. Please check and try again.");
        return;
      }

      // OTP OK -> create user
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await saveInitialUser(cred.user, referral);
      try {
        // send firebase email verification also (optional)
        await sendEmailVerification(cred.user);
      } catch (e) {
        console.warn("sendEmailVerification failed", e);
      }

      setErr("Registration successful! You're signed in. We also emailed a verification link.");
      // reset OTP states
      setGeneratedOtp(null);
      setOtpValue("");
      setOtpSent(false);

      // navigate to dashboard (or wherever)
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (error) {
      console.error("confirmOtpAndCreate", error);
      setErr(friendlyFirebaseError(error));
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (otpResendTimer > 0) return;
    setErr("");
    setOtpLoading(true);
    const otp = generateOtp();
    setGeneratedOtp(otp);
    const r = await sendOtpToEmail(email, otp);
    setOtpLoading(false);
    startResendCooldown();
    if (r.ok) setErr("OTP resent — check your email.");
    else setErr("OTP logged to console for dev.");
    setOtpSent(true);
    setOtpValue("");
    setTimeout(() => otpRef.current?.focus?.(), 200);
  }

  // -------------------- login --------------------
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // optionally check email verified:
      // if (!cred.user.emailVerified) { setErr("Please verify your email first."); await auth.signOut(); return; }
      setLoading(false);
      navigate("/dashboard");
    } catch (error) {
      setErr(friendlyFirebaseError(error));
      setLoading(false);
    }
  }

  // -------------------- password reset --------------------
  async function handlePasswordReset(e) {
    e.preventDefault();
    setErr("");
    if (!email) return setErr("Enter your email to reset password.");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setErr("Password reset sent — check your inbox.");
    } catch (error) {
      setErr(friendlyFirebaseError(error));
    } finally {
      setLoading(false);
    }
  }

  // -------------------- Google sign in --------------------
  async function handleGoogle() {
    setErr("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      await saveInitialUser(res.user, referral);
      navigate("/dashboard");
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setErr(friendlyFirebaseError(error));
    } finally {
      setLoading(false);
    }
  }

  // -------------------- resend verification email for existing user --------------------
  async function resendVerificationEmail() {
    setErr("");
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return setErr("You must be signed in to resend verification email.");
      await sendEmailVerification(user);
      setErr("Verification email sent. Check your inbox.");
    } catch (error) {
      setErr(friendlyFirebaseError(error));
    } finally {
      setLoading(false);
    }
  }

  // -------------------- UI helpers --------------------
  function togglePwd() {
    setPwdVisible((s) => !s);
  }

  // small password typing indicator (animated)
  useEffect(() => {
    if (!password) return setPwdTyping(false);
    setPwdTyping(true);
    const id = setTimeout(() => setPwdTyping(false), 800);
    return () => clearTimeout(id);
  }, [password]);

  // -------------------- Render --------------------
  return (
    <div className="auth-root neon-auth">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />
      <div className="auth-card neon-card">
        <img src="/icon.jpg" className="logo-small" alt="logo" onError={(e)=>e.currentTarget.src="/icon.jpg"} />

        {mode === "reset" ? (
          <>
            <h2>Reset Password</h2>
            <p className="text-muted">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={handlePasswordReset} className="form-col">
              <input placeholder="Email" type="email" className="field" value={email} onChange={(e)=>setEmail(e.target.value)} required />
              {err && <div className={`error ${err.includes("sent") ? "success" : ""}`}>{err}</div>}
              <button className="btn neon-btn" type="submit" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
            </form>
            <p className="text-muted">
              Back to{" "}
              <span className="link" onClick={()=>{ setMode("login"); setErr(""); }}>Sign In</span>
            </p>
          </>
        ) : (
          <>
            <h2>{mode === "login" ? "Sign In" : "Create Account"}</h2>

            {/* ---------- registration OTP step ---------- */}
            {mode === "register" && otpSent ? (
              <form onSubmit={confirmOtpAndCreate} className="form-col">
                <div className="muted">We've sent a 6-digit OTP to</div>
                <div className="otp-email">{email}</div>

                <input
                  ref={otpRef}
                  placeholder="Enter OTP"
                  type="text"
                  className="field otp-field"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g,''))}
                  maxLength={6}
                  required
                />

                <div className="otp-actions">
                  <button type="button" className="btn small ghost" onClick={() => { setOtpSent(false); setGeneratedOtp(null); }}>
                    Change Email
                  </button>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn small" onClick={resendOtp} disabled={otpResendTimer > 0 || otpLoading}>
                      {otpLoading ? "Resending..." : (otpResendTimer > 0 ? `Resend in ${otpResendTimer}s` : "Resend OTP")}
                    </button>
                    <button className="btn small" disabled={loading}>{loading ? "Creating..." : "Confirm & Create"}</button>
                  </div>
                </div>

                {err && <div className="error">{err}</div>}
              </form>
            ) : (
              /* ---------- main sign-in/register form ---------- */
              <form onSubmit={mode === "login" ? handleLoginSubmit : beginRegistration} className="form-col">
                <input placeholder="Email" type="email" className="field" value={email} onChange={(e)=>setEmail(e.target.value)} required />
                
                <div className="password-row">
                  <input
                    placeholder="Password (6+ characters)"
                    type={pwdVisible ? "text" : "password"}
                    className={`field password-field ${pwdTyping ? "typing" : ""}`}
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    title={pwdVisible ? "Hide password" : "Show password"}
                    className="eye-btn"
                    onClick={togglePwd}
                    aria-label="Toggle password visibility"
                  >
                    <span className="eye-emoji">{pwdVisible ? "🙈" : "👀"}</span>
                  </button>

                  {/* tiny password activity dot / loader */}
                  <div className={`pwd-loader ${pwdTyping ? "active" : ""}`} aria-hidden />
                </div>

                {mode === "register" && (
                  <input placeholder="Referral Code (optional)" type="text" className="field" value={referral} onChange={(e)=>setReferral(e.target.value)} />
                )}

                {err && <div className="error">{err}</div>}

                <button className="btn neon-btn" type="submit" disabled={loading}>
                  {loading ? (mode === "login" ? "Signing in..." : "Sending OTP...") : (mode === "login" ? "Sign In" : "Register")}
                </button>
              </form>
            )}

            {/* footer controls */}
            <p className="text-muted">
              {mode === "register" ? "Already have an account? " : "Don't have an account? "}
              <span
                className="link"
                onClick={() => { setMode(mode === "register" ? "login" : "register"); setErr(""); setOtpSent(false); setGeneratedOtp(null); }}
              >
                {mode === "register" ? "Sign In" : "Register"}
              </span>
            </p>

            <div className="sep">OR</div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="btn google" onClick={handleGoogle} disabled={loading}>
                Sign in with Google
              </button>
            </div>

            {/* show resend verification link if user is signed but not verified */}
            <div style={{ marginTop: 10, textAlign: "center" }}>
              <button className="btn small ghost" onClick={resendVerificationEmail}>Resend Verification Email</button>
            </div>
          </>
        )}
      </div>

      <div className="login-footer-links">
        <Link to="/privacy-policy">Privacy Policy</Link>
        <span>•</span>
        <Link to="/terms-of-service">Terms of Service</Link>
        <span>•</span>
        <Link to="/about">About Us</Link>
      </div>
    </div>
  );
}
