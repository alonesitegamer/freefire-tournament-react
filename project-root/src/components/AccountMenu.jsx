// src/components/AccountMenu.jsx
import React, { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

// Modern icons
import { User, Trophy, Link2, LogOut } from "lucide-react";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  onRankClick = () => {},
  onLogout = null,
  openAvatarModal
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

          {/* CLICKABLE AVATAR */}
          <div
            onClick={openAvatarModal}
            style={{
              width: 110,
              height: 110,
              borderRadius: 14,
              overflow: "hidden",
              margin: "0 auto",
              cursor: "pointer",
              border: "2px solid rgba(255,255,255,0.15)",
              boxShadow: "0 0 18px rgba(255,255,255,0.08)"
            }}
          >
            <img
              src={profile.avatar || "/avatars/default.jpg"}
              alt="avatar"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
          </div>

          {/* Username */}
          <div
            style={{
              fontWeight: 800,
              fontSize: 20,
              marginTop: 12,
              color: "var(--accent2)"
            }}
          >
            {profile.displayName || profile.username || "Player"}
          </div>

          {/* Email */}
          <div style={{ color: "var(--muted)", marginBottom: 18 }}>
            {profile.email}
          </div>

          {/* OPTIONS LIST */}
          <div className="account-btn-group">

            <button className="account-option" onClick={() => setView("profile")}>
              <User size={20} color="var(--accent2)" style={{ marginRight: 14 }} />
              <span>Profile Settings</span>
            </button>

            <button className="account-option" onClick={onRankClick}>
              <Trophy size={20} color="var(--accent2)" style={{ marginRight: 14 }} />
              <span>Rank</span>
            </button>

            <button className="account-option" onClick={() => setView("refer")}>
              <Link2 size={20} color="var(--accent2)" style={{ marginRight: 14 }} />
              <span>Refer a Friend</span>
            </button>

            <button className="account-option logout" onClick={doLogout}>
              <LogOut size={20} color="#ff5c5c" style={{ marginRight: 14 }} />
              <span>Logout</span>
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
          <button className="back-btn" onClick={() => setView("main")}>Back</button>

          <h3>Refer a Friend</h3>
          <p>Your referral code:</p>

          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}
    </div>
  );
}
