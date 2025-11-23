// src/components/ProfileSettings.jsx
import React, { useState } from "react";
import { auth } from "../firebase";
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  sendPasswordResetEmail,
} from "firebase/auth";

/**
 * Props:
 * - profile: current user profile object (has .email)
 * - updateProfileField(patch): function to update firestore profile
 * - onBack(): callback to go back
 */
export default function ProfileSettings({ profile, updateProfileField, onBack }) {
  const [username, setUsername] = useState(profile.username || "");
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  // Save username & displayName to Firestore via provided function
  async function saveChanges() {
    if (savingProfile) return;
    setProfileMsg("");
    setSavingProfile(true);
    try {
      await updateProfileField({
        username: username.trim(),
        displayName: displayName.trim(),
      });
      setProfileMsg("Profile updated.");
    } catch (err) {
      console.error("saveChanges error", err);
      setProfileMsg("Failed to save profile.");
    } finally {
      setSavingProfile(false);
      setTimeout(() => setProfileMsg(""), 3000);
    }
  }

  // 2-step password change: reauthenticate with current password then update
  async function changePassword() {
    if (changingPassword) return;
    setPasswordMsg("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg("Please fill all password fields.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("New password and confirm password do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("User not signed in.");

      // Reauthenticate
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      setPasswordMsg("Password updated successfully.");
      // clear sensitive fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("changePassword error", err);
      // friendly messages
      const code = err?.code || "";
      if (code.includes("wrong-password") || code.includes("auth/wrong-password")) {
        setPasswordMsg("Current password is incorrect.");
      } else if (code.includes("too-many-requests")) {
        setPasswordMsg("Too many attempts. Try again later.");
      } else if (code.includes("requires-recent-login")) {
        setPasswordMsg("Please re-login and try again.");
      } else {
        setPasswordMsg(err.message || "Failed to change password.");
      }
    } finally {
      setChangingPassword(false);
      setTimeout(() => setPasswordMsg(""), 6000);
    }
  }

  // Forgot password -> send Firebase password reset email (redirect back to homepage)
  async function forgotPasswordSendEmail() {
    if (resetSending) return;
    setPasswordMsg("");
    setResetSending(true);
    try {
      const redirectUrl = "https://freefire-tournament-react.vercel.app/"; // option A
      const actionCodeSettings = {
        url: redirectUrl,
        handleCodeInApp: false,
      };
      await sendPasswordResetEmail(auth, profile.email, actionCodeSettings);
      setPasswordMsg("Password reset email sent. Check your inbox.");
    } catch (err) {
      console.error("forgotPasswordSendEmail error", err);
      // map common errors
      const code = err?.code || "";
      if (code.includes("auth/invalid-email") || code.includes("auth/missing-email")) {
        setPasswordMsg("Invalid user email.");
      } else if (code.includes("auth/user-not-found")) {
        setPasswordMsg("No account found for this email.");
      } else {
        setPasswordMsg(err.message || "Failed to send reset email.");
      }
    } finally {
      setResetSending(false);
      setTimeout(() => setPasswordMsg(""), 7000);
    }
  }

  return (
    <div className="profile-settings-card">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <h2 className="modern-title">Profile Settings</h2>
      <p className="modern-subtitle">Update your username, display name, or password.</p>

      <div className="modern-card inner">
        <label className="label">Email (locked)</label>
        <input className="modern-input" value={profile.email} disabled />

        <label className="label">Username</label>
        <input
          className="modern-input"
          value={username}
          maxLength={18}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
        />

        <label className="label">Display name</label>
        <input
          className="modern-input"
          value={displayName}
          maxLength={24}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter display name"
        />

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button className="btn glow" onClick={saveChanges} disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save Changes"}
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              // reset to original
              setUsername(profile.username || "");
              setDisplayName(profile.displayName || "");
              setProfileMsg("Reset to saved values.");
              setTimeout(() => setProfileMsg(""), 2000);
            }}
            disabled={savingProfile}
          >
            Reset
          </button>
        </div>

        {profileMsg && <div className="notice" style={{ marginTop: 10 }}>{profileMsg}</div>}
      </div>

      <hr style={{ margin: "20px 0", opacity: 0.25 }} />

      <div className="modern-card inner">
        <h3 style={{ marginTop: 0 }}>Change Password</h3>

        <label className="label">Current password</label>
        <input
          type="password"
          className="modern-input"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
        />

        <label className="label">New password</label>
        <input
          type="password"
          className="modern-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password"
        />

        <label className="label">Confirm new password</label>
        <input
          type="password"
          className="modern-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
        />

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="btn glow" onClick={changePassword} disabled={changingPassword}>
            {changingPassword ? "Updating..." : "Change Password"}
          </button>

          <button className="btn ghost" onClick={forgotPasswordSendEmail} disabled={resetSending}>
            {resetSending ? "Sending..." : "Forgot password? Email me a reset link"}
          </button>
        </div>

        {passwordMsg && <div className="notice" style={{ marginTop: 10 }}>{passwordMsg}</div>}
      </div>
    </div>
  );
}
