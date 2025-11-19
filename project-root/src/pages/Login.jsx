// src/pages/Login.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db, provider } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Login.css"; // make sure this exists (you said you added it)

/*
  Login.jsx: Email/password + OTP verification for registration
  - Option C: 6 large boxes OTP input
  - Animated eye toggle (🙈 / 👀)
  - Resend OTP with cooldown
  - Dev fallback logs OTP to console if /api/send-otp not available
*/

function SaveInitialUserToFirestore(user, referralCode = "") {
  // helper to create the user doc if not exists
  return (async function () {
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
    } catch (err) {
      console.error("Firestore user creation failed:", err);
    }
  })();
}

export default function Login() {
  const navigate = useNavigate();

  // auth UI
  const [isRegister, setIsRegister] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  // fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");

  // UX state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // password reveal
  const [showPwd, setShowPwd] = useState(false);
  const pwdAnimateRef = useRef(null);

  // OTP flow
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState(null);
  const [otpRequestId, setOtpRequestId] = useState(null); // optional server id
  const [devOtp, setDevOtp] = useState(null); // dev fallback OTP store
  const [otpInputs, setOtpInputs] = useState(["", "", "", "", "", ""]);
  const inputsRef = useRef([]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef(null);

  // helper: show errors with custom mapping
  function showError(e) {
    if (!e) {
      setErr("");
      return;
    }
    // custom messages for common Firebase errors
    const msg = (e && e.code) || (e && e.message) || String(e);
    if (msg.includes("auth/invalid-email")) setErr("Please enter a valid email address.");
    else if (msg.includes("auth/weak-password")) setErr("Password should be at least 6 characters.");
    else if (msg.includes("auth/email-already-in-use")) setErr("Email already in use. Try signing in.");
    else if (msg.includes("auth/wrong-password")) setErr("Incorrect password. Try again.");
    else if (msg.includes("auth/user-not-found")) setErr("No account found with this email.");
    else setErr(typeof e === "string" ? e : msg);
  }

  // OTP helpers
  useEffect(() => {
    return () => clearInterval(resendTimerRef.current);
  }, []);

  function startResendCooldown(seconds = 30) {
    setResendCooldown(seconds);
    clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(resendTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function callSendOtp(emailToSend) {
    // Try server endpoint first
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSend }),
      });

      if (!res.ok) {
        // server returned error — allow fallback for dev
        const text = await res.text();
        console.warn("send-otp failed:", res.status, text);
        throw new Error("send-otp failed");
      }

      const json = await res.json();
      // expected shape: { ok: true, requestId?: "...", message?: "..."}
      return { ok: true, requestId: json.requestId || null };
    } catch (e) {
      // Dev fallback: generate OTP locally and log it for developer to see
      // IMPORTANT: only for dev/testing. Remove or disable in production.
      if (import.meta.env && import.meta.env.DEV) {
        const fallback = String(Math.floor(100000 + Math.random() * 900000));
        console.info("%c[DEV-OTP] OTP for", "color: #8af", emailToSend, "=>", fallback);
        return { ok: false, devOtp: fallback };
      }
      // if not dev, bubble up the error to show user
      throw e;
    }
  }

  async function callVerifyOtp(emailToVerify, otp) {
    // Attempt server verify (optional)
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToVerify, otp }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.warn("verify-otp failed:", res.status, text);
        throw new Error("verify-otp failed");
      }
      const json = await res.json();
      // expects { ok: true } if valid
      return json.ok === true;
    } catch (e) {
      // If server isn't present, rely on devOtp fallback match
      if (import.meta.env && import.meta.env.DEV) {
        return otp === devOtp;
      }
      // If server exists but error, treat as invalid
      console.error("verify-otp error:", e);
      return false;
    }
  }

  // *** UI: OTP modal helpers ***
  function openOtpModalFor(emailTo) {
    setOtpInputs(["", "", "", "", "", ""]);
    inputsRef.current = [];
    setOtpModalOpen(true);
    setOtpSentTo(emailTo);
    setErr("");
    setSuccessMsg("");
    startResendCooldown(30);
    // focus first input shortly after modal open
    setTimeout(() => inputsRef.current[0]?.focus?.(), 260);
  }

  function closeOtpModal() {
    setOtpModalOpen(false);
    setOtpSentTo(null);
    setOtpRequestId(null);
    setDevOtp(null);
    setOtpInputs(["", "", "", "", "", ""]);
  }

  function otpValue() {
    return otpInputs.join("");
  }

  function handleOtpChange(index, val) {
    if (!val) {
      // deleting char
      setOtpInputs((prev) => {
        const copy = [...prev];
        copy[index] = "";
        return copy;
      });
      return;
    }
    const ch = val.slice(-1).replace(/\D/g, ""); // only last digit, numeric
    if (!ch) return;
    setOtpInputs((prev) => {
      const copy = [...prev];
      copy[index] = ch;
      return copy;
    });
    // focus next
    const next = index + 1;
    if (next < 6) inputsRef.current[next]?.focus?.();
  }

  function handleOtpKeyDown(e, i) {
    if (e.key === "Backspace" && !otpInputs[i]) {
      const prev = i - 1;
      if (prev >= 0) inputsRef.current[prev]?.focus?.();
    }
    if (e.key === "ArrowLeft") {
      const prev = i - 1;
      if (prev >= 0) inputsRef.current[prev]?.focus?.();
    }
    if (e.key === "ArrowRight") {
      const next = i + 1;
      if (next < 6) inputsRef.current[next]?.focus?.();
    }
    // allow paste handling via onPaste
  }

  function handleOtpPaste(e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
    if (!pasted) return;
    const chars = pasted.slice(0, 6).split("");
    const filled = [...otpInputs];
    for (let i = 0; i < 6; i++) filled[i] = chars[i] || "";
    setOtpInputs(filled);
    // focus end
    const firstEmpty = filled.findIndex((c) => !c);
    if (firstEmpty >= 0) inputsRef.current[firstEmpty]?.focus?.();
    else inputsRef.current[5]?.focus?.();
  }

  // -------- AUTH HANDLERS --------
  async function handleAuthSubmit(e) {
    e?.preventDefault?.();
    setErr("");
    setSuccessMsg("");
    setLoading(true);

    // Reset mode quick handling
    if (isResetMode) {
      if (!email) {
        setErr("Enter your email to reset password.");
        setLoading(false);
        return;
      }
      try {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Reset link sent. Check your inbox.");
      } catch (ex) {
        showError(ex);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email) {
      setErr("Please enter email.");
      setLoading(false);
      return;
    }
    if (!password || password.length < 6) {
      setErr("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    if (isRegister) {
      // Registration: initiate OTP send -> open modal
      try {
        const resp = await callSendOtp(email);
        if (resp.ok && resp.requestId) {
          setOtpRequestId(resp.requestId);
        } else if (resp.ok === false && resp.devOtp) {
          // dev fallback: server missing; store OTP locally for verification
          setDevOtp(resp.devOtp);
          console.info("[DEV-OTP GENERATED]", resp.devOtp);
        }
        openOtpModalFor(email);
        setSuccessMsg("OTP sent to your email — check inbox/spam.");
      } catch (ex) {
        console.error("sendOtp failed", ex);
        showError(ex);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Sign in (normal)
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/"); // or dashboard route
    } catch (ex) {
      showError(ex);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setErr("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      await SaveInitialUserToFirestore(res.user, referral);
      navigate("/");
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtpAndCreate() {
    setErr("");
    setLoading(true);
    const otp = otpValue();
    if (otp.length !== 6) {
      setErr("Enter the 6-digit OTP.");
      setLoading(false);
      return;
    }

    // verify via server if available; else use devOtp fallback
    let ok = false;
    try {
      ok = await callVerifyOtp(email, otp);
      if (!ok && devOtp && otp === devOtp) ok = true;
    } catch (e) {
      console.error("verifyOtp error", e);
    }

    if (!ok) {
      setErr("Invalid OTP. Try again or resend.");
      setLoading(false);
      return;
    }

    // OTP OK: create user account
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // save initial user doc
      await SaveInitialUserToFirestore(cred.user, referral);
      // optionally mark email verified server-side if your server supports it.
      // We log in the user directly because OTP validated the email.
      navigate("/");
    } catch (e) {
      console.error("createUser error", e);
      showError(e);
    } finally {
      setLoading(false);
      closeOtpModal();
    }
  }

  async function handleResendOtp() {
    setErr("");
    setLoading(true);
    try {
      const resp = await callSendOtp(email);
      if (resp.ok && resp.requestId) setOtpRequestId(resp.requestId);
      else if (resp.ok === false && resp.devOtp) {
        setDevOtp(resp.devOtp);
        console.info("[DEV-OTP GENERATED]", resp.devOtp);
      }
      startResendCooldown(30);
      setSuccessMsg("OTP resent. Check your inbox.");
    } catch (e) {
      console.error("resendOtp error", e);
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  // small animated helper for password loader
  function eyeClicked() {
    // small pulse animation
    if (pwdAnimateRef.current) {
      pwdAnimateRef.current.classList.remove("eye-tap");
      // reflow
      void pwdAnimateRef.current.offsetWidth;
      pwdAnimateRef.current.classList.add("eye-tap");
    }
    setShowPwd((s) => !s);
  }

  // ------------ RENDER ------------
  return (
    <div className="auth-root">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />
      <div className="auth-card">
        <img
          src="/icon.jpg"
          className="logo-small"
          alt="logo"
          onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/100?text=Logo")}
        />

        {isResetMode ? (
          <>
            <h2>Reset Password</h2>
            <p className="text-muted">Enter email to receive a reset link.</p>
            <form onSubmit={handleAuthSubmit} className="form-col">
              <input
                placeholder="Email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {err && <div className="error">{err}</div>}
              {successMsg && <div className="success">{successMsg}</div>}
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
            <p className="text-muted">
              Back to{" "}
              <span className="link" onClick={() => { setIsResetMode(false); setErr(""); }}>
                Sign In
              </span>
            </p>
          </>
        ) : (
          <>
            <h2>{isRegister ? "Create Account" : "Sign In"}</h2>
            <form onSubmit={handleAuthSubmit} className="form-col" autoComplete="on">
              <input
                placeholder="Email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="password-row">
                <input
                  placeholder="Password (6+ characters)"
                  type={showPwd ? "text" : "password"}
                  className={`field password-field ${loading ? "loading" : ""}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  ref={pwdAnimateRef}
                  className="eye-toggle"
                  title={showPwd ? "Hide password" : "Show password"}
                  onClick={eyeClicked}
                >
                  <span className="eye-emoji">{showPwd ? "👀" : "🙈"}</span>
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

              {!isRegister && (
                <div className="forgot-password">
                  <span className="link" onClick={() => { setIsResetMode(true); setErr(""); }}>
                    Forgot Password?
                  </span>
                </div>
              )}

              {err && <div className="error">{err}</div>}
              {successMsg && <div className="success">{successMsg}</div>}

              <button className="btn" type="submit" disabled={loading}>
                {loading ? (isRegister ? "Sending OTP..." : "Signing in...") : (isRegister ? "Register" : "Sign In")}
              </button>
            </form>

            <p className="text-muted">
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <span
                className="link"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setErr("");
                  setSuccessMsg("");
                }}
              >
                {isRegister ? "Sign In" : "Register"}
              </span>
              { !isRegister && <> • <span className="link" onClick={() => { setIsResetMode(true); setErr(""); }}>Reset</span></>}
            </p>

            <div className="sep">OR</div>
            <button className="btn google" onClick={handleGoogleSignIn} disabled={loading}>
              Sign in with Google
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

      {/* ===== OTP Modal (Style C: big boxes) ===== */}
      {otpModalOpen && (
        <div className="modal-overlay otp-modal" onClick={closeOtpModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Verify your email</h3>
            <p className="muted">We've sent a 6-digit code to <strong>{otpSentTo}</strong>. Enter it below.</p>

            <div className="otp-boxes" onPaste={handleOtpPaste}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => (inputsRef.current[i] = el)}
                  value={otpInputs[i]}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(e, i)}
                  className="otp-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                />
              ))}
            </div>

            <div className="otp-actions-row">
              <button className="btn small primary" onClick={handleVerifyOtpAndCreate} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Create Account"}
              </button>

              <button className="btn small ghost" onClick={closeOtpModal} disabled={loading}>
                Cancel
              </button>
            </div>

            <div className="otp-footer">
              <div>
                {resendCooldown > 0 ? (
                  <span className="muted">Resend available in {resendCooldown}s</span>
                ) : (
                  <button className="link small" onClick={handleResendOtp} disabled={loading}>
                    Resend OTP
                  </button>
                )}
              </div>

              <div className="muted small" style={{ marginTop: 8 }}>
                <em>Didn't receive? check spam. (For dev, OTP will appear in console.)</em>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
