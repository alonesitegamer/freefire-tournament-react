import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup, // 👈 *** REVERTED to signInWithPopup ***
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth, db, provider } from "../firebase"; 
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom"; 

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isResetMode, setIsResetMode] = useState(false);
  const [referral, setReferral] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  
  // This function now handles *all* user profile creation/checks
  async function saveInitialUser(user, referralCode = "") {
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        // This is a NEW user
        const newReferralCode = user.uid.substring(0, 8).toUpperCase();
        await setDoc(ref, {
          email: user.email,
          displayName: user.displayName || "",
          username: "", 
          coins: 0,
          lastDaily: null,
          referral: referralCode || null, 
          referralCode: newReferralCode,  
          hasRedeemedReferral: !!referralCode, // Becomes true if they used a code
          createdAt: serverTimestamp(),
        });
      }
      // If snap.exists(), the user is just logging in, so we do nothing.
      // The Dashboard.jsx loader will handle checking for their referral code.
    } catch (e) {
      console.error("Firestore user creation/check failed:", e);
    }
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    if (isRegister) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await saveInitialUser(user, referral);
        await sendEmailVerification(user);
        setErr("Registration successful! Please check your email to verify your account.");
        setLoading(false);
      } catch (error) {
        console.error("Registration error:", error);
        setErr(error.message);
        setLoading(false);
      }
    } else {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        // Login is successful, no need to save user, just let it redirect.
        setLoading(false);
      } catch (error) {
        console.error("Login error:", error);
        setErr(error.message);
        setLoading(false);
      }
    }
  };

  // --- THIS IS THE FIX ---
  // Reverted back to signInWithPopup
  const handleGoogle = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      // We MUST check and save the user *here*
      // This is what `signInWithRedirect` was failing to do.
      await saveInitialUser(res.user, referral);
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };
  // ---

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!email) {
      setErr("Please enter your email address to reset your password.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setLoading(false);
      setErr("Password reset email sent! Check your inbox.");
      setTimeout(() => {
        setIsResetMode(false);
        setErr("");
      }, 3000);
    } catch (error) {
      console.error("Password Reset error:", error);
      setErr(error.message);
      setLoading(false);
    }
  };

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
            <p className="text-muted">
              Enter your email and we'll send you a link to get back into your account.
            </p>
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
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
            <p className="text-muted">
              Remembered it?{" "}
              <span
                className="link"
                onClick={() => {
                  setIsResetMode(false);
                  setErr("");
                }}
              >
                Back to Sign In
              </span>
            </p>
          </>
        ) : (
          <>
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
                placeholder="Password (6+ characters)"
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
                  <span
                    className="link"
                    onClick={() => {
                      setIsResetMode(true);
                      setErr("");
                    }}
                  >
                    Forgot Password?
                  </span>
                </div>
              )}
              {err && <div className="error">{err}</div>}
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Loading..." : (isRegister ? "Register" : "Sign In")}
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
          </>
        )}
      </div>
      <div className="login-footer-links">
        <Link to="/privacy-policy">Privacy Policy</Link>
        <span>•</span>
        <Link to="/terms-of-service">Terms of Service</Link>
        {/* We can add these back later when the pages exist */}
        {/* <span>•</span>
        <Link to="/about">About Us</Link>
        <span>•</span>
        <Link to="/contact">Contact</Link> */}
      </div>
    </div>
  );
}
