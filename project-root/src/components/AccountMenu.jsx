// src/components/AccountMenu.jsx
import React, { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  onRankClick = () => {},
  onLogout = null,
  openAvatarModal // <-- added from Dashboard
}) {
  const [view, setView] = useState("main");
  const [displayName, setDisplayName] = useState(profile.displayName || "");

  async function saveName(e) {
    e.preventDefault();
    if (!displayName) return alert("Enter a name");
    await updateProfileField({ displayName });
    setProfile(prev => ({ ...prev, displayName }));
    alert("Saved");
    setView("main");
  }

  async function doLogout() {
    if (typeof onLogout === "function") return onLogout();
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div className="account-menu">
      {/* MAIN ACCOUNT PAGE */}
      {view === "main" && (
        <section className="panel account-profile-card">

          {/* Avatar – CLICK to open modal */}
          <div 
            style={{
              width: 96,
              height: 96,
              borderRadius: 12,
              overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.06)",
              margin: "0 auto",
              cursor: "pointer"
            }}
            onClick={openAvatarModal}
          >
            <img
              src={profile.avatar || "/avatars/default.jpg"}
              alt="avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <div
            style={{
              fontWeight: 800,
              fontSize: 18,
              marginTop: 10,
              color: "var(--accent2)"
            }}
          >
            {profile.displayName || profile.username || "Player"}
          </div>

          <div style={{ color: "var(--muted)" }}>{profile.email}</div>

          <div className="account-btn-group">
            {/* Profile */}
            <button className="account-option" onClick={() => setView("profile")}>
              <span>👤 Profile Settings</span>
            </button>

            {/* Rank */}
            <button className="account-option" onClick={onRankClick}>
              <span>🏆 Rank</span>
            </button>

            {/* Refer */}
            <button className="account-option" onClick={() => setView("refer")}>
              <span>🔗 Refer a Friend</span>
            </button>

            {/* Logout */}
            <button className="account-option logout" onClick={doLogout}>
              <span>🚪 Logout</span>
            </button>
          </div>
        </section>
      )}

      {/* PROFILE SETTINGS */}
      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>

          <h3>Profile Settings</h3>

          <form onSubmit={saveName}>
            <input
              className="modern-input"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Enter display name"
            />
            <button className="btn">Save</button>
          </form>
        </section>
      )}

      {/* REFER */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>

          <h3>Refer a Friend</h3>
          <p>Your referral code:</p>

          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}
    </div>
  );
}
