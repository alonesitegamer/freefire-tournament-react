import React, { useState, useEffect } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber, 
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom"; // <-- 1. IMPORT LINK

const provider = new GoogleAuthProvider();

export default function Login() {
  // ... (All your existing state and functions remain unchanged) ...
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [referral, setReferral] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': (response) => {
            console.log("reCAPTCHA solved");
          }
        });
        window.recaptchaVerifier.render();
      }
    } catch (error) {
      console.error("Error setting up reCAPTCHA:", error);
      setErr("Failed to initialize login. Please refresh the page.");
    }
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
    };
  }, []);

  
  async function saveInitialUser(user, referralCode = "") {
    // ... (This function is unchanged) ...
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const newReferralCode = user.uid.substring(0, 8).toUpperCase();
        await setDoc(ref, {
          email: user.email || null,
          phoneNumber: user.phoneNumber || null,
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

  const handleSendOtp = async (e) => {
    // ... (This function is unchanged) ...
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const appVerifier = window.recaptchaVerifier;
      const formattedMobile = "+91" + mobile;
      if (mobile.length !== 10) {
        setErr("Please enter a valid 10-digit mobile number.");
        setLoading(false);
        return;
      }
      const confResult = await signInWithPhoneNumber(auth, formattedMobile, appVerifier);
      setConfirmationResult(confResult);
      setShowOtpInput(true);
      setLoading(false);
      setErr("An OTP has been sent to your number.");
    } catch (error) {
      console.error("SMS Send error:", error);
      setErr(error.message);
      setLoading(false);
      if (error.message.includes("reCAPTCHA")) {
        if(window.grecaptcha && window.recaptchaVerifier) {
            window.grecaptcha.reset(window.recaptchaVerifier.widgetId);
        }
      }
    }
  };

  const handleVerifyOtp = async (e) => {
    // ... (This function is unchanged) ...
    e.preventDefault();
    setErr("");
    setLoading(true);
    if (!confirmationResult) {
      setErr("Something went wrong. Please try sending the OTP again.");
      setLoading(false);
      return;
    }
    if (otp.length !== 6) {
      setErr("Please enter a valid 6-digit OTP.");
      setLoading(false);
      return;
    }
    try {
      const res = await confirmationResult.confirm(otp);
      await saveInitialUser(res.user, referral);
      setLoading(false);
    } catch (error) {
      console.error("OTP Verify error:", error);
      setErr(error.message);
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    // ... (This function is unchanged) ...
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

  return (
    <div className="auth-root">
      <div id="recaptcha-container"></div>
      
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />

      <div className="auth-card">
        {/* ... (Your existing login card UI is unchanged) ... */}
        <img
          src="/icon.jpg"
          className="logo-small"
          alt="logo"
          onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/100?text=Logo")}
        />
        
        {!showOtpInput ? (
          <>
            <h2>Sign In or Register</h2>
            <form onSubmit={handleSendOtp} className="form-col">
              {/* ... (inputs) ... */}
              <div className="tel-input-group">
                <span className="country-code">+91</span>
                <input
                  placeholder="10-digit Mobile Number"
                  type="tel"
                  className="field"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                />
              </div>
              <input
                placeholder="Referral Code (optional)"
                type="text"
                className="field"
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
              />
              {err && <div className="error">{err}</div>}
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2>Verify Your Number</h2>
            <p className="text-muted">Enter the 6-digit code sent to +91 {mobile}</p>
            <form onSubmit={handleVerifyOtp} className="form-col">
              {/* ... (inputs) ... */}
              <input
                placeholder="6-digit OTP"
                type="number"
                className="field"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              {err && <div className="error">{err}</div>}
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Login"}
              </button>
            </form>
            <p className="text-muted">
              Wrong number?{" "}
              <span
                className="link"
                onClick={() => {
                  setShowOtpInput(false);
                  setErr("");
                  setOtp("");
                }}
              >
                Change
              </span>
            </p>
          </>
        )}

        <div className="sep">OR</div>

        <button className="btn google" onClick={handleGoogle} disabled={loading}>
          Sign in with Google
        </button>
      </div>

      {/* --- 2. ADD THIS NEW FOOTER SECTION --- */}
      <div className="login-footer-links">
        <Link to="/privacy-policy">Privacy Policy</Link>
        <span>•</span>
        <Link to="/terms-of-service">Terms of Service</Link>
        <span>•</span>
        <Link to="/about">About Us</Link>
        <span>•</span>
        <Link to="/contact">Contact</Link>
      </div>
      {/* --- END NEW SECTION --- */}

    </div>
  );
}
