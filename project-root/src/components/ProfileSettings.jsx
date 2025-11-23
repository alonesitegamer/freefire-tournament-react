// src/components/ProfileSettings.jsx
import React, { useState } from "react";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

/**
 * Props:
 * - profile: current profile object (email, username, displayName, uid, etc.)
 * - updateProfileField: async fn to update fields in your users doc (accepts object)
 * - onBack: callback to go back to previous screen
 */
export default function ProfileSettings({ profile = {}, updateProfileField, onBack }) {
  const [username, setUsername] = useState(profile.username || "");
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [saving, setSaving] = useState(false);

  // panel toggles (inline slide-down)
  const [openPanel, setOpenPanel] = useState(null); // "username" | "password" | "feedback" | null

  // Password panel state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwStatus, setPwStatus] = useState(""); // success/error messages
  const [pwLoading, setPwLoading] = useState(false);

  // Feedback panel
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Username edit specific
  async function saveChanges() {
    if (saving) return;
    setSaving(true);
    try {
      // call the parent updater (existing function you passed)
      await updateProfileField({
        username: username.trim(),
        displayName: displayName.trim(),
      });
      setSaving(false);
      alert("Profile updated!");
      // keep panel closed if you want:
      setOpenPanel(null);
    } catch (err) {
      console.error("Profile save error:", err);
      alert("Error saving profile");
      setSaving(false);
    }
  }

  // --- Password update flow (2-step: reauth using current password then update)
  async function handleChangePassword(e) {
    e?.preventDefault?.();
    if (!currentPwd || !newPwd) {
      setPwStatus("Please enter current and new password.");
      return;
    }
    setPwLoading(true);
    setPwStatus("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      // reauthenticate
      const cred = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(user, cred);

      // update password
      await updatePassword(user, newPwd);

      setPwStatus("Password updated successfully!");
      setCurrentPwd("");
      setNewPwd("");
      setOpenPanel(null);
    } catch (err) {
      console.error("changePassword error:", err);
      // firebase common errors
      const code = err?.code || "";
      if (code === "auth/wrong-password") setPwStatus("Current password is incorrect.");
      else if (code === "auth/weak-password") setPwStatus("Choose a stronger password (6+ chars).");
      else if (code === "auth/requires-recent-login" || code === "auth/requires-recent-login") {
        // if reauth still failing, instruct user to use forgot password flow
        setPwStatus("Please use Forgot password to reauthenticate (we'll email a reset link).");
      } else setPwStatus(err.message || "Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  }

  // send firebase reset email (forgot password)
  async function handleSendResetEmail() {
    try {
      if (!profile?.email) return setPwStatus("No email on file.");
      setPwLoading(true);
      // you can pass actionCodeSettings if you want custom redirect URL after password reset
      // e.g. { url: 'https://your-site.com/password-changed', handleCodeInApp: false }
      await sendPasswordResetEmail(auth, profile.email /*, actionCodeSettings */);
      setPwStatus("Password reset email sent. Check your inbox.");
    } catch (err) {
      console.error("sendResetEmail error:", err);
      setPwStatus(err.message || "Failed to send reset email.");
    } finally {
      setPwLoading(false);
    }
  }

  // Feedback submit
  async function submitFeedback(e) {
    e?.preventDefault?.();
    if (!feedbackText || feedbackText.trim().length < 6) {
      setFeedbackMsg("Write at least a short message.");
      return;
    }
    setFeedbackLoading(true);
    setFeedbackMsg("");
    try {
      await addDoc(collection(db, "feedback"), {
        userId: auth.currentUser?.uid || null,
        email: auth.currentUser?.email || profile.email || null,
        text: feedbackText.trim(),
        createdAt: serverTimestamp(),
      });
      setFeedbackMsg("Thanks — feedback submitted.");
      setFeedbackText("");
      // optionally close panel
      setTimeout(() => setOpenPanel(null), 900);
    } catch (err) {
      console.error("feedback save error:", err);
      setFeedbackMsg("Failed to submit feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  // helper toggle: open/close same panel (click to open -> close if same)
  function togglePanel(name) {
    setPwStatus("");
    setFeedbackMsg("");
    setOpenPanel((s) => (s === name ? null : name));
  }

  return (
    <div className="modern-card profile-card" style={{ animation: "fadeIn .2s linear" }}>
      <button className="back-btn" onClick={onBack}>← Back</button>

      <h2 className="modern-title">Profile Settings</h2>
      <p className="modern-subtitle">Update username, display name, password or send feedback.</p>

      {/* EMAIL read-only */}
      <div className="form-row">
        <label className="label">Email</label>
        <input className="modern-input" value={profile.email || ""} disabled />
      </div>

      {/* USERNAME display / click-to-edit */}
      <div className="setting-row">
        <div className="setting-left">
          <div className="setting-title">Username</div>
          <div className="setting-sub">{profile.username || "Not set"}</div>
        </div>
        <div className="setting-right">
          <button className="btn ghost" onClick={() => togglePanel("username")}>Edit</button>
        </div>
      </div>

      {/* Slide-down username panel */}
      <div className={`slide-panel ${openPanel === "username" ? "open" : ""}`}>
        <div className="form-row">
          <label>Username</label>
          <input className="modern-input" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={18} />
        </div>

        <div className="form-row">
          <label>Display name</label>
          <input className="modern-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={24} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn glow" onClick={saveChanges} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          <button className="btn ghost" onClick={() => setOpenPanel(null)}>Cancel</button>
        </div>
      </div>

      {/* PASSWORD setting */}
      <div className="setting-row">
        <div className="setting-left">
          <div className="setting-title">Change Password</div>
          <div className="setting-sub">Two-step: current password required</div>
        </div>
        <div className="setting-right">
          <button className="btn ghost" onClick={() => togglePanel("password")}>Change</button>
        </div>
      </div>

      {/* Slide-down password panel */}
      <div className={`slide-panel ${openPanel === "password" ? "open" : ""}`}>
        <form onSubmit={handleChangePassword}>
          <div className="form-row">
            <label>Current password</label>
            <input type="password" className="modern-input" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
          </div>

          <div className="form-row">
            <label>New password</label>
            <input type="password" className="modern-input" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>

          {pwStatus && <div className="panel-msg">{pwStatus}</div>}

          <div className="alt-actions">
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn glow" type="submit" disabled={pwLoading}>{pwLoading ? "Updating..." : "Update Password"}</button>
              <button className="btn ghost" type="button" onClick={() => { setCurrentPwd(""); setNewPwd(""); setOpenPanel(null); }}>Cancel</button>
            </div>

            <button className="btn small ghost" type="button" onClick={handleSendResetEmail} disabled={pwLoading}>
              Forgot password?
            </button>
          </div>
        </form>
      </div>

      {/* Feedback setting */}
      <div className="setting-row">
        <div className="setting-left">
          <div className="setting-title">Feedback</div>
          <div className="setting-sub">Report bugs or send suggestions</div>
        </div>
        <div className="setting-right">
          <button className="btn ghost" onClick={() => togglePanel("feedback")}>Send</button>
        </div>
      </div>

      <div className={`slide-panel ${openPanel === "feedback" ? "open" : ""}`}>
        <form onSubmit={submitFeedback}>
          <div className="form-row">
            <label>Your feedback</label>
            <textarea className="modern-input" rows={4} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Tell us what's wrong or what you'd like improved..." />
          </div>

          {feedbackMsg && <div className="panel-msg">{feedbackMsg}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn glow" type="submit" disabled={feedbackLoading}>{feedbackLoading ? "Sending..." : "Submit"}</button>
            <button className="btn ghost" type="button" onClick={() => setOpenPanel(null)}>Cancel</button>
          </div>
        </form>
      </div>

      <hr style={{ margin: "18px 0", opacity: 0.12 }} />

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn ghost" onClick={() => window.location.href = "/privacy-policy"}>Privacy Policy</button>
        <button className="btn ghost" onClick={() => window.location.href = "/terms-of-service"}>Terms</button>
      </div>
    </div>
  );
}
