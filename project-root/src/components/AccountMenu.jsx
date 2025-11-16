// src/components/AccountMenu.jsx
import React, { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  addXP = async () => {},
  onRankClick = () => {},
  onLogout = null,
  onOpenAvatar = () => {}   // ← NEW: triggers avatar modal
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

      {/* MAIN PAGE */}
      {view === "main" && (
        <section className="panel account-profile-card">

          {/* Top User Card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* CLICKABLE AVATAR */}
            <div
              style={{
                width: 82,
                height: 82,
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer"
              }}
              onClick={onOpenAvatar}
            >
              <img
                src={profile.avatar || "/avatars/default.jpg"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                alt="avatar"
              />
            </div>

            <div style={{ fontWeight: 800, fontSize: 20, color: "var(--accent2)" }}>
              {profile.username || profile.displayName || "Set Username"}
            </div>

            <div style={{ color: "var(--muted)" }}>{profile.email}</div>
          </div>

          {/* OPTIONS */}
          <div className="account-btn-group" style={{ width: "100%", marginTop: 18 }}>

            <button className="account-option" onClick={() => setView("profile")}>
              Profile Settings
            </button>

            <button className="account-option" onClick={onRankClick}>
              Rank
            </button>

            <button className="account-option" onClick={() => setView("refer")}>
              Refer a Friend
            </button>

            <button
              className="account-option"
              style={{ background: "rgba(255,255,255,0.05)" }}
              onClick={doLogout}
            >
              Logout
            </button>
          </div>
        </section>
      )}

      {/* PROFILE SETTINGS */}
      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Profile Settings</h3>

          <form onSubmit={saveName}>
            <input
              className="modern-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter display name"
            />
            <button className="btn">Save</button>
          </form>
        </section>
      )}

      {/* REFER */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Refer a Friend</h3>
          <p>Your code:</p>
          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}
    </div>
  );
}
