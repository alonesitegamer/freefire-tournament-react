// src/components/ProfileSettings.jsx
import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, updateDoc, getDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";

export default function ProfileSettings({ profile = {}, updateProfileField = async () => {}, onBack = () => {}, setProfile = () => {} }) {
  const [editingUsername, setEditingUsername] = useState(false);
  const [username, setUsername] = useState(profile.username || "");
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // password flow
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState("");

  // feedback quick shortcut in this component
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // ----- profile update -----
  async function saveProfile(e) {
    e && e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await updateProfileField({ username: username.trim(), displayName: displayName.trim() });
      // also update local preview
      setProfile(prev => ({ ...prev, username: username.trim(), displayName: displayName.trim() }));
      alert("Profile updated");
      setEditingUsername(false);
    } catch (err) {
      console.error("save profile", err);
      alert("Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  // ----- password change (reauth then update) -----
  async function handleChangePassword(e) {
    e && e.preventDefault();
    setPwMessage("");
    if (!currentPassword || !newPassword || !confirmNew) return setPwMessage("Fill all fields.");
    if (newPassword.length < 6) return setPwMessage("Password must be 6+ characters.");
    if (newPassword !== confirmNew) return setPwMessage("New passwords do not match.");

    setPwLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");

      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);

      await updatePassword(user, newPassword);
      setPwMessage("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
      setShowPasswordChange(false);
    } catch (err) {
      console.error("change password", err);
      const code = err.code || "";
      if (code.includes("auth/wrong-password") || code.includes("auth/invalid-credential")) {
        setPwMessage("Current password is incorrect.");
      } else {
        setPwMessage(err.message || "Failed to change password.");
      }
    } finally {
      setPwLoading(false);
    }
  }

  // ----- forgot password (email reset) -----
  async function handleForgotPassword() {
    if (!profile.email) return alert("No email available.");
    try {
      await sendPasswordResetEmail(auth, profile.email);
      alert("Password reset email sent to your email address.");
    } catch (err) {
      console.error("send reset", err);
      alert("Failed to send reset email.");
    }
  }

  // ----- feedback submit from here -----
  async function submitFeedback() {
    if (!feedbackText.trim()) return alert("Write feedback first.");
    setFeedbackLoading(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: profile.id || null,
        email: profile.email || null,
        text: feedbackText.trim(),
        createdAt: serverTimestamp(),
      });
      setFeedbackText("");
      alert("Thanks — feedback sent.");
    } catch (err) {
      console.error("feedback", err);
      alert("Failed to send feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <div className="profile-settings-root">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <h2 className="modern-title">Profile Settings</h2>
      <p className="modern-subtitle">Update display name, username, password and more.</p>

      <div className="profile-section">
        <label>Email (locked)</label>
        <input className="modern-input" value={profile.email || ""} disabled />
      </div>

      <div className="profile-section">
        <label>Display name</label>
        <input className="modern-input" value={displayName} onChange={(e)=>setDisplayName(e.target.value)} />
      </div>

      <div className="profile-section">
        <label>Username</label>

        {!editingUsername ? (
          <div className="username-row">
            <div className="username-text">{username || "(not set)"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn small ghost" onClick={() => setEditingUsername(true)}>Edit</button>
              <button className="btn small" onClick={() => { navigator.clipboard.writeText(profile.referralCode || ""); alert("Referral copied"); }}>Copy Code</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input className="modern-input" value={username} onChange={(e)=>setUsername(e.target.value)} />
            <button className="btn" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Saving..." : "Save"}</button>
            <button className="btn small ghost" onClick={() => { setUsername(profile.username || ""); setEditingUsername(false); }}>Cancel</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="btn glow" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Saving..." : "Save Changes"}</button>
      </div>

      <hr style={{ margin: "18px 0", opacity: 0.25 }} />

      <h3>Security</h3>
      <p className="muted">Change password securely. We require your current password to proceed.</p>

      {!showPasswordChange ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setShowPasswordChange(true)}>Change Password</button>
          <button className="btn ghost" onClick={handleForgotPassword}>Forgot Password (Email)</button>
        </div>
      ) : (
        <form className="password-form" onSubmit={handleChangePassword}>
          <label>Current password</label>
          <input className="modern-input" type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} />
          <label>New password</label>
          <input className="modern-input" type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} />
          <label>Confirm new password</label>
          <input className="modern-input" type="password" value={confirmNew} onChange={(e)=>setConfirmNew(e.target.value)} />
          {pwMessage && <div className="error" style={{ marginTop: 8 }}>{pwMessage}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn" type="submit" disabled={pwLoading}>{pwLoading ? "Updating..." : "Update Password"}</button>
            <button className="btn small ghost" type="button" onClick={() => { setShowPasswordChange(false); setPwMessage(""); }}>Cancel</button>
          </div>
        </form>
      )}

      <hr style={{ margin: "18px 0", opacity: 0.25 }} />

      <h3>Quick Feedback</h3>
      <textarea className="field" rows={4} value={feedbackText} onChange={(e)=>setFeedbackText(e.target.value)} placeholder="Report a bug or suggest a feature..." />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button className="btn small ghost" onClick={()=>setFeedbackText("")}>Clear</button>
        <button className="btn" onClick={submitFeedback} disabled={feedbackLoading}>{feedbackLoading ? "Sending..." : "Send Feedback"}</button>
      </div>

      <div style={{ marginTop: 18, color: "var(--muted)" }}>
        <a href="/privacy-policy">Privacy Policy</a> • <a href="/contact">Contact</a>
      </div>
    </div>
  );
}
