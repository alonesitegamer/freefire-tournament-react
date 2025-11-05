import React, { useState, useEffect } from "react";
import {
  // NEW: Import Phone Auth and reCAPTCHA
  RecaptchaVerifier,
  signInWithPhoneNumber, 
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const provider = new GoogleAuthProvider();

export default function Login() {
  // NEW: State for phone number, OTP, and UI flow
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [referral, setReferral] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // UPDATED: Setup invisible reCAPTCHA with cleanup
  useEffect(() => {
    // This creates the invisible reCAPTCHA verifier.
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

    // 👇 ADDED THIS CLEANUP FUNCTION
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
    };
  }, []); // Empty array means this runs only once

  
  async function saveInitialUser(user, referralCode = "") {
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      // Only create a new document if one doesn't exist
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

  // UPDATED: Step 1 - Send the OTP (with better error handling)
  const handleSendOtp = async (e) => {
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
      
      // 👇 ADDED THIS BLOCK TO RESET THE RECAPTCHA ON THAT ERROR
      if (error.message.includes("reCAPTCHA")) {
        if(window.grecaptcha && window.recaptchaVerifier) {
            window.grecaptcha.reset(window.recaptchaVerifier.widgetId);
        }
      }
    }
  };

  // NEW: Step 2 - Verify the OTP
  const handleVerifyOtp = async (e) => {
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
      // User is signed in!
      
      // Now, save their data to Firestore (if they are a new user)
      await saveInitialUser(res.user, referral);
      
      setLoading(false);

    } catch (error) {
      console.error("OTP Verify error:", error);
      setErr(error.message);
      setLoading(false);
    }
  };


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

  return (
    <div className="auth-root">
      {/* NEW: This div is required for the invisible reCAPTCHA */}
      <div id="recaptcha-container"></div>
      
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
        
        {!showOtpInput ? (
          // FORM 1: Enter Mobile Number
          <>
            <h2>Sign In or Register</h2>
            <form onSubmit={handleSendOtp} className="form-col">
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
          // FORM 2: Enter OTP
          <>
            <h2>Verify Your Number</h2>
            <p className="text-muted">Enter the 6-digit code sent to +91 {mobile}</p>
            <form onSubmit={handleVerifyOtp} className="form-col">
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
    </div>
  );
}
