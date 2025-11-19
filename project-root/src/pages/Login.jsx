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

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [isResetMode, setIsResetMode] = useState(false);

  // 🔥 Animated message system
  const message = err ? (
    <div className={`msg-box ${err.includes("✔") ? "success" : "error"}`}>
      {err}
    </div>
  ) : null;

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
      console.error("saveInitialUser error:", err);
    }
  }

  // ---------------------------------------
  // 🔥 REGISTER → Must Verify Email Before Login
  // ---------------------------------------
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    if (isRegister) {
      try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const user = res.user;

        // save in DB
        await saveInitialUser(user, referral);

        // send verification email
        await sendEmailVerification(user);

        // force logout immediately
        await auth.signOut();

        setErr(
          "✔ Registration successful! Please verify your email before signing in."
        );
      } catch (error) {
        setErr(error.message);
      }
      setLoading(false);
      return;
    }

    // ---------------------------------------
    // 🔥 LOGIN → Check Email Verification
    // ---------------------------------------
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);

      if (!res.user.emailVerified) {
        await sendEmailVerification(res.user);
        await auth.signOut();

        setErr(
          "⚠ Please verify your email before logging in. A verification email has been resent."
        );
        setLoading(false);
        return;
      }
    } catch (error) {
      setErr(error.message);
    }

    setLoading(false);
  };

  // ---------------------------------------
  // 🔥 GOOGLE LOGIN (Also requires verified email)
  // ---------------------------------------
  const handleGoogle = async () => {
    setErr("");
    setLoading(true);

    try {
      const res = await signInWithPopup(auth, provider);
      await saveInitialUser(res.user, referral);

      if (!res.user.emailVerified) {
        await sendEmailVerification(res.user);
        await auth.signOut();

        setErr(
          "⚠ Please verify your Google email before signing in. Verification link sent."
        );
      }
    } catch (error) {
      setErr(error.message);
    }

    setLoading(false);
  };

  // ---------------------------------------
  // 🔥 RESET PASSWORD
  // ---------------------------------------
  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (!email) {
      setErr("Enter your email to reset password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setErr("✔ Password reset email sent!");
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <div className="auth-root">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />

      <div className="auth-card fancy-card">
        <img src="/icon.jpg" className="logo-small" alt="logo" />

        {isResetMode ? (
          <>
            <h2>Password Reset</h2>
            {message}

            <form onSubmit={handlePasswordReset} className="form-col">
              <input
                type="email"
                className="field"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <p className="text-muted">
              Remembered it?{" "}
              <span className="link" onClick={() => setIsResetMode(false)}>
                Back to Sign In
              </span>
            </p>
          </>
        ) : (
          <>
            <h2>{isRegister ? "Create Account" : "Sign In"}</h2>
            {message}

            <form onSubmit={handleAuthSubmit} className="form-col">
              <input
                type="email"
                placeholder="Email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {isRegister && (
                <input
                  type="text"
                  placeholder="Referral Code (optional)"
                  className="field"
                  value={referral}
                  onChange={(e) => setReferral(e.target.value)}
                />
              )}

              {!isRegister && (
                <p className="forgot-password">
                  <span className="link" onClick={() => setIsResetMode(true)}>
                    Forgot password?
                  </span>
                </p>
              )}

              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Loading..." : isRegister ? "Register" : "Sign In"}
              </button>
            </form>

            <p className="text-muted">
              {isRegister
                ? "Already have an account?"
                : "Don't have an account?"}{" "}
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

            <button className="btn google" onClick={handleGoogle}>
              Sign in with Google
            </button>
          </>
        )}
      </div>

      <div className="login-footer-links">
        <Link to="/privacy-policy">Privacy Policy</Link>• 
        <Link to="/terms-of-service">Terms</Link>• 
        <Link to="/about">About</Link>• 
        <Link to="/contact">Contact</Link>
      </div>
    </div>
  );
}
