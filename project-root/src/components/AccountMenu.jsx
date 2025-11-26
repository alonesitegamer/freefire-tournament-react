// src/components/AccountMenu.jsx
import React, { useState } from "react";
import {
  signOut,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  sendPasswordResetEmail
} from "firebase/auth";
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
import Popup from "./Popup";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  onRankClick = () => {},
  onLogout = null,
  openAvatarModal
}) {
  const [view, setView] = useState("main");

  const [popup, setPopup] = useState({ show: false, type: "", message: "" });
  const showPopup = (type, message) => {
    setPopup({ show: true, type, message });
    setTimeout(() => setPopup({ show: false, type: "", message: "" }), 2200);
  };

  // ---------------- Password States ----------------
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isLong = newPass.length >= 6;

  // ---------------- Password Change Handler ----------------
  async function handlePasswordChange() {
    if (!oldPass || !newPass || !confirmPass)
      return showPopup("error", "Fill all fields.");

    if (!isLong)
      return showPopup("error", "Password must be at least 6 characters.");

    if (newPass !== confirmPass)
      return showPopup("error", "Passwords don't match.");

    try {
      const user = auth.currentUser;
      const cred = EmailAuthProvider.credential(user.email, oldPass);

      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);

      setOldPass("");
      setNewPass("");
      setConfirmPass("");

      showPopup("success", "Password updated!");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/wrong-password")
        return showPopup("error", "Old password is incorrect.");
      showPopup("error", "Password update failed.");
    }
  }

  // ---------------- Reset Email ----------------
  async function sendResetEmail() {
    try {
      await sendPasswordResetEmail(auth, profile.email);
      showPopup("success", "Reset email sent!");
    } catch (err) {
      console.error(err);
      showPopup("error", "Failed to send email.");
    }
  }

  // ---------------- Logout ----------------
  async function doLogout() {
    if (typeof onLogout === "function") return onLogout();
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div className="account-menu premium-panel">
      {popup.show && <Popup type={popup.type} message={popup.message} />}

      {/* ================= MAIN MENU ================= */}
      {view === "main" && (
        <section className="panel account-profile-card premium glass-card">
          <div className="acc-top-row">
            <div className="acc-avatar" onClick={openAvatarModal}>
              <img src={profile.avatar || "/avatars/default.jpg"} alt="avatar" />
            </div>

            <div className="acc-meta">
              <div className="acc-name">
                {profile.displayName || profile.username || "Player"}
              </div>
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

      {/* ================= SECURITY / CHANGE PASSWORD ================= */}
      {view === "security" && (
        <section className="panel glass-card password-glass-card">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>

          <h3 className="section-title">Change Password</h3>

          {/* OLD PASSWORD */}
          <label className="label">Current Password</label>
          <div className="input-wrapper glass-input">
            <input
              type={showOld ? "text" : "password"}
              value={oldPass}
              placeholder="Enter old password"
              onChange={(e) => setOldPass(e.target.value)}
            />
            <span className="eye-btn" onClick={() => setShowOld(!showOld)}>
              {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
            </span>
          </div>

          {/* NEW PASSWORD */}
          <label className="label">New Password</label>
          <div className="input-wrapper glass-input">
            <input
              type={showNew ? "text" : "password"}
              value={newPass}
              placeholder="Enter new password"
              onChange={(e) => setNewPass(e.target.value)}
            />
            <span className="eye-btn" onClick={() => setShowNew(!showNew)}>
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </span>
          </div>

          <p className={`rule-text ${isLong ? "ok" : "bad"}`}>• At least 6 characters</p>

          {/* CONFIRM PASSWORD */}
          <label className="label">Confirm New Password</label>
          <div className="input-wrapper glass-input">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPass}
              placeholder="Confirm password"
              onChange={(e) => setConfirmPass(e.target.value)}
            />
            <span className="eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </span>
          </div>

          <button className="btn full" onClick={handlePasswordChange}>
            Update Password
          </button>

          <button className="btn ghost full" onClick={sendResetEmail}>
            Forgot Password? (Email Reset)
          </button>
        </section>
      )}

      {/* ================= REFER ================= */}
      {view === "refer" && (
        <section className="panel glass-card">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>
          <h3>Refer a Friend</h3>
          <p>Your invite code:</p>
          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}

      {/* ================= FEEDBACK ================= */}
      {view === "feedback" && (
        <FeedbackSection onBack={() => setView("main")} profile={profile} />
      )}

      {/* ================= PROFILE ================= */}
      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>
          <ProfileSettings
            profile={profile}
            updateProfileField={updateProfileField}
            setProfile={setProfile}
            onBack={() => setView("main")}
          />
        </section>
      )}
    </div>
  );
}

/* FEEDBACK COMPONENT ----------------------- */
function FeedbackSection({ onBack, profile }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const { db } = require("../firebase");
  const { addDoc, collection, serverTimestamp } = require("firebase/firestore");

  async function send() {
    if (!text.trim()) return alert("Write something.");
    setSaving(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: profile.id || null,
        email: profile.email,
        text: text.trim(),
        createdAt: serverTimestamp()
      });
      alert("Feedback sent!");
      setText("");
      onBack();
    } catch {
      alert("Error sending feedback.");
    }
    setSaving(false);
  }

  return (
    <section className="panel glass-card">
      <button className="back-btn" onClick={onBack}>
        Back
      </button>
      <h3>Send Feedback</h3>
      <textarea
        className="field glass-input"
        rows={6}
        placeholder="Describe the issue..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn full" onClick={send} disabled={saving}>
        {saving ? "Sending..." : "Send Feedback"}
      </button>
    </section>
  );
}
