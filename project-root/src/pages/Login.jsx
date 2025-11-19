import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth, db, provider } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom";

// ------------------------------------------------------
// 🔥 Friendly Error Translator
// ------------------------------------------------------
function friendlyFirebaseError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "This email is already registered. Try logging in.";
    case "auth/weak-password":
      return "Password must be at least 6 characters long.";
    case "auth/wrong-password":
      return "Incorrect password. Try again.";
    case "auth/user-not-found":
      return "No account exists with this email.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was closed. Try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// ------------------------------------------------------
// Create Firestore User
// ------------------------------------------------------
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
  } catch (err) {
    console.error("Firestore creation error:", err);
  }
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isResetMode, setIsResetMode] = useState(false);
  const [referral, setReferral] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ------------------------------------------------------
  // REGISTER / LOGIN
  // ------------------------------------------------------
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    if (isRegister) {
      // -------------------
      // ✔ Register User
      // -------------------
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await saveInitialUser(userCred.user, referral);

        // 🔐 EMAIL VERIFICATION REQUIRED
        await sendEmailVerification(userCred.user);

        setErr("A verification email has been sent. Please verify before logging in.");
        setLoading(false);
      } catch (error) {
        setErr(friendlyFirebaseError(error.code));
        setLoading(false);
      }
    } else {
      // -------------------
      // ✔ LOGIN USER (only if verified)
      // -------------------
      try {
        const res = await signInWithEmailAndPassword(auth, email, password);

        if (!res.user.emailVerified) {
          setErr("Please verify your email before logging in.");
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (error) {
        setErr(friendlyFirebaseError(error.code));
        setLoading(false);
      }
    }
  };

  // ------------------------------------------------------
  // Google Login
  // ------------------------------------------------------
  const handleGoogle = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);

      if (!res.user.emailVerified) {
        await sendEmailVerification(res.user);
        setErr("Google account detected! Please verify the email sent to your inbox.");
      }

      await saveInitialUser(res.user, referral);
    } catch (error) {
      setErr(friendlyFirebaseError(error.code));
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------
  // Reset Password
  // ------------------------------------------------------
  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (!email) {
      setErr("Enter your email to reset password.");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      await sendPasswordResetEmail(auth, email);
      setErr("A password reset link has been sent to your email.");
    } catch (error) {
      setErr(friendlyFirebaseError(error.code));
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------
  // UI
  // ------------------------------------------------------

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
        />

        {/* ----------------------------------------------- */}
        {/* RESET PASSWORD MODE */}
        {/* ----------------------------------------------- */}
        {isResetMode ? (
          <>
            <h2>Reset Password</h2>
            <p className="text-muted">Enter your email to receive a reset link.</p>

            <form onSubmit={handlePasswordReset} className="form-col">
              <input
                placeholder="Email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {err && <div className="error">{err}</div>}

              <button className="btn" disabled={loading} type="submit">
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <p className="text-muted">
              Remembered?{" "}
              <span className="link" onClick={() => setIsResetMode(false)}>
                Back to Login
              </span>
            </p>
          </>
        ) : (
          <>
            {/* ----------------------------------------------- */}
            {/* LOGIN / REGISTER MODE */}
            {/* ----------------------------------------------- */}
            <h2>{isRegister ? "Create Account" : "Sign In"}</h2>

            <form onSubmit={handleAuthSubmit} className="form-col">
              <input
                placeholder="Email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                placeholder="Password"
                type="password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

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
                  <span className="link" onClick={() => setIsResetMode(true)}>
                    Forgot Password?
                  </span>
                </div>
              )}

              {err && <div className="error">{err}</div>}

              <button className="btn" disabled={loading} type="submit">
                {loading ? "Please wait..." : (isRegister ? "Register" : "Login")}
              </button>
            </form>

            <p className="text-muted">
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <span className="link" onClick={() => { setIsRegister(!isRegister); setErr(""); }}>
                {isRegister ? "Login" : "Register"}
              </span>
            </p>

            <div className="sep">OR</div>

            <button className="btn google" disabled={loading} onClick={handleGoogle}>
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
    </div>
  );
}
