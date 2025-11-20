// src/pages/Login.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, db, provider } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom";
import "./styles/Login.css"; // your styles (you said you added them)

function friendlyFirebaseError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (code.includes("email-already-in-use")) return "This email is already registered. Try signing in.";
  if (code.includes("weak-password")) return "Password is too weak. Use at least 6 characters.";
  if (code.includes("wrong-password")) return "Incorrect password. Try again or reset password.";
  if (code.includes("user-not-found")) return "No account found with that email.";
  // fallback
  return err?.message || "An unexpected error occurred.";
}

export default function Login() {
  // --- auth form mode + fields
  const [isRegister, setIsRegister] = useState(true); // default create account per your screenshots
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // --- OTP flow state
  const [otpStage, setOtpStage] = useState(false); // when true we show OTP confirm modal
  const [otpInput, setOtpInput] = useState("");
  const [serverOtpSent, setServerOtpSent] = useState(null); // used for dev fallback
  const [resendTimer, setResendTimer] = useState(0);
  const resendRef = useRef(null);

  // --- UI states: password show/hide + spinner in password field
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // --- general helpers
  async function saveInitialUser(userObj, referralCode = "") {
    try {
      const ref = doc(db, "users", userObj.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const newReferralCode = userObj.uid.substring(0, 8).toUpperCase();
        await setDoc(ref, {
          email: userObj.email,
          displayName: userObj.displayName || "",
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

  // -----------------------
  // OTP utilities
  // -----------------------
  function generateOtp() {
    // 6-digit numeric OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async function sendOtpToEmail(targetEmail) {
    setErr("");
    setPwLoading(true);
    const otp = generateOtp();

    // start resend cooldown
    startResendCooldown(30);

    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, otp }),
      });

      if (!res.ok) {
        // fallback / dev: if API fails (CORS / server), do dev fallback and continue
        const txt = await res.text().catch(() => null);
        console.warn("send-otp failed:", res.status, txt);
        // Dev fallback: keep OTP locally so user can continue while dev fixes endpoint
        console.warn(`DEV-Fallback OTP for ${targetEmail}: ${otp}`);
        setServerOtpSent(otp);
        setOtpStage(true);
        setPwLoading(false);
        return { ok: false, devFallback: true };
      }

      const json = await res.json();
      if (json.success) {
        setServerOtpSent(otp); // still store briefly for optional dev-check; in prod you can clear this
        setOtpStage(true);
        setPwLoading(false);
        return { ok: true };
      } else {
        console.warn("send-otp returned not-ok", json);
        // fallback
        console.warn(`DEV-Fallback OTP for ${targetEmail}: ${otp}`);
        setServerOtpSent(otp);
        setOtpStage(true);
        setPwLoading(false);
        return { ok: false, devFallback: true };
      }
    } catch (e) {
      console.error("send-otp error", e);
      // dev fallback
      console.warn(`DEV-Fallback OTP for ${targetEmail}: ${otp}`);
      setServerOtpSent(otp);
      setOtpStage(true);
      setPwLoading(false);
      return { ok: false, devFallback: true };
    }
  }

  function startResendCooldown(seconds = 30) {
    setResendTimer(seconds);
    if (resendRef.current) clearInterval(resendRef.current);
    resendRef.current = setInterval(() => {
      setResendTimer((s) => {
        if (s <= 1) {
          clearInterval(resendRef.current);
          resendRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleResendOtp() {
    if (!email) return setErr("Please enter an email first.");
    if (resendTimer > 0) return;
    await sendOtpToEmail(email);
  }

  // -----------------------
  // Register flow with OTP
  // -----------------------
  const handleAuthSubmit = async (e) => {
    e?.preventDefault?.();
    setErr("");
    if (!email) return setErr("Please enter email.");
    if (!password || password.length < 6) return setErr("Password must have at least 6 characters.");
    setLoading(true);

    if (isRegister) {
      // 1) send OTP to email
      const send = await sendOtpToEmail(email);
      if (!send) {
        // if send failed but dev fallback allowed, we still show OTP stage
        setLoading(false);
        return;
      }
      setLoading(false);
      return;
    } else {
      // sign in flow
      try {
        await signInWithEmailAndPassword(auth, email, password);
        setLoading(false);
      } catch (error) {
        setErr(friendlyFirebaseError(error));
        setLoading(false);
      }
    }
  };

  // Confirm OTP -> create account and force email verification
  const confirmOtpAndCreate = async () => {
    setErr("");
    if (!otpInput || otpInput.length < 4) return setErr("Enter the OTP sent to your email.");
    // simple match with serverOtpSent ONLY for dev fallback; in prod the server handled it
    // but since our api just sends the otp, we must trust the user typed the same otp
    // (you can implement server-side OTP verification & persistence for stricter flow)
    if (serverOtpSent && otpInput !== serverOtpSent) {
      // If serverOtpSent is present (dev fallback), enforce match
      setErr("Incorrect OTP. Check your email and try again.");
      return;
    }

    setLoading(true);
    try {
      // create user
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      // save user doc
      await saveInitialUser(user, referral);

      // send firebase verification email
      await sendEmailVerification(user);

      // Immediately sign-out so user can't access app before clicking verification link
      await firebaseSignOut(auth);

      setLoading(false);
      setOtpStage(false);
      setServerOtpSent(null);
      setOtpInput("");
      setErr("Account created — verification email sent. Please click the link to verify your account before signing in.");
    } catch (error) {
      console.error("create user error", error);
      setErr(friendlyFirebaseError(error));
      setLoading(false);
    }
  };

  // Resend verification email for signed-in user (only displays if signed in)
  async function handleResendVerificationEmail() {
    setErr("");
    setLoading(true);
    try {
      const current = auth.currentUser;
      if (!current) {
        setErr("Not signed in — sign in first to resend verification email.");
        setLoading(false);
        return;
      }
      await sendEmailVerification(current);
      setErr("Verification email resent. Check your inbox.");
    } catch (e) {
      setErr("Failed to resend verification email.");
    } finally {
      setLoading(false);
    }
  }

  // Google sign-in (same as before)
  const handleGoogle = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      await saveInitialUser(res.user, referral);
      setLoading(false);
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setErr(friendlyFirebaseError(error));
      setLoading(false);
    }
  };

  // password reset
  const handlePasswordReset = async (e) => {
    e?.preventDefault?.();
    if (!email) {
      setErr("Please enter your email address to reset your password.");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      await sendPasswordResetEmail(auth, email);
      setErr("Password reset email sent! Check your inbox.");
    } catch (error) {
      setErr(friendlyFirebaseError(error));
    } finally {
      setLoading(false);
    }
  };

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (resendRef.current) clearInterval(resendRef.current);
    };
  }, []);

  // password input animated spinner tiny component
  const PasswordSpinner = ({ show }) => (
    <div className={`pw-spinner ${show ? "visible" : ""}`} aria-hidden>
      <svg width="18" height="18" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="4" strokeDasharray="31.4 31.4">
          <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );

  return (
    <div className="auth-root">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />

      <div className="auth-card">
        <img src="/icon.jpg" className="logo-small" alt="logo" onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/100?text=Logo")} />

        {/* Main form */}
        {!otpStage ? (
          <>
            <h2>{isRegister ? "Create Account" : "Sign In"}</h2>

            <form onSubmit={handleAuthSubmit} className="form-col" autoComplete="off">
              <input
                placeholder="Email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="password-wrap" style={{ position: "relative" }}>
                <input
                  placeholder="Password (6+ characters)"
                  type={showPw ? "text" : "password"}
                  className="field pw-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ background: "transparent" }}
                />
                {/* animated spinner inside password */}
                <PasswordSpinner show={pwLoading || loading} />

                {/* eye toggle button (transparent background) */}
                <button
                  type="button"
                  title={showPw ? "Hide password" : "Show password"}
                  className="pw-eye-btn"
                  onClick={() => setShowPw((s) => !s)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    fontSize: 20,
                    cursor: "pointer",
                    padding: 6,
                    lineHeight: 1,
                  }}
                >
                  {showPw ? "🙈" : "👀"}
                </button>
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

              {err && <div className={err.toLowerCase().includes("sent") ? "error success" : "error"}>{err}</div>}

              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Processing..." : (isRegister ? "Register" : "Sign In")}
              </button>
            </form>

            <p className="text-muted">
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <span
                className="link"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setErr("");
                }}
              >
                {isRegister ? "Sign In" : "Register"}
              </span>
            </p>

            <div className="sep">OR</div>

            <button className="btn google" onClick={handleGoogle} disabled={loading}>
              Sign in with Google
            </button>

            <div style={{ marginTop: 8 }}>
              <button className="btn ghost small" onClick={() => { setErr(""); setIsRegister(false); }}>
                Resend Verification Email
              </button>
            </div>
          </>
        ) : (
          /* OTP Stage */
          <div className="otp-stage">
            <h3>Create Account</h3>
            <p className="text-muted">We've sent a 6-digit OTP to <strong>{email}</strong></p>

            <input
              placeholder="Enter OTP"
              type="text"
              className="field"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", justifyContent: "center" }}>
              <button
                className="btn ghost small"
                onClick={() => {
                  // change email: go back
                  setOtpStage(false);
                  setServerOtpSent(null);
                  setOtpInput("");
                }}
              >
                Change Email
              </button>

              <button
                className="btn small"
                onClick={() => confirmOtpAndCreate()}
                disabled={loading}
              >
                {loading ? "Creating..." : "Confirm & Create"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center", alignItems: "center" }}>
              <button className="btn ghost small" onClick={handleResendOtp} disabled={resendTimer > 0}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
              </button>
            </div>

            {/* dev fallback note */}
            {serverOtpSent && (
              <div className="error" style={{ marginTop: 12 }}>
                OTP logged to console for development.
              </div>
            )}

            <div style={{ marginTop: 14, textAlign: "center" }}>
              <Link to="/login" className="link small">Already have an account? Sign In</Link>
            </div>
          </div>
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
    </div>
  );
}
