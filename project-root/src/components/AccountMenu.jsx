// src/components/AccountMenu.jsx
import React, { useState } from "react";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  addXP = async () => {},
  onRankClick = () => {},
  onLogout = () => {},
  openAvatarModal = () => {}   // ← from Dashboard
}) {
  const [view, setView] = useState("main");
  const [displayName, setDisplayName] = useState(profile.displayName || "");

  // Save username
  async function saveName(e) {
    e.preventDefault();
    if (!displayName) return alert("Enter a name");
    await updateProfileField({ displayName });
    setProfile(prev => ({ ...prev, displayName }));
    alert("Saved!");
    setView("main");
  }

  return (
    <div className="account-menu">
      {/* MAIN PAGE */}
      {view === "main" && (
        <section className="panel account-profile-card" style={{ textAlign:"center" }}>
          
          {/* AVATAR — clicking opens modal */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <div
              onClick={openAvatarModal}
              style={{
                width: 82,
                height: 82,
                borderRadius: 14,
                overflow: "hidden",
                border: "2px solid var(--accent2)",
                cursor: "pointer"
              }}
            >
              <img
                src={profile.avatar || "/avatars/default.jpg"}
                alt="avatar"
                style={{ width:"100%", height:"100%", objectFit:"cover" }}
              />
            </div>

            <div style={{ fontWeight:800, fontSize:20 }}>
              {profile.displayName || profile.username || "Player"}
            </div>

            <div style={{ color:"var(--muted)", fontSize:13 }}>{profile.email}</div>
          </div>

          {/* BUTTONS */}
          <div className="account-btn-group" style={{ marginTop:20 }}>
            {/* Profile */}
            <button className="account-option" onClick={() => setView("profile")}>
              👤 Profile Settings
            </button>

            {/* Rank */}
            <button className="account-option" onClick={onRankClick}>
              🏆 Rank
            </button>

            {/* Refer */}
            <button className="account-option" onClick={() => setView("refer")}>
              🔗 Refer a Friend
            </button>

            {/* Logout */}
            <button className="account-option" onClick={onLogout} style={{ background:"rgba(255,255,255,0.05)" }}>
              🚪 Logout
            </button>
          </div>
        </section>
      )}

      {/* PROFILE SETTINGS */}
      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Profile Settings</h3>

          <form onSubmit={saveName} style={{ marginTop:10 }}>
            <input
              className="modern-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button className="btn" style={{ marginTop:12 }}>Save</button>
          </form>
        </section>
      )}

      {/* REFER PAGE */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Refer a Friend</h3>

          <p>Your referral code:</p>
          <div
            style={{
              marginTop:10,
              padding:10,
              fontSize:18,
              borderRadius:8,
              background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.12)"
            }}
          >
            {profile.referralCode}
          </div>
        </section>
      )}
    </div>
  );
}
