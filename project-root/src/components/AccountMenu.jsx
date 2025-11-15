// src/components/AccountMenu.jsx
import React, { useState } from "react";

export default function AccountMenu({ profile, setProfile, updateProfileField, onRankClick }) {
  
  const [view, setView] = useState("main");
  const [displayName, setDisplayName] = useState(profile.displayName || "");

  async function saveName(e) {
    e.preventDefault();
    if (!displayName) return alert("Enter a name.");
    await updateProfileField({ displayName });
    setProfile(prev => ({ ...prev, displayName }));
    alert("Saved!");
    setView("main");
  }

  return (
    <div className="account-menu">

      {view === "main" && (
        <>
          <section className="panel glow-panel account-profile-card">
            <h3 className="modern-title">{profile.username || "User"}</h3>
            <p className="modern-subtitle">{profile.email}</p>

            <div className="account-btn-group">
              <button className="account-option" onClick={()=>setView("profile")}>
                Profile Settings
              </button>

              <button className="account-option" onClick={onRankClick}>
                Rank
              </button>

              <button className="account-option" onClick={()=>setView("refer")}>
                Refer a Friend
              </button>
            </div>
          </section>
        </>
      )}

      {view === "profile" && (
        <section className="panel glow-panel">
          <button className="back-btn" onClick={()=>setView("main")}>Back</button>
          <h3>Profile Settings</h3>

          <form onSubmit={saveName}>
            <input
              className="modern-input"
              value={displayName}
              onChange={(e)=>setDisplayName(e.target.value)}
            />
            <button className="btn glow" type="submit">Save</button>
          </form>
        </section>
      )}

      {view === "refer" && (
        <section className="panel glow-panel">
          <button className="back-btn" onClick={()=>setView("main")}>Back</button>

          <h3>Your Referral Code</h3>
          <div className="referral-code">{profile.referralCode}</div>
          <p>Share with your friends to get rewards!</p>
        </section>
      )}

    </div>
  );
}
