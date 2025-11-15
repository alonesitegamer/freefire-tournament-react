// src/components/AccountMenu.jsx
import React, { useState } from "react";
import MatchHistoryPage from "../pages/MatchHistoryPage";
import WithdrawalHistoryPage from "../pages/WithdrawalHistoryPage";

export default function AccountMenu({ profile, setProfile, addXP, updateProfileField }) {
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

  return (
    <div className="account-menu-wrapper">

      {view === "main" && (
        <section className="panel account-card">
          <h2 className="acc-username">{profile.username || profile.displayName || "User"}</h2>
          <p className="acc-email">{profile.email}</p>

          <div className="acc-btn-grid">

            <button className="acc-btn" onClick={() => setView("profile")}>
              Profile Settings
            </button>

            <button className="acc-btn" onClick={() => setView("rank")}>
              Rank
            </button>

            <button className="acc-btn" onClick={() => setView("refer")}>
              Refer a Friend
            </button>

          </div>
        </section>
      )}

      {/* Profile Settings */}
      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>← Back</button>
          <h3>Profile Settings</h3>

          <form onSubmit={saveName}>
            <input
              className="modern-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display Name"
            />
            <button className="btn">Save</button>
          </form>
        </section>
      )}

      {/* Rank Page */}
      {view === "rank" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>← Back</button>
          <h3>Your Rank</h3>

          <div style={{textAlign:"center", marginTop:20}}>
            <img
              src={`/ranks/${profile.level}.jpg`}
              alt="rank"
              style={{width:120, height:120, borderRadius:10}}
            />
            <h4 style={{marginTop:10}}>Level {profile.level}</h4>
            <p>{profile.xp} XP</p>
          </div>
        </section>
      )}

      {/* Refer a Friend */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>← Back</button>
          <h3>Refer a Friend</h3>
          <p>Your Code:</p>
          <h2 style={{textAlign:"center", marginTop:10}}>{profile.referralCode}</h2>
          <p style={{marginTop:10}}>Share and earn rewards when your friends join!</p>
        </section>
      )}
    </div>
  );
}
