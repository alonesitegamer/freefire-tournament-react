// src/pages/Login.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth, db, provider } from "../firebase";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  updateDoc,
  collection,
  setDoc as setDocWithId,
  getDocs,
  query,
  where,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

/*
  OTP flow summary:
  - On register: createAuthUser -> create user doc in /users -> generate OTP -> store in /emailOtps/{uid} and call send-OTP endpoint to email user
  - Show OTP verification UI and block sign-in until user verifies via OTP
  - On OTP verify: mark users/{uid}.emailVerifiedCustom = true and remove/mark otp doc
  - On login attempt: check users/{uid}.emailVerifiedCustom; if not verified, prompt to verify/resend OTP
*/

const SEND_OTP_ENDPOINT = "/sendOtp"; // <<-- Replace with your function endpoint (full URL when deployed)

export default function Login() {
  const [mode, setMode] = useState("login"); // login | register | reset | otp-verify
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [otpState, setOtpState] = useState({
    step: "idle", // idle | sent | verifying
    sentTo: "",
    uid: null,
    expiresAt: null,
    countdown: 0,
  });
  const [otpValue, setOtpValue] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const navigate = useNavigate();
  const resendTimerRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(resendTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  // Utility: show custom messages (instead of raw firebase errors)
  function showError(e) {
    if (!e) return setErr("");
    const msg = (e?.message || "").toLowerCase();
    if (msg.includes("invalid-email") || msg.includes("invalid email")) return setErr("Please enter a valid email address.");
    if (msg.includes("weak-password")) return setErr("Password is too weak. Use 6+ characters.");
    if (msg.includes("email-already-in-use")) return setErr("This email is already registered. Try signing in or reset password.");
    if (msg.includes("wrong-password")) return setErr("Incorrect password — try again.");
    if (msg.includes("user-not-found")) return setErr("No account found with that email.");
    setErr(e?.message || String(e));
  }

  // --- Save initial user doc in Firestore if missing
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
          emailVerifiedCustom: false, // our custom OTP flag
        });
      }
    } catch (e) {
      console.error("Firestore user creation failed:", e);
    }
  }

  // --- Generate and store OTP and trigger email send
  async function sendOtpToUser(uid, userEmail) {
    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();
    const expiresAt = now + 1000 * 60 * 10; // 10 minutes

    // Store in Firestore collection "emailOtps" with doc id = uid
    // We overwrite any existing OTP for this uid
    try {
      await setDoc(doc(db, "emailOtps", uid), {
        code,
        createdAt: serverTimestamp(),
        expiresAt: new Date(expiresAt),
        consumed: false,
        email: userEmail,
      });
    } catch (e) {
      console.error("Failed to write OTP to Firestore:", e);
      throw e;
    }

    // Call server endpoint to send email
    // The endpoint must accept { uid, email, code } and send an email (cloud function)
    try {
      const resp = await fetch(SEND_OTP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, email: userEmail, code }),
      });

      if (!resp.ok) {
        // For development / debug fallback we still allow OTP to work (console)
        const text = await resp.text();
        console.warn("Send OTP endpoint failed:", text);
        // DON'T throw here: we allow dev fallback so OTP flow can be tested locally
      }
    } catch (e) {
      console.warn("Send OTP network error (dev fallback). OTP is stored in Firestore. (No email sent)", e);
      // dev fallback — show otp in console (ONLY FOR DEV)
      console.info(`[DEV OTP] uid=${uid} code=${code}`);
    }

    return { code, expiresAt };
  }

  // --- Start resend cooldown & countdown UI
  function startResendCooldown(seconds = 30, expiresAt = null) {
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

    if (expiresAt) {
      // start countdown for OTP expiry
      clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
        setOtpState((st) => ({ ...st, countdown: left }));
        if (left <= 0) clearInterval(countdownRef.current);
      }, 1000);
    }
  }

  // --- Register flow: create auth user, user doc, send otp, show otp UI
  async function handleRegister(e) {
    e?.preventDefault && e.preventDefault();
    setErr("");
    if (!email || !password) return setErr("Email and password are required.");
    setLoading(true);

    try {
      // create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // create user doc
      await saveInitialUser(user, referral);

      // generate + store OTP, call send-otp endpoint
      const { expiresAt } = await sendOtpToUser(user.uid, user.email);

      // prepare UI state: show OTP verify UI
      setOtpState({
        step: "sent",
        sentTo: user.email,
        uid: user.uid,
        expiresAt,
        countdown: Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
      });
      startResendCooldown(30, expiresAt);
      setMode("otp-verify");
      setErr(""); // clear msg
    } catch (error) {
      console.error("Registration error:", error);
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  // --- Verify OTP: check Firestore document
  async function handleVerifyOtp(e) {
    e?.preventDefault && e.preventDefault();
    setErr("");
    if (!otpValue || otpValue.trim().length !== 6) return setErr("Enter the 6-digit code we emailed you.");

    setLoading(true);
    setOtpState((s) => ({ ...s, step: "verifying" }));
    try {
      const otpDocRef = doc(db, "emailOtps", otpState.uid);
      const otpSnap = await getDoc(otpDocRef);
      if (!otpSnap.exists()) {
        setErr("No OTP found. Request a new one.");
        return;
      }
      const data = otpSnap.data();
      if (data.consumed) {
        setErr("OTP already used. Request a new code.");
        return;
      }
      const now = Date.now();
      const exp = data.expiresAt ? new Date(data.expiresAt.seconds ? data.expiresAt.toMillis() : data.expiresAt).getTime() : 0;
      if (now > exp) {
        setErr("OTP expired. Request a new code.");
        return;
      }
      if (String(data.code) !== String(otpValue).trim()) {
        setErr("Incorrect code. Check email and try again.");
        return;
      }

      // mark OTP consumed & mark user's emailVerifiedCustom = true
      await updateDoc(doc(db, "users", otpState.uid), { emailVerifiedCustom: true, emailVerifiedAt: serverTimestamp() });
      await updateDoc(otpDocRef, { consumed: true, consumedAt: serverTimestamp() });

      setErr("");
      setOtpValue("");
      setOtpState({ step: "idle", sentTo: "", uid: null, expiresAt: null, countdown: 0 });
      setMode("login"); // go to login
      alert("Email verified — you can now sign in.");
    } catch (error) {
      console.error("OTP verify error:", error);
      showError(error);
    } finally {
      setLoading(false);
      setOtpState((s) => ({ ...s, step: "idle" }));
    }
  }

  // --- Resend OTP
  async function handleResendOtp() {
    if (!otpState.uid) return setErr("No verification in progress.");
    if (resendCooldown > 0) return; // throttle

    setLoading(true);
    setErr("");
    try {
      const userSnap = await getDoc(doc(db, "users", otpState.uid));
      const emailTo = userSnap.exists() ? userSnap.data().email : email || otpState.sentTo;
      const { expiresAt } = await sendOtpToUser(otpState.uid, emailTo);
      setOtpState((s) => ({ ...s, sentTo: emailTo, expiresAt, countdown: Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) }));
      startResendCooldown(30, expiresAt);
      setErr("A new code was sent.");
    } catch (error) {
      console.error("Resend OTP error:", error);
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  // --- Sign in flow: check custom emailVerifiedCustom flag
  async function handleLogin(e) {
    e?.preventDefault && e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      // attempt sign in
      const res = await signInWithEmailAndPassword(auth, email, password);
      const user = res.user;
      // read our users doc to check custom flag
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (!data.emailVerifiedCustom) {
          // sign out immediately and prompt verification flow
          await signOut(auth);
          // create OTP and show OTP UI
          const { expiresAt } = await sendOtpToUser(user.uid, user.email);
          setOtpState({ step: "sent", sentTo: user.email, uid: user.uid, expiresAt, countdown: Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) });
          startResendCooldown(30, expiresAt);
          setMode("otp-verify");
          setErr("Please verify your email first. We sent a 6-digit code to your inbox.");
          return;
        }
      }
      // proceed to app (verified)
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  // --- Google sign-in (we will also ensure user doc exists; if not verified, we treat Google as verified)
  async function handleGoogle() {
    setErr("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      await saveInitialUser(res.user, referral);
      // mark google users as verified automatically:
      await updateDoc(doc(db, "users", res.user.uid), { emailVerifiedCustom: true, emailVerifiedAt: serverTimestamp() });
      navigate("/dashboard");
    } catch (error) {
      console.error("Google error:", error);
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  // --- Password reset UI
  async function handlePasswordReset(e) {
    e?.preventDefault && e.preventDefault();
    if (!email) return setErr("Enter your email to reset password.");
    setLoading(true);
    setErr("");
    try {
      await sendPasswordResetEmail(auth, email);
      setErr("Password reset sent! Check your inbox.");
    } catch (error) {
      console.error("Reset error:", error);
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  // --- UI helpers
  function renderTopMessage() {
    if (err) return <div className="error">{err}</div>;
    if (mode === "register") return <div className="muted">Register a new account — we'll email you a 6-digit code to verify.</div>;
    if (mode === "login") return <div className="muted">Sign in with your email & password.</div>;
    return null;
  }

  // --- Small stylish components & inline animation hooks
  const eyeEmoji = passwordVisible ? "👀" : "🙈";

  return (
    <div className="auth-root stylish-auth">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />

      <div className="auth-card modern">
        <img src="/icon.jpg" className="logo-small" alt="logo" onError={(e)=>e.currentTarget.src="/icon.jpg"} />
        <h2 className="auth-title">{mode === "register" ? "Create Account" : mode === "reset" ? "Reset Password" : "Sign In"}</h2>

        {renderTopMessage()}

        {mode === "otp-verify" ? (
          // OTP verification UI
          <form onSubmit={handleVerifyOtp} className="form-col otp-form">
            <div className="muted">We sent a 6-digit code to <strong>{otpState.sentTo}</strong></div>

            <div className="otp-input-row">
              <input
                placeholder="Enter 6-digit code"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0,6))}
                className="field otp-field"
                inputMode="numeric"
                pattern="\d{6}"
                required
                disabled={otpState.step === "verifying" || loading}
                style={{ letterSpacing: 6, textAlign: "center", fontSize: 20 }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <button className="btn" type="submit" disabled={loading || otpState.step === "verifying"}>
                {loading ? "Verifying..." : "Verify"}
              </button>

              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setMode("login");
                  setOtpValue("");
                  setOtpState({ step: "idle", sentTo: "", uid: null, expiresAt: null, countdown: 0 });
                }}
              >
                Cancel
              </button>

              <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>
                {otpState.countdown > 0 ? `Expires in ${Math.floor(otpState.countdown/60)}:${String(otpState.countdown%60).padStart(2,"0")}` : "No code active"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="link-like"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
              >
                {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Resend code"}
              </button>

              <button
                type="button"
                className="link-like"
                onClick={async () => {
                  // allow user to switch email (go to register)
                  setMode("register");
                }}
              >
                Use different email
              </button>
            </div>
          </form>
        ) : mode === "reset" ? (
          <form onSubmit={handlePasswordReset} className="form-col">
            <input placeholder="Email" type="email" className="field" value={email} onChange={(e)=>setEmail(e.target.value)} required />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" type="submit" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
              <button className="btn ghost" onClick={() => { setMode("login"); setErr(""); }}>Back</button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={mode === "register" ? handleRegister : handleLogin} className="form-col">
              <input placeholder="Email" type="email" className="field" value={email} onChange={(e)=>setEmail(e.target.value)} required />

              <div className="password-row">
                <input
                  placeholder="Password (6+ chars)"
                  type={passwordVisible ? "text" : "password"}
                  className="field password-field"
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setPasswordVisible(v => !v)}
                  title={passwordVisible ? "Hide password" : "Show password"}
                >
                  <span className="eye-emoji">{eyeEmoji}</span>
                </button>
              </div>

              {mode === "register" && (
                <input placeholder="Referral Code (optional)" type="text" className="field" value={referral} onChange={(e)=>setReferral(e.target.value)} />
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? (mode === "register" ? "Registering..." : "Signing in...") : (mode === "register" ? "Register" : "Sign In")}
                </button>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => { setMode(mode === "register" ? "login" : "register"); setErr(""); }}
                >
                  {mode === "register" ? "Switch to Sign In" : "Register"}
                </button>
              </div>
            </form>

            <div className="sep">OR</div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn google" onClick={handleGoogle} disabled={loading}>
                Sign in with Google
              </button>
              <button className="link-like" onClick={() => { setMode("reset"); setErr(""); }}>
                Forgot?
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: 10, fontSize: 13 }}>
          <Link to="/privacy-policy" className="footer-link">Privacy Policy</Link>
          <span style={{ margin: "0 6px", color: "var(--muted)" }}>•</span>
          <Link to="/terms-of-service" className="footer-link">Terms</Link>
        </div>
      </div>

      {/* Styles (you can move these to your CSS) */}
      <style>{`
        .stylish-auth { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
        .auth-root { min-height: 100vh; display:flex; align-items:center; justify-content:center; position:relative; padding:24px; }
        .bg-video { position:fixed; inset:0; object-fit:cover; width:100%; height:100%; z-index:-2; }
        .auth-overlay { position:fixed; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.7)); z-index:-1; }
        .auth-card { width:100%; max-width:420px; background: rgba(10,10,10,0.6); border-radius:12px; padding:20px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.04); }
        .logo-small { width:72px; height:72px; border-radius:14px; display:block; margin: 0 auto 12px; }
        .auth-title { text-align:center; margin: 8px 0 12px; font-weight:700; font-size:20px; }
        .muted { color: #bfc7d1; font-size:13px; text-align:center; margin-bottom:8px; }
        .error { color:#ff7b7b; background: rgba(255,120,120,0.06); padding:8px 10px; border-radius:8px; text-align:center; margin-bottom:10px; }
        .form-col { display:flex; flex-direction:column; gap:8px; }
        .field { background: rgba(255,255,255,0.03); border:none; padding:12px 14px; border-radius:10px; color:#fff; outline:none; font-size:15px; }
        .btn { background: linear-gradient(90deg,#ff8a65,#ff5f6d); border:none; padding:10px 14px; border-radius:10px; color:#fff; cursor:pointer; font-weight:600; }
        .btn.ghost { background:transparent; border:1px solid rgba(255,255,255,0.06); color:#fff; }
        .btn.google { background:#fff; color:#111; font-weight:700; }
        .sep { text-align:center; color:var(--muted); margin:12px 0; }
        .link-like { background:none; border:none; color:#9fd7ff; cursor:pointer; text-decoration:underline; font-size:13px; }
        .password-row { position:relative; display:flex; align-items:center; }
        .eye-toggle { position:absolute; right:8px; background:transparent; border:none; cursor:pointer; font-size:20px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; }
        .eye-emoji { transform-origin:center; transition: transform .18s ease; }
        .eye-toggle:hover .eye-emoji { transform: scale(1.18) rotate(-12deg); }
        .otp-form .otp-field { padding:14px; }
        .link-like[disabled], .btn[disabled] { opacity:0.5; pointer-events:none; }
        .footer-link { color: #bfc7d1; text-decoration:none; font-size:13px; }
      `}</style>
    </div>
  );
}
