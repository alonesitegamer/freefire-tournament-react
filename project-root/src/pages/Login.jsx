import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup
} from "firebase/auth";
import { auth, provider, db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // login | register
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function saveInitialUser(uid, emailVal, displayName = "") {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: emailVal,
        displayName,
        coins: 0,
        lastDaily: null,
        createdAt: serverTimestamp()
      });
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
        await saveInitialUser(res.user.uid, res.user.email, res.user.displayName || "");
      }
    } catch (error) {
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
      await saveInitialUser(res.user.uid, res.user.email || "", res.user.displayName || "");
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/media/bg.mp4" type="video/mp4" />
      </video>
      <div className="auth-overlay" />
      <div className="auth-card">
        <img src="/media/icon.jpg" className="logo-small" alt="logo" />
        <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>

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
          <span className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Register" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}
