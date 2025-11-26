// src/pages/Login.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
} from "firebase/auth";

import { auth, db, provider } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";

import "../styles/Login.css";

export default function Login() {
  const navigate = useNavigate();

  // form state
  const [isRegister, setIsRegister] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [err, setErr] = useState("");

  // visuals / loading
  const [globalLoading, setGlobalLoading] = useState(false);
  const [loadingButton, setLoadingButton] = useState(false);

  // password visibility
  const [showPassword, setShowPassword] = useState(false);

  // OTP states (array of 6 boxes)
  const [otpPhase, setOtpPhase] = useState(false);
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const resendTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  // Save initial user to Firestore if not exists
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

  // ---------- Helpers: resend timer ----------
  function startResendTimer(seconds = 30) {
    setResendCountdown(seconds);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCountdown((s) => {
        if (s <= 1) {
          clearInterval(resendTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  // ---------- API calls (server) ----------
  async function sendOtpRequest(targetEmail) {
    setOtpSending(true);
    setOtpError("");
    // server-side check for disposable or existing user
    try {
      const checkRes = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const checkJson = await checkRes.json();
      if (!checkRes.ok) {
        setOtpError(checkJson?.error || "Failed to validate email.");
        setOtpSending(false);
        return false;
      }
      if (checkJson.existing) {
        // nicer wording requested earlier
        setOtpError("You already have an account with this email — please sign in.");
        setOtpSending(false);
        return false;
      }
      if (checkJson.disposable) {
        setOtpError("Unverified / temporary email addresses are not allowed.");
        setOtpSending(false);
        return false;
      }
    } catch (e) {
      // if check-email fails, we still try to send OTP but report a warning
      console.warn("check-email failed:", e);
    }

    // send OTP
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOtpError(json?.error || "Failed to send OTP.");
        setOtpSending(false);
        return false;
      }
      startResendTimer(30);
      setOtpSending(false);
      return true;
    } catch (err) {
      console.error("sendOtpRequest error", err);
      setOtpError("Failed to send OTP.");
      setOtpSending(false);
      return false;
    }
  }

  async function verifyOtpRequest(targetEmail, code) {
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        return { ok: false, error: json?.error || "OTP verification failed." };
      }
      return { ok: true };
    } catch (err) {
      console.error("verifyOtpRequest error", err);
      return { ok: false, error: "Network error." };
    }
  }

  // ---------- Auth handlers ----------
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setGlobalLoading(true);
    setLoadingButton(true);

    if (isRegister) {
      if (!email || !password) {
        setErr("Please enter email & password.");
        setGlobalLoading(false);
        setLoadingButton(false);
        return;
      }

      // Start OTP flow
      const ok = await sendOtpRequest(email);
      if (!ok) {
        setErr(otpError || "Failed to send OTP.");
        setGlobalLoading(false);
        setLoadingButton(false);
        return;
      }

      setOtpPhase(true);
      setGlobalLoading(false);
      setLoadingButton(false);
      return;
    }

    // Sign in flow
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setGlobalLoading(false);
      setLoadingButton(false);
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      setErr(mapFirebaseError(error));
      setGlobalLoading(false);
      setLoadingButton(false);
    }
  };

  async function handleGoogle() {
    setErr("");
    setGlobalLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      await saveInitialUser(res.user, referral);
      setGlobalLoading(false);
      navigate("/");
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setErr(mapFirebaseError(error));
      setGlobalLoading(false);
    }
  }

  async function handlePasswordReset(e) {
    e.preventDefault();
    if (!email) {
      setErr("Please enter your email address to reset your password.");
      return;
    }
    setErr("");
    setGlobalLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setGlobalLoading(false);
      setErr("Password reset email sent! Check your inbox.");
      setTimeout(() => {
        setIsResetMode(false);
        setErr("");
      }, 3000);
    } catch (error) {
      console.error("Password Reset error:", error);
      setErr(mapFirebaseError(error));
      setGlobalLoading(false);
    }
  }

  function mapFirebaseError(err) {
    if (!err) return "An error occurred.";
    const code = err.code || "";
    if (code.includes("auth/invalid-email")) return "Please enter a valid email address.";
    if (code.includes("auth/user-not-found")) return "No account found for this email.";
    if (code.includes("auth/wrong-password")) return "Incorrect password.";
    if (code.includes("auth/email-already-in-use")) return "Email already in use.";
    if (err.message) return err.message;
    return String(err);
  }

  // ---------- Confirm OTP -> Create user ----------
  async function handleConfirmOtpAndCreate() {
    const code = otpValues.join("").trim();
    if (!code || code.length < 6) {
      setOtpError("Enter the 6-digit OTP.");
      return;
    }
    setOtpError("");
    setOtpSending(true);
    setGlobalLoading(true);

    const verify = await verifyOtpRequest(email, code);
    if (!verify.ok) {
      setOtpError(verify.error || "Invalid OTP.");
      setOtpSending(false);
      setGlobalLoading(false);
      return;
    }

    // create Firebase auth account
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await saveInitialUser(user, referral);

      setOtpPhase(false);
      setOtpValues(["", "", "", "", "", ""]);
      setOtpSending(false);
      setGlobalLoading(false);
      setErr("Registration successful! You are now signed in.");
      setIsRegister(false);
      setEmail("");
      setPassword("");
      navigate("/");
    } catch (error) {
      console.error("Registration error after OTP:", error);
      setOtpError(mapFirebaseError(error));
      setOtpSending(false);
      setGlobalLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCountdown > 0) return;
    setOtpError("");
    setOtpSending(true);
    setGlobalLoading(true);
    const ok = await sendOtpRequest(email);
    if (!ok) setOtpError("Failed to resend OTP");
    setOtpSending(false);
    setGlobalLoading(false);
  }

  function closeOtpModal() {
    setOtpPhase(false);
    setOtpValues(["", "", "", "", "", ""]);
    setOtpError("");
  }

  // ---------- OTP input helpers ----------
  function onOtpChange(index, value) {
    if (!/^\d*$/.test(value)) return;
    const copy = [...otpValues];
    copy[index] = value.slice(-1);
    setOtpValues(copy);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
      otpRefs.current[index + 1]?.select?.();
    }
  }
  function onOtpKeyDown(index, e) {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const copy = [...otpValues];
      copy[index - 1] = "";
      setOtpValues(copy);
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  }

  // ---------- password strength ----------
  function passwordScore(pw = "") {
    let score = 0;
    if (pw.length >= 6) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0..4
  }
  const pwScore = passwordScore(password);

  return (
    <div className="auth-root login-screen">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />
      <div className="auth-card login-card">
        <img
          src="/icon.jpg"
          className="logo-small"
          alt="logo"
          onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/100?text=Logo")}
        />

        {isResetMode ? (
          <>
            <h2 className="login-title">Reset Password</h2>
            <p className="muted">Enter your email and we'll send a reset link.</p>
            <form onSubmit={handlePasswordReset} className="form-col">
              <input
                placeholder="Email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {err && <div className={err.includes("sent") ? "error success" : "error"}>{err}</div>}
              <div className="form-actions">
                <button className="btn" type="submit" disabled={globalLoading}>
                  {globalLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
            <p className="text-muted">
              Remembered it?{" "}
              <span className="link" onClick={() => { setIsResetMode(false); setErr(""); }}>
                Back to Sign In
              </span>
            </p>
          </>
        ) : (
          <>
            <h2 className="login-title">{isRegister ? "Create Account" : "Sign In"}</h2>

            <form onSubmit={handleAuthSubmit} className="form-col">
              <input
                placeholder="Email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={otpPhase || globalLoading}
              />

              <div className="password-wrap">
                <input
                  placeholder="Password (6+ characters)"
                  type={showPassword ? "text" : "password"}
                  className="field password-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={`eye-toggle ${showPassword ? "on" : ""}`}
                  onClick={() => setShowPassword((s) => !s)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👀" : "🙈"}
                </button>
              </div>

              {/* password strength meter */}
              {isRegister && (
                <div className="pw-strength">
                  <div className="strength-bars">
                    {[0,1,2,3].map(i => (
                      <div
                        key={i}
                        className={`bar ${pwScore > i ? "active" : ""}`}
                        aria-hidden
                      />
                    ))}
                  </div>
                  <div className="strength-text muted">
                    {pwScore <= 1 && "Weak"}
                    {pwScore === 2 && "Okay"}
                    {pwScore >= 3 && "Strong"}
                  </div>
                </div>
              )}

              {isRegister && (
                <input
                  placeholder="Referral Code (optional)"
                  type="text"
                  className="field"
                  value={referral}
                  onChange={(e) => setReferral(e.target.value)}
                />
              )}

              {!isRegister && (
                <div className="forgot-password" style={{ textAlign: "right" }}>
                  <span className="link" onClick={() => { setIsResetMode(true); setErr(""); }}>
                    Forgot Password?
                  </span>
                </div>
              )}

              {err && <div className="error">{err}</div>}

              <div style={{ marginTop: 8 }}>
                <button className="btn" type="submit" disabled={globalLoading || loadingButton}>
                  {globalLoading ? "Processing..." : (isRegister ? "Register" : "Sign In")}
                </button>
              </div>
            </form>

            <p className="text-muted" style={{ marginTop: 10 }}>
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <span className="link" onClick={() => { setIsRegister((s) => !s); setErr(""); }}>
                {isRegister ? "Sign In" : "Register"}
              </span>
            </p>

            <div className="sep">OR</div>

            <button className="btn google" onClick={handleGoogle} disabled={globalLoading}>
              <img src="/google.png" alt="Google" className="google-icon" />
              <span>Sign in with Google</span>
            </button>
          </>
        )}
      </div>

      <div className="login-footer-links">
        <Link to="/privacy-policy">Privacy Policy</Link>
        <span>•</span>
        <Link to="/terms-of-service">Terms of Service</Link>
        <span>•</span>
        <Link to="/about">About Us</Link>
        <span>•</span>
        <Link to="/contact">Contact</Link>
      </div>

      {/* OTP Modal */}
      {otpPhase && (
        <div className="modal-overlay" onClick={closeOtpModal}>
          <div className="modal-content otp-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Account</h3>
            <p className="muted">We've sent a 6-digit OTP to <strong>{email}</strong></p>

            <div className="verify-block">
              <div className="otp-form">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    value={otpValues[i]}
                    onChange={(e) => onOtpChange(i, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(i, e)}
                    maxLength={1}
                    className="otp-field"
                    inputMode="numeric"
                    pattern="\d*"
                    autoFocus={i === 0}
                    aria-label={`OTP digit ${i+1}`}
                  />
                ))}
              </div>

              {otpError && <div className="error" style={{ marginTop: 8 }}>{otpError}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn ghost" onClick={closeOtpModal}>Change Email</button>

                <button className="btn" onClick={handleConfirmOtpAndCreate} disabled={otpSending}>
                  {otpSending ? "Processing..." : "Confirm & Create"}
                </button>

                <button className="btn small ghost" onClick={handleResendOtp} disabled={resendCountdown > 0 || otpSending}>
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend OTP"}
                </button>
              </div>

              <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
                OTP logged to console for development.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global centered spinner overlay */}
      {globalLoading && (
        <div className="global-loading-overlay" role="status" aria-live="polite">
          <div className="global-spinner" />
        </div>
      )}
    </div>
  );
}
