// src/components/AccountMenu.jsx
import React, { useState } from "react";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  addXP = async () => {},
  onRankClick = () => {},
  onLogout = null,
  openAvatarModal = () => {}   // 🔥 we trigger avatar modal from Dashboard
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
    window.location.href = "/login";
  }

  return (
    <div className="account-menu">

      {/* ---------------- MAIN PAGE ---------------- */}
      {view === "main" && (
        <section className="panel account-profile-card">

          {/* Avatar Box */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              marginTop: 8
            }}
          >
            {/* CLICKABLE AVATAR → OPEN MODAL */}
            <div
              onClick={openAvatarModal}
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                overflow: "hidden",
                cursor: "pointer",
                border: "3px solid #ff8a3d",
                boxShadow:
                  "0 0 12px rgba(255,136,61,0.7), inset 0 0 10px rgba(255,136,61,0.4)",
                transition: "0.25s",
              }}
            >
              <img
                src={profile.avatar || "/avatars/default.jpg"}
                alt="avatar"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "0.3s",
                }}
              />
            </div>

            <div style={{ fontWeight: 800, fontSize: 20, color: "var(--accent2)" }}>
              {profile.username || profile.displayName || "Player"}
            </div>
            <div style={{ color: "var(--muted)" }}>{profile.email}</div>
          </div>

          {/* Menu Buttons */}
          <div className="account-btn-group" style={{ width: "100%", marginTop: 6 }}>

            <button className="account-option" onClick={() => setView("profile")}>
              <span style={{ marginRight: 12 }}>👤</span>
              <span>Profile Settings</span>
            </button>

            <button className="account-option" onClick={onRankClick}>
              <span style={{ marginRight: 12 }}>🏆</span>
              <span>Rank</span>
            </button>

            <button className="account-option" onClick={() => setView("refer")}>
              <span style={{ marginRight: 12 }}>🔗</span>
              <span>Refer a Friend</span>
            </button>

            <button className="account-option" onClick={doLogout}>
              <span style={{ marginRight: 12 }}>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </section>
      )}

      {/* ---------------- PROFILE SETTINGS ---------------- */}
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
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button className="btn">Save</button>
          </form>
        </section>
      )}

      {/* ---------------- REFER A FRIEND ---------------- */}
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
