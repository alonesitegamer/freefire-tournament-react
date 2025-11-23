// src/components/ProfileSettings.jsx
import React, { useState } from "react";

export default function ProfileSettings({
  profile = {},
  updateProfileField = async () => {},
  onBack = () => {},
  setProfile = () => {}
}) {
  const [editingUsername, setEditingUsername] = useState(false);
  const [username, setUsername] = useState(profile.username || "");
  const [inGameName, setInGameName] = useState(profile.displayName || "");
  const [saving, setSaving] = useState(false);

  async function saveChanges(e) {
    e && e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await updateProfileField({
        username: username.trim(),
        displayName: inGameName.trim(),
      });

      setProfile(prev => ({
        ...prev,
        username: username.trim(),
        displayName: inGameName.trim(),
      }));

      alert("Changes saved successfully!");
      setEditingUsername(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update profile");
    }
    setSaving(false);
  }

  return (
    <div className="profile-settings-root">

      <button className="back-btn" onClick={onBack}>← Back</button>

      <h2 className="modern-title">Profile Settings</h2>

      {/* EMAIL LOCKED */}
      <div className="profile-section">
        <label>Email (locked)</label>
        <input className="modern-input" value={profile.email || ""} disabled />
      </div>

      {/* IN-GAME NAME */}
      <div className="profile-section">
        <label>In-game Username</label>
        <input
          className="modern-input"
          value={inGameName}
          maxLength={24}
          onChange={e => setInGameName(e.target.value)}
          placeholder="Enter in-game name"
        />
      </div>

      {/* USERNAME FIELD */}
      <div className="profile-section">
        <label>Username</label>

        {!editingUsername ? (
          <div className="username-row">
            <div className="username-text">{username || "(not set)"}</div>

            <button
              className="btn small ghost"
              onClick={() => setEditingUsername(true)}
            >
              Edit
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <input
              className="modern-input"
              value={username}
              maxLength={18}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button className="btn small" onClick={saveChanges}>
              Save
            </button>
            <button
              className="btn small ghost"
              onClick={() => {
                setEditingUsername(false);
                setUsername(profile.username || "");
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* SAVE BUTTON */}
      <button
        className="btn glow"
        style={{ marginTop: 16 }}
        onClick={saveChanges}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>

      {/* FOOTER LINKS */}
      <div style={{ marginTop: 22, color: "var(--muted)" }}>
        <a href="/privacy-policy">Privacy Policy</a> •{" "}
        <a href="/contact">Contact</a>
      </div>
    </div>
  );
}
