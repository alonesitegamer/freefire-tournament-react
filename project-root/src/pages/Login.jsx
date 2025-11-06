import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  // --- 1. ADD THIS ---
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom"; 

const provider = new GoogleAuthProvider();

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // --- 2. ADD THIS STATE ---
  // This will show a special view for password reset
  const [isResetMode, setIsResetMode] = useState(false);

  const [referral, setReferral] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  
  // (This function is unchanged)
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

  // (This function is unchanged)
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    if (isRegister) {
      // --- REGISTER LOGIC ---
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
      // --- LOGIN LOGIC ---
      try {
        await signInWithEmailAndPassword(auth, email, password);
        setLoading(false);
      } catch (error) {
        console.error("Login error:", error);
        setErr(error.message);
        setLoading(false);
      }
    }
  };

  // (This function is unchanged)
  const handleGoogle = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      await saveInitialUser(res.user, referral);
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. ADD THIS NEW FUNCTION ---
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
      // After 3 seconds, go back to the login form
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
        
        {/* --- 4. ADDED A NEW UI 'if' BLOCK --- */}
        {isResetMode ? (
          // --- PASSWORD RESET VIEW ---
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
          // --- ORIGINAL LOGIN/REGISTER VIEW ---
          <>
            <h2>{isRegister ? "Create Account" : "Sign In"}</h2>
            <form onSubmit={handleAuthSubmit} className="form-col">
              {/* (inputs are unchanged) */}
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

              {/* --- 5. ADD 'FORGOT PASSWORD' LINK --- */}
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
        {/* (This section is unchanged) */}
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
