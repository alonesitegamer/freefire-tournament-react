// src/components/AccountMenu.jsx
import React, { useState } from "react";
import ProfileSettings from "./ProfileSettings";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail
} from "firebase/auth";

// Icons
import { User, Trophy, Link2, LogOut, Settings, MessageSquare, ShieldCheck } from "lucide-react";

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

      {/* MAIN MENU */}
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
              <Settings size={18} /> <span>Profile Settings</span>
            </button>

            <button className="account-option" onClick={onRankClick}>
              <Trophy size={18} /> <span>Rank</span>
            </button>

            <button className="account-option" onClick={() => setView("refer")}>
              <Link2 size={18} /> <span>Refer a Friend</span>
            </button>

            <button className="account-option" onClick={() => setView("feedback")}>
              <MessageSquare size={18} /> <span>Send Feedback</span>
            </button>

            <button className="account-option" onClick={() => setView("security")}>
              <ShieldCheck size={18} /> <span>Security & Password</span>
            </button>

            <button className="account-option logout" onClick={doLogout}>
              <LogOut size={18} /> <span>Logout</span>
            </button>
          </div>

          <div className="account-links">
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/terms-of-service">Terms</a>
            <a href="/contact">Contact</a>
          </div>
        </section>
      )}

      {/* PROFILE SETTINGS */}
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

      {/* REFER A FRIEND */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Refer a Friend</h3>
          <p>Share this code:</p>
          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}

      {/* FEEDBACK */}
      {view === "feedback" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Send Feedback</h3>
          <FeedbackForm profile={profile} onDone={() => setView("main")} />
        </section>
      )}

      {/* SECURITY */}
      {view === "security" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Security</h3>
          <p className="muted">Change your password or reset it via email.</p>

          <button className="btn" style={{ width: "100%", marginBottom: 10 }}
            onClick={() => setView("changePassword")}>
            Change Password
          </button>

          <button className="btn ghost" style={{ width: "100%" }}
            onClick={() => setView("forgotPassword")}>
            Forgot Password
          </button>
        </section>
      )}

      {/* CHANGE PASSWORD */}
      {view === "changePassword" && (
        <ChangePasswordPage onBack={() => setView("security")} />
      )}

      {/* FORGOT PASSWORD */}
      {view === "forgotPassword" && (
        <ForgotPasswordPage email={profile.email} onBack={() => setView("security")} />
      )}
    </div>
  );
}

/* CHANGE PASSWORD PAGE */
function ChangePasswordPage({ onBack }) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  async function submit() {
    if (!oldPass) return alert("Enter old password");
    if (!newPass) return alert("Enter new password");
    if (newPass !== confirmPass) return alert("Passwords do not match");

    try {
      const user = auth.currentUser;
      const cred = EmailAuthProvider.credential(user.email, oldPass);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);

      alert("Password changed successfully!");
      onBack();
    } catch (err) {
      alert("Old password incorrect or session expired.");
      console.error(err);
    }
  }

  return (
    <section className="panel">
      <button className="back-btn" onClick={onBack}>Back</button>
      <h3>Change Password</h3>

      <input className="modern-input" type="password" placeholder="Old password"
        value={oldPass} onChange={e => setOldPass(e.target.value)} />

      <input className="modern-input" type="password" placeholder="New password"
        value={newPass} onChange={e => setNewPass(e.target.value)} />

      <input className="modern-input" type="password" placeholder="Confirm new password"
        value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />

      <button className="btn" style={{ marginTop: 10 }} onClick={submit}>
        Save New Password
      </button>
    </section>
  );
}

/* FORGOT PASSWORD PAGE */
function ForgotPasswordPage({ email, onBack }) {
  async function sendLink() {
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent!");
      onBack();
    } catch (err) {
      alert("Failed to send email");
      console.error(err);
    }
  }

  return (
    <section className="panel">
      <button className="back-btn" onClick={onBack}>Back</button>

      <h3>Forgot Password</h3>
      <p className="muted">A reset link will be sent to:</p>

      <div className="referral-code">{email}</div>

      <button className="btn" onClick={sendLink} style={{ marginTop: 10 }}>
        Send Reset Email
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
      alert("Thanks — feedback sent.");
      setText("");
      onDone();
    } catch (err) {
      alert("Failed to send feedback.");
      console.error(err);
    }
    setSaving(false);
  }

  return (
    <div className="feedback-root">
      <textarea className="field" rows={6}
        value={text} onChange={e => setText(e.target.value)}
        placeholder="Tell us what's up..." />

      <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
        <button className="btn ghost" onClick={() => { setText(""); onDone(); }}>
          Cancel
        </button>
        <button className="btn" disabled={saving} onClick={send}>
          {saving ? "Sending..." : "Send Feedback"}
        </button>
      </div>
    </div>
  );
}
