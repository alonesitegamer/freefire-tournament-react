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

import "../styles/Login.css"; // ensure this file exists

export default function Login() {
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isResetMode, setIsResetMode] = useState(false);
  const [referral, setReferral] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // OTP modal state
  const [otpPhase, setOtpPhase] = useState(false);
  const [otpValueArr, setOtpValueArr] = useState(["", "", "", "", "", ""]);
  const otpInputsRef = useRef([]);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const resendTimerRef = useRef(null);

  // password visibility
  const [showPassword, setShowPassword] = useState(false);

  // global overlay spinner
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

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

  // ---- OTP helpers ----
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

  async function sendOtpRequest(targetEmail) {
    setOtpSending(true);
    setOtpError("");
    // pre-check: existing user and disposable detection
    try {
      const checkRes = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const checkJson = await checkRes.json();
      if (!checkRes.ok) {
        // check endpoint returned an error message we should show
        setOtpError(checkJson?.error || "Failed to validate email.");
        setOtpSending(false);
        return false;
      }
      if (checkJson.existing) {
        setOtpError("An account already exists with this email. Please sign in.");
        setOtpSending(false);
        return false;
      }
      if (checkJson.disposable) {
        setOtpError("Disposable / temporary email addresses are not allowed.");
        setOtpSending(false);
        return false;
      }
    } catch (e) {
      console.error("check-email error", e);
      // allow fallback to send OTP (but we'll show error)
    }

    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOtpError(json?.error || "Failed to send OTP");
        setOtpSending(false);
        return false;
      }
      // success
      startResendTimer(30);
      setOtpSending(false);
      return true;
    } catch (err) {
      console.error("sendOtpRequest error", err);
      setOtpError("Failed to send OTP");
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
        return { ok: false, error: json?.error || "OTP verify failed" };
      }
      return { ok: true };
    } catch (err) {
      console.error("verifyOtpRequest error", err);
      return { ok: false, error: "Network error" };
    }
  }

  // ---- Auth handlers ----
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setGlobalLoading(true);

    if (isRegister) {
      // Start OTP flow: don't create auth user yet.
      if (!email || !password) {
        setErr("Please enter email & password.");
        setGlobalLoading(false);
        return;
      }

      // send OTP
      const ok = await sendOtpRequest(email);
      if (!ok) {
        setErr(otpError || "Failed to send OTP");
        setGlobalLoading(false);
        return;
      }

      // open OTP modal
      setOtpPhase(true);
      setGlobalLoading(false);
      return;
    }

    // sign in flow
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setGlobalLoading(false);
      navigate("/"); // or whatever route
    } catch (error) {
      console.error("Login error:", error);
      setErr(customAuthError(error));
      setGlobalLoading(false);
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
      setErr(customAuthError(error));
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
      setErr(customAuthError(error));
      setGlobalLoading(false);
    }
  }

  function customAuthError(err) {
    if (!err) return "An error occurred.";
    const code = err.code || "";
    if (code.includes("auth/invalid-email")) return "Please enter a valid email address.";
    if (code.includes("auth/user-not-found")) return "No account found for this email.";
    if (code.includes("auth/wrong-password")) return "Incorrect password.";
    if (code.includes("auth/email-already-in-use")) return "Email already in use.";
    if (err.message) return err.message;
    return String(err);
  }

  // Called when user confirms OTP in modal
  async function handleConfirmOtpAndCreate() {
    const code = otpValueArr.join("").trim();
    if (!code || code.length < 6) {
      setOtpError("Enter the 6-digit OTP.");
      return;
    }
    setOtpError("");
    setOtpSending(true);
    setGlobalLoading(true);

    const verify = await verifyOtpRequest(email, code);
    if (!verify.ok) {
      setOtpError(verify.error || "Invalid OTP");
      setOtpSending(false);
      setGlobalLoading(false);
      return;
    }

    // OTP ok -> create auth user
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await saveInitialUser(user, referral);
      setOtpPhase(false);
      setOtpValueArr(["", "", "", "", "", ""]);
      setOtpSending(false);
      setGlobalLoading(false);
      setErr("Registration successful! You are signed in.");
      setIsRegister(false);
      setEmail("");
      setPassword("");
      navigate("/");
    } catch (error) {
      console.error("Registration error after OTP:", error);
      setOtpError(customAuthError(error));
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
    setOtpValueArr(["", "", "", "", "", ""]);
    setOtpError("");
  }

  // OTP input helpers
  function handleOtpChange(index, value) {
    if (!/^\d*$/.test(value)) return; // only numbers
    const arr = [...otpValueArr];
    arr[index] = value.slice(-1); // last char
    setOtpValueArr(arr);
    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  }
  function handleOtpKeyDown(index, e) {
    if (e.key === "Backspace" && !otpValueArr[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
      const arr = [...otpValueArr];
      arr[index - 1] = "";
      setOtpValueArr(arr);
    }
    if (e.key === "ArrowLeft" && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  }

  return (
    <div className="auth-root login-screen">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />
      <div className="auth-card login-card">
        <img src="/icon.jpg" className="logo-small" alt="logo" onError={(e)=>e.currentTarget.src="https://via.placeholder.com/100?text=Logo"} />

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
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
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
                disabled={otpPhase}
              />

              <div className={`password-wrap ${loading ? "pw-loading" : ""}`}>
                <input
                  placeholder="Password (6+ characters)"
                  type={showPassword ? "text" : "password"}
                  className={`field password-field ${showPassword ? "show" : ""}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={`eye-btn ${showPassword ? "active" : ""}`}
                  onClick={() => setShowPassword((s) => !s)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👀" : "🙈"}
                </button>
                <div className="pw-loader" aria-hidden />
              </div>

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
                <button className="btn" type="submit" disabled={globalLoading}>
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
            <button className="btn google" onClick={handleGoogle} disabled={globalLoading}>Sign in with Google</button>
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
                    ref={(el) => (otpInputsRef.current[i] = el)}
                    value={otpValueArr[i]}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    maxLength={1}
                    className="otp-field field"
                    inputMode="numeric"
                    pattern="\d*"
                    autoFocus={i === 0}
                    style={{ textAlign: "center", fontSize: 20 }}
                  />
                ))}
              </div>

              {otpError && <div className="error" style={{ marginTop: 8 }}>{otpError}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="btn ghost" onClick={() => { closeOtpModal(); }}>
                  Change Email
                </button>

                <button
                  className="btn"
                  onClick={handleConfirmOtpAndCreate}
                  disabled={otpSending}
                >
                  {otpSending ? "Processing..." : "Confirm & Create"}
                </button>

                <button
                  className="btn small ghost"
                  onClick={handleResendOtp}
                  disabled={resendCountdown > 0 || otpSending}
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend OTP"}
                </button>
              </div>
              <div style={{ marginTop: 12, color: "var(--muted)" }}>
                OTP logged to console for development.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global centered spinner overlay */}
      {globalLoading && (
        <div className="global-loading-overlay">
          <div className="global-spinner" />
        </div>
      )}
    </div>
  );
}
