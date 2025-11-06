import React, { useState } from "react";
import {
  // --- REMOVED ---
  // RecaptchaVerifier,
  // signInWithPhoneNumber, 

  // --- ADDED ---
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,

  // --- KEPT ---
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom"; 

const provider = new GoogleAuthProvider();

export default function Login() {
  // --- NEW STATE ---
  const [isRegister, setIsRegister] = useState(false); // Toggles between Login and Register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // --- KEPT STATE ---
  const [referral, setReferral] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // --- REMOVED STATE ---
  // const [mobile, setMobile] = useState("");
  // const [otp, setOtp] = useState("");
  // const [showOtpInput, setShowOtpInput] = useState(false);
  // const [confirmationResult, setConfirmationResult] = useState(null);

  // --- REMOVED useEffect for reCAPTCHA ---
  // (It's not needed for Email/Password)

  
  // --- UPDATED saveInitialUser ---
  // Removed 'phoneNumber' field to keep your database clean
  async function saveInitialUser(user, referralCode = "") {
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const newReferralCode = user.uid.substring(0, 8).toUpperCase();
        await setDoc(ref, {
          email: user.email, // Email is now the primary field
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

  // --- REMOVED Phone Functions (handleSendOtp, handleVerifyOtp) ---


  // --- NEW UNIFIED AUTH FUNCTION ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    if (isRegister) {
      // --- REGISTER LOGIC ---
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 1. Save their info to Firestore
        await saveInitialUser(user, referral);

        // 2. Send the verification email (This is Step 2 from our plan)
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
        // No need to do anything else, the Auth listener will redirect
        setLoading(false);
      } catch (error) {
        console.error("Login error:", error);
        setErr(error.message);
        setLoading(false);
      }
    }
  };


  // --- Google Function (unchanged, but uses updated saveInitialUser) ---
  const handleGoogle = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      // We read the referral code from the state
      await saveInitialUser(res.user, referral);
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* --- REMOVED reCAPTCHA container --- */}
      
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
        
        {/* --- NEW UNIFIED FORM --- */}
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

          {/* Only show referral input on the Register form */}
          {isRegister && (
            <input
              placeholder="Referral Code (optional)"
              type="text"
              className="field"
              value={referral}
              onChange={(e) => setReferral(e.target.value)}
            />
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
              setIsRegister(!isRegister); // Toggle the mode
              setErr(""); // Clear any errors
            }}
          >
            {isRegister ? "Sign In" : "Register"}
          </span>
        </p>

        {/* --- END NEW FORM --- */}


        <div className="sep">OR</div>

        <button className="btn google" onClick={handleGoogle} disabled={loading}>
          Sign in with Google
        </button>
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
