import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, db } from "../firebase"; // removed provider import (we'll define it)
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const provider = new GoogleAuthProvider(); // ✅ explicitly define provider (prevents crash)

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ✅ helper: save user doc safely
  async function saveInitialUser(uid, emailVal, displayName = "", referralCode = "") {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          email: emailVal,
          displayName,
          coins: 0,
          lastDaily: null,
          referral: referralCode || null,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error("Firestore user creation failed:", e);
    }
  }

  const handleEmail = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await signInWithEmailAndPassword(auth, email, password);
        await saveInitialUser(res.user.uid, res.user.email, res.user.displayName || "");
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await saveInitialUser(res.user.uid, res.user.email, res.user.displayName || "", referral);
      }
    } catch (error) {
      console.error("Auth error:", error);
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      await saveInitialUser(
        res.user.uid,
        res.user.email || "",
        res.user.displayName || "",
        referral
      );
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setErr(error.message);
    } finally {
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
        <h2>{mode === "login" ? "Sign In" : "Create Account"}</h2>

        <form onSubmit={handleEmail} className="form-col">
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
          {mode === "register" && (
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
            {loading ? "Please wait…" : mode === "login" ? "Login" : "Register"}
          </button>
        </form>

        <div className="sep">OR</div>

        <button className="btn google" onClick={handleGoogle} disabled={loading}>
          Sign in with Google
        </button>

        <p className="text-muted">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <span
            className="link"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Register" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}
