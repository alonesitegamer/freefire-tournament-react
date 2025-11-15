// src/components/AccountMenu.jsx
import React, { useState } from "react";
import ProfileSettings from "./ProfileSettings"; // if you have it, otherwise use inline
import MatchHistoryPage from "../pages/MatchHistoryPage"; // keep but removed from main
import WithdrawalHistoryPage from "../pages/WithdrawalHistoryPage"; // kept for direct access
// this component will call the pages only when user navigates inside account

export default function AccountMenu({ profile, setProfile, addXP, updateProfileField, onRankClick = () => {} }) {
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
    <div className="account-menu">
      {view === "main" && (
        <section className="panel account-profile-card">
          <h3 className="modern-title">{profile.username || profile.displayName || "Set Username"}</h3>
          <p className="modern-subtitle">{profile.email}</p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setView("profile")}>Profile Settings</button>
            <button className="btn" onClick={() => { onRankClick(); }}>Rank</button>
            <button className="btn" onClick={() => setView("refer")}>Refer a Friend</button>
            <button className="btn" onClick={() => setView("logout")}>Logout</button>
            {/* Note: If you want logout removed entirely, you can remove the above button. */}
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn ghost" onClick={() => setView("match_history")}>Match History</button>
            <button className="btn ghost" onClick={() => setView("withdraw_history")}>Withdrawal History</button>
          </div>
        </section>
      )}

      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Profile Settings</h3>
          <form onSubmit={saveName}>
            <input className="modern-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <button className="btn">Save</button>
          </form>
        </section>
      )}

      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Refer a Friend</h3>
          <p>Your code: <strong>{profile.referralCode}</strong></p>
        </section>
      )}

      {view === "match_history" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <MatchHistoryPage />
        </section>
      )}

      {view === "withdraw_history" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <WithdrawalHistoryPage />
        </section>
      )}

      {view === "logout" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Logout</h3>
          <p>To logout close the app or use the top-right menu (if available).</p>
        </section>
      )}
    </div>
  );
}
