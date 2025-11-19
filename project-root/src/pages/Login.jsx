// src/pages/Login.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

import { auth, db, provider } from "../firebase";
import "./login.css";
import { Link, useNavigate } from "react-router-dom";

function friendlyFirebaseMessage(code, fallback) {
  if (!code) return fallback || "Something went wrong.";
  const map = {
    "auth/email-already-in-use": "This email is already registered. Try logging in or reset the password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password is too weak — use at least 6 characters.",
    "auth/wrong-password": "Incorrect password. Try again or use 'Forgot Password'.",
    "auth/user-not-found": "No account found with that email. Please register first.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] ?? fallback ?? code;
}

// generate numeric OTP
function genOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");

  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false); // little loader in password field
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [awaitingVerifyUser, setAwaitingVerifyUser] = useState(null); // user object waiting for verification
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(""); // UI code typed by user
  const [devOtpHint, setDevOtpHint] = useState(null); // displayed only in dev mode

  const navigate = useNavigate();
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // create minimal user document in Firestore
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
      console.error("saveInitialUser error:", e);
    }
  }

  // Register (with OTP attempt)
  async function handleRegister(e) {
    e?.preventDefault?.();
    setError(""); setNotice(""); setLoading(true); setDevOtpHint(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = cred.user;

      // save initial Firestore user
      await saveInitialUser(user, referral);

      // generate OTP to try to send via /sendOtp endpoint (if you have a backend)
      const otp = genOTP();

      // Try to POST to /sendOtp (if you have such endpoint) — if it fails we fallback
      let sentOk = false;
      try {
        const res = await fetch("/sendOtp", {
          method: "POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ email: user.email, otp, uid: user.uid }),
        });
        if (res.ok) {
          sentOk = true;
        } else {
          console.warn("sendOtp returned non-ok", res.status);
        }
      } catch (err) {
        console.warn("sendOtp POST failed (no endpoint?)", err);
      }

      if (sentOk) {
        setAwaitingVerifyUser({ uid: user.uid, email: user.email });
        setOtpSent(true);
        setNotice("OTP sent to your email. Enter it below to verify.");
      } else {
        // Fallback: in dev mode generate an OTP, save to Firestore and log it
        if (import.meta.env.DEV) {
          try {
            // Save dev OTP in firestore collection 'devOtps' so UI can validate it
            await addDoc(collection(db, "devOtps"), {
              uid: user.uid,
              email: user.email,
              otp,
              createdAt: serverTimestamp(),
              expiresAt: new Date(Date.now() + 1000 * 60 * 10), // 10 min
            });
            console.debug(`[DEV OTP] for ${user.email} => ${otp}`);
            setDevOtpHint(`DEV OTP logged to console and saved to Firestore (10m).`);
            setAwaitingVerifyUser({ uid: user.uid, email: user.email });
            setOtpSent(true);
            setNotice("DEV OTP created — check browser console (dev only). Enter OTP below to verify.");
          } catch (err) {
            console.error("dev OTP save error", err);
            // fallback to email verification link
            await sendEmailVerification(user);
            setAwaitingVerifyUser({ uid: user.uid, email: user.email });
            setNotice("Verification email sent. Click the link in your inbox to verify.");
          }
        } else {
          // Production fallback — use Firebase sendEmailVerification (link)
          await sendEmailVerification(user, {
            // You can pass actionCodeSettings here if you want to control the continue URL
          });
          setAwaitingVerifyUser({ uid: user.uid, email: user.email });
          setNotice("Verification email sent. Click the link in your inbox to verify.");
        }
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError(friendlyFirebaseMessage(err.code, err.message));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // Resend verification email (or resend OTP in dev)
  async function resendVerification() {
    setError(""); setNotice(""); setLoading(true);
    try {
      const user = auth.currentUser;
      if (user && !user.emailVerified) {
        // Attempt to resend link
        await sendEmailVerification(user);
        setNotice("Verification email resent — check your inbox.");
      } else if (awaitingVerifyUser) {
        // If we have a still-pending user and dev mode, regenerate dev-OTP
        if (import.meta.env.DEV) {
          const otp = genOTP();
          await addDoc(collection(db, "devOtps"), {
            uid: awaitingVerifyUser.uid,
            email: awaitingVerifyUser.email,
            otp,
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 1000 * 60 * 10),
          });
          console.debug(`[DEV OTP] resend for ${awaitingVerifyUser.email} => ${otp}`);
          setDevOtpHint("DEV OTP resent and logged to console (dev only).");
          setNotice("DEV OTP resent — check console.");
          setOtpSent(true);
        } else {
          // Production - we can't send OTP, fallback to link
          setNotice("No OTP service available. Please use verification link sent earlier.");
        }
      } else {
        setError("No pending verification found.");
      }
    } catch (err) {
      console.error("resend error", err);
      setError("Failed to resend verification — try again.");
    } finally {
      setLoading(false);
    }
  }

  // Validate OTP from Firestore dev collection (dev fallback)
  async function validateDevOtpAndFinalize() {
    setError(""); setLoading(true);
    try {
      if (!awaitingVerifyUser) throw new Error("No pending user.");
      // look for matching OTP in devOtps
      const q = query(collection(db, "devOtps"), where("email", "==", awaitingVerifyUser.email));
      const snap = await getDocs(q);
      let found = null;
      snap.forEach((d) => {
        const data = d.data();
        // match otp and not expired
        if (data.otp === otpCode && new Date(data.expiresAt?.toMillis ? data.expiresAt.toMillis() : data.expiresAt).getTime() > Date.now()) {
          found = { id: d.id, data };
        }
      });

      if (!found) {
        setError("OTP not found or expired.");
        return;
      }

      // mark user as verified — easiest approach: update users doc (your code treats emailVerified as firebase auth property,
      // but we can't set firebase.auth().currentUser.emailVerified from client. We'll instead keep a flag in users doc
      // and also signOut current auth to force re-login. For dev this suffices.
      // In production you'd verify OTP on the server and set a custom claim or call Admin SDK.

      // find user by uid
      const userRef = doc(db, "users", awaitingVerifyUser.uid);
      await setDoc(userRef, { emailVerified: true }, { merge: true });

      // cleanup dev OTP doc
      await deleteDoc(doc(db, "devOtps", found.id));
      setNotice("Verified (dev). You can now sign in.");
      setAwaitingVerifyUser(null);
      setOtpSent(false);
      setOtpCode("");
    } catch (err) {
      console.error("validateDevOtp error", err);
      setError("OTP validation failed.");
    } finally {
      setLoading(false);
    }
  }

  // Login
  async function handleLogin(e) {
    e?.preventDefault?.();
    setError(""); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = cred.user;

      // reload user to get latest emailVerified
      await user.reload();

      // read Firestore users doc for dev emailVerified fallback
      const uDoc = await getDoc(doc(db, "users", user.uid));
      const fsEmailVerified = uDoc.exists() && uDoc.data().emailVerified;

      if (!user.emailVerified && !fsEmailVerified) {
        // not verified — block sign in and prompt to verify
        await signOut(auth); // immediately sign out to prevent access
        setAwaitingVerifyUser({ uid: user.uid, email: user.email });
        setNotice("Your email is not verified. Please verify first (link sent to email).");
        setLoading(false);
        return;
      }

      // successful login
      setNotice("");
      navigate("/"); // go to dashboard
    } catch (err) {
      console.error("Login error:", err);
      setError(friendlyFirebaseMessage(err.code, err.message));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // Google sign-in
  async function handleGoogle(e) {
    e?.preventDefault?.();
    setError(""); setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      await saveInitialUser(res.user, referral);
      // check verification: with google provider, email is usually verified by Google
      navigate("/");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  // Password reset
  async function handlePasswordReset(e) {
    e?.preventDefault?.();
    if (!email) { setError("Enter email first."); return; }
    setError(""); setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setNotice("Password reset email sent.");
    } catch (err) {
      console.error("reset error", err);
      setError("Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  // OTP entry UI submit (for dev fallback)
  async function handleOtpSubmit(e) {
    e?.preventDefault?.();
    if (!otpCode) { setError("Enter the OTP"); return; }
    await validateDevOtpAndFinalize();
  }

  // small helper to toggle pw show/hide with animation hint
  function toggleShowPass() {
    setShowPassword((s) => !s);
  }

  return (
    <div className="auth-root login-screen">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />

      <div className="auth-card login-card">
        <img src="/icon.jpg" className="logo-small" alt="logo" onError={(e)=>{e.currentTarget.src="/bt.jpg"}} />

        <h2 className="login-title">{isRegister ? "Create Account" : (isResetMode ? "Reset Password" : "Sign In")}</h2>

        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        {devOtpHint && <div className="notice dev">Dev: {devOtpHint}</div>}

        {/* If user pending verification show OTP / resend UI */}
        {awaitingVerifyUser ? (
          <div className="verify-block">
            <p className="muted">A verification was sent to <strong>{awaitingVerifyUser.email}</strong></p>

            {otpSent && (
              <form onSubmit={handleOtpSubmit} className="otp-form">
                <input className="field otp-field" placeholder="Enter OTP" value={otpCode} onChange={(e)=>setOtpCode(e.target.value.trim())} />
                <button className="btn" type="submit" disabled={loading}>{loading ? "Verifying..." : "Verify OTP"}</button>
              </form>
            )}

            <div className="verify-actions">
              <button className="btn small ghost" onClick={resendVerification} disabled={loading}>{loading ? "Please wait..." : "Resend Verification"}</button>
              <button className="btn small ghost" onClick={() => { setAwaitingVerifyUser(null); setOtpSent(false); setOtpCode(""); setNotice(""); }}>Cancel</button>
            </div>
          </div>
        ) : isResetMode ? (
          <form onSubmit={handlePasswordReset} className="form-col">
            <input placeholder="Email" type="email" className="field" value={email} onChange={(e)=>setEmail(e.target.value)} required />
            <div className="form-actions">
              <button className="btn" type="submit" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={isRegister ? handleRegister : handleLogin} className="form-col">
              <input placeholder="Email" type="email" className="field" value={email} onChange={(e)=>setEmail(e.target.value)} required />

              <div className={`password-wrap ${pwLoading ? "pw-loading" : ""}`}>
                <input
                  placeholder="Password (6+ characters)"
                  type={showPassword ? "text" : "password"}
                  className="field password-field"
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  required
                />
                <button type="button" className="eye-btn" onClick={toggleShowPass} aria-label="Toggle password">
                  {showPassword ? "👀" : "🙈"}
                </button>
                <div className="pw-loader" aria-hidden />
              </div>

              {isRegister && (
                <input placeholder="Referral Code (optional)" type="text" className="field" value={referral} onChange={(e)=>setReferral(e.target.value)} />
              )}

              <div className="form-actions">
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? (isRegister ? "Registering..." : "Signing in...") : (isRegister ? "Register" : "Sign In")}
                </button>
              </div>
            </form>

            <div className="alt-actions">
              {!isRegister && <span className="link" onClick={()=>{ setIsResetMode(true); setError(""); }}>Forgot Password?</span>}
              <span className="link" onClick={()=>{ setIsRegister(!isRegister); setError(""); }}>
                {isRegister ? "Already have an account? Sign in" : "Don't have an account? Register"}
              </span>
            </div>

            <div className="sep">OR</div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn google" onClick={handleGoogle} disabled={loading}>Sign in with Google</button>
            </div>
          </>
        )}

        <div className="login-footer-links">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms-of-service">Terms</Link>
          <span>•</span>
          <Link to="/about">About</Link>
        </div>
      </div>
    </div>
  );
}
