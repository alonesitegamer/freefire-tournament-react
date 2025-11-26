// src/components/AccountMenu.jsx
import React, { useState } from "react";
import { signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

import { User, Trophy, Link2, LogOut, Settings, MessageSquare, ShieldCheck, Eye, EyeOff } from "lucide-react";

import "../styles/profilesettings.css";
import Popup from "./Popup"; // ⭐ REQUIRED for animations

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  onRankClick = () => {},
  onLogout = null,
  openAvatarModal
}) {
  const [view, setView] = useState("main");

  // For popups
  const [popup, setPopup] = useState({ show: false, type: "", message: "" });
  const showPopup = (type, message) => {
    setPopup({ show: true, type, message });
    setTimeout(() => setPopup({ show: false, type: "", message: "" }), 2500);
  };

  // Change password local states
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordValid = newPass.length >= 6;

  async function handlePasswordChange() {
    if (!oldPass || !newPass || !confirmPass)
      return showPopup("error", "Fill all fields.");

    if (!passwordValid)
      return showPopup("error", "Password must be at least 6 characters.");

    if (newPass !== confirmPass)
      return showPopup("error", "Passwords do not match.");

    try {
      const user = auth.currentUser;
      const cred = EmailAuthProvider.credential(user.email, oldPass);

      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);

      setOldPass("");
      setNewPass("");
      setConfirmPass("");

      showPopup("success", "Password updated successfully!");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/wrong-password")
        return showPopup("error", "Old password is incorrect.");
      showPopup("error", "Failed to update password.");
    }
  }

  async function sendResetEmail() {
    try {
      await sendPasswordResetEmail(auth, profile.email);
      showPopup("success", "Password reset email sent!");
    } catch (err) {
      console.error(err);
      showPopup("error", "Failed to send reset email.");
    }
  }

  async function doLogout() {
    if (typeof onLogout === "function") return onLogout();
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div className="account-menu premium-panel">
      {/* POPUP */}
      {popup.show && <Popup type={popup.type} message={popup.message} />}

      {/* ---------------- MAIN MENU ---------------- */}
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

      {/* ---------------- SECURITY & PASSWORD ---------------- */}
      {view === "security" && (
        <section className="panel security-panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Change Password</h3>

          {/* Old password */}
          <label>Current Password</label>
          <div className="password-field">
            <input
              type={showOld ? "text" : "password"}
              placeholder="Enter old password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
            />
            <span className="toggle-eye" onClick={() => setShowOld(!showOld)}>
              {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
            </span>
          </div>

          {/* New password */}
          <label>New Password</label>
          <div className="password-field">
            <input
              type={showNew ? "text" : "password"}
              placeholder="Enter new password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
            <span className="toggle-eye" onClick={() => setShowNew(!showNew)}>
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </span>
          </div>

          {/* Password rule */}
          <p className={`pass-rule ${passwordValid ? "ok" : "bad"}`}>
            • At least 6 characters
          </p>

          {/* Confirm password */}
          <label>Confirm New Password</label>
          <div className="password-field">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
            />
            <span className="toggle-eye" onClick={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </span>
          </div>

          <button className="btn" style={{ width: "100%", marginTop: 15 }} onClick={handlePasswordChange}>
            Update Password
          </button>

          <button className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={sendResetEmail}>
            Forgot Password? (Email Reset)
          </button>
        </section>
      )}

      {/* ---------------- REFER FRIEND ---------------- */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Refer a Friend</h3>
          <p>Share your invite code:</p>
          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}

      {/* ---------------- FEEDBACK ---------------- */}
      {view === "feedback" && <FeedbackSection onBack={() => setView("main")} profile={profile} />}

      {/* ---------------- PROFILE SETTINGS ---------------- */}
      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
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

/* FEEDBACK SECTION */
function FeedbackSection({ onBack, profile }) {
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
      onBack();
    } catch (err) {
      alert("Failed to send feedback.");
    }
    setSaving(false);
  }

  return (
    <section className="panel">
      <button className="back-btn" onClick={onBack}>Back</button>
      <h3>Send Feedback</h3>
      <textarea
        className="field"
        rows={5}
        placeholder="Describe your issue or suggestion..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn" onClick={send} disabled={saving}>
        {saving ? "Sending..." : "Send Feedback"}
      </button>
    </section>
  );
}
