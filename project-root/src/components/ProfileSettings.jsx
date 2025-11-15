// src/components/ProfileSettings.jsx
import React, { useState } from "react";
import { auth, updatePassword } from "firebase/auth";

export default function ProfileSettings({ profile, updateProfileField, onBack }) {

  const [username, setUsername] = useState(profile.username || "");
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveChanges() {
    if (saving) return;
    setSaving(true);

    try {
      // Update username + display name
      await updateProfileField({
        username: username.trim(),
        displayName: displayName.trim(),
      });

      alert("Profile updated!");

    } catch (err) {
      console.error(err);
      alert("Error saving profile");
    }

    setSaving(false);
  }

  async function changePassword() {
    if (!newPassword) return alert("Enter a new password");

    try {
      await updatePassword(auth.currentUser, newPassword);
      alert("Password updated successfully!");
      setNewPassword("");
    } catch (err) {
      console.error(err);
      alert("Re-login required to change password.");
    }
  }

  return (
    <div className="modern-card" style={{ animation: "fadeIn .3s linear" }}>

      {/* Back Button */}
      <button className="back-btn" onClick={onBack}>
        ← Back
      </button>

      <h2 className="modern-title" style={{ textAlign: "center" }}>
        Profile Settings
      </h2>

      <p className="modern-subtitle" style={{ textAlign: "center" }}>
        Update your username, display name, and password.
      </p>

      {/* EMAIL (READ ONLY) */}
      <div className="form-group">
        <label>Email (locked)</label>
        <input
          type="email"
          className="modern-input"
          value={profile.email}
          disabled
        />
      </div>

      {/* USERNAME */}
      <div className="form-group">
        <label>Username</label>
        <input
          className="modern-input"
          value={username}
          maxLength={18}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
        />
      </div>

      {/* DISPLAY NAME */}
      <div className="form-group">
        <label>Display Name</label>
        <input
          className="modern-input"
          value={displayName}
          maxLength={24}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter display name"
        />
      </div>

      {/* SAVE BUTTON */}
      <button className="btn glow" style={{ width: "100%" }} onClick={saveChanges}>
        {saving ? "Saving..." : "Save Changes"}
      </button>

      <hr style={{ margin: "24px 0", opacity: 0.3 }} />

      {/* PASSWORD CHANGE */}
      <div className="form-group">
        <label>New Password</label>
        <input
          type="password"
          className="modern-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password"
        />
      </div>

      <button className="btn ghost glow" style={{ width: "100%" }} onClick={changePassword}>
        Change Password
      </button>

    </div>
  );
}
