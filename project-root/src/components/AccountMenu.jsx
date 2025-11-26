// src/components/AccountMenu.jsx
import React, { useState } from "react";
import ProfileSettings from "./ProfileSettings";
import { signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

import {
  User,
  Trophy,
  Link2,
  LogOut,
  Settings,
  MessageSquare,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";

import "../styles/profilesettings.css";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  onRankClick = () => {},
  onLogout = null,
  openAvatarModal
}) {
  const [view, setView] = useState("main");

  async function doLogout() {
    if (typeof onLogout === "function") return onLogout();
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div className="account-menu premium-panel">

      {/* MAIN ACCOUNT MENU */}
      {view === "main" && (
        <section className="panel account-profile-card premium">
          
          <div className="acc-top-row">
            <div className="acc-avatar" onClick={openAvatarModal}>
              <img src={profile.avatar || "/avatars/default.jpg"} alt="avatar" />
            </div>

            <div className="acc-meta">
              <div className="acc-name">{profile.displayName || profile.username || "Player"}</div>
              <div className="acc-email">{profile.email}</div>
              <div className="acc-stats">
                <span>Level {profile.level ?? 1}</span>
                <span> • </span>
                <span>{profile.coins ?? 0} coins</span>
              </div>
            </div>
          </div>

          <div className="account-actions">
            <button className="account-option" onClick={() => setView("profile")}>
              <Settings size={18} />
              <span>Profile Settings</span>
            </button>

            <button className="account-option" onClick={onRankClick}>
              <Trophy size={18} />
              <span>Rank</span>
            </button>

            <button className="account-option" onClick={() => setView("refer")}>
              <Link2 size={18} />
              <span>Refer a Friend</span>
            </button>

            <button className="account-option" onClick={() => setView("feedback")}>
              <MessageSquare size={18} />
              <span>Send Feedback</span>
            </button>

            <button className="account-option" onClick={() => setView("security")}>
              <ShieldCheck size={18} />
              <span>Security & Password</span>
            </button>

            <button className="account-option logout" onClick={doLogout}>
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>

          <div className="account-links">
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/terms-of-service">Terms</a>
            <a href="/contact">Contact</a>
          </div>
        </section>
      )}

      {/* PROFILE SETTINGS PAGE */}
      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <ProfileSettings
            profile={profile}
            updateProfileField={updateProfileField}
            onBack={() => setView("main")}
            setProfile={setProfile}
          />
        </section>
      )}

      {/* REFER PAGE */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Refer a Friend</h3>
          <p>Your referral code:</p>
          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}

      {/* FEEDBACK PAGE */}
      {view === "feedback" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Send Feedback</h3>
          <FeedbackForm onDone={() => setView("main")} profile={profile} />
        </section>
      )}

      {/* SECURITY & PASSWORD PAGE */}
      {view === "security" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>

          <h3>Security</h3>
          <p className="muted">Change password or reset using email.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <button className="btn" onClick={() => setView("changePassword")}>
              Change Password
            </button>

            <button
              className="btn ghost"
              onClick={() => {
                sendPasswordResetEmail(auth, profile.email);
                alert("Password reset email sent.");
              }}
            >
              Forgot Password (Email)
            </button>
          </div>
        </section>
      )}

      {/* CHANGE PASSWORD PAGE */}
      {view === "changePassword" && (
        <ChangePasswordPage onBack={() => setView("security")} />
      )}

    </div>
  );
}

/* CHANGE PASSWORD PAGE FULL VERSION */
function ChangePasswordPage({ onBack }) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [strength, setStrength] = useState(0);

  function calcStrength(pw) {
    let s = 0;
    if (pw.length >= 6) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  function handleNewPass(v) {
    setNewPass(v);
    setStrength(calcStrength(v));
  }

  async function submit() {
    if (!oldPass) return alert("Enter old password");
    if (!newPass) return alert("Enter new password");
    if (newPass !== confirmPass) return alert("Passwords do not match");

    try {
      const user = auth.currentUser;
      const cred = EmailAuthProvider.credential(user.email, oldPass);

      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);

      alert("Password changed!");
      onBack();
    } catch (err) {
      console.error(err);
      alert("Old password incorrect or login expired.");
    }
  }

  return (
    <section className="panel">
      <button className="back-btn" onClick={onBack}>Back</button>

      <h3>Change Password</h3>

      {/* OLD PASSWORD */}
      <div className="pw-field">
        <input
          className="modern-input"
          type={showOld ? "text" : "password"}
          placeholder="Old password"
          value={oldPass}
          onChange={(e) => setOldPass(e.target.value)}
        />
        <span className="pw-eye" onClick={() => setShowOld(!showOld)}>
          {showOld ? <EyeOff /> : <Eye />}
        </span>
      </div>

      {/* NEW PASSWORD */}
      <div className="pw-field">
        <input
          className="modern-input"
          type={showNew ? "text" : "password"}
          placeholder="New password"
          value={newPass}
          onChange={(e) => handleNewPass(e.target.value)}
        />
        <span className="pw-eye" onClick={() => setShowNew(!showNew)}>
          {showNew ? <EyeOff /> : <Eye />}
        </span>
      </div>

      {/* Strength Meter */}
      <div className="strength-meter">
        <div className={`bar ${strength >= 1 ? "active" : ""}`}></div>
        <div className={`bar ${strength >= 2 ? "active" : ""}`}></div>
        <div className={`bar ${strength >= 3 ? "active" : ""}`}></div>
        <div className={`bar ${strength >= 4 ? "active" : ""}`}></div>
      </div>

      {/* CONFIRM PASSWORD */}
      <div className="pw-field">
        <input
          className="modern-input"
          type={showConfirm ? "text" : "password"}
          placeholder="Confirm new password"
          value={confirmPass}
          onChange={(e) => setConfirmPass(e.target.value)}
        />
        <span className="pw-eye" onClick={() => setShowConfirm(!showConfirm)}>
          {showConfirm ? <EyeOff /> : <Eye />}
        </span>
      </div>

      <button className="btn" style={{ marginTop: 14 }} onClick={submit}>
        Save Password
      </button>
    </section>
  );
}

/* FEEDBACK FORM */
function FeedbackForm({ onDone = () => {}, profile = {} }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const { db } = require("../firebase"); 
  const { addDoc, collection, serverTimestamp } = require("firebase/firestore");

  async function send() {
    if (!text.trim()) return alert("Write something first.");
    setSaving(true);

    try {
      await addDoc(collection(db, "feedback"), {
        userId: profile.id || null,
        email: profile.email || null,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });

      alert("Feedback sent!");
      setText("");
      onDone();
    } catch (e) {
      alert("Failed to send feedback.");
      console.error(e);
    }

    setSaving(false);
  }

  return (
    <div className="feedback-root">
      <textarea
        className="field"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tell us what's up..."
      />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn" disabled={saving} onClick={send}>
          {saving ? "Sending..." : "Send Feedback"}
        </button>
      </div>
    </div>
  );
}
