// src/components/AccountMenu.jsx
import React, { useState } from "react";
import MatchHistoryPage from "../pages/MatchHistoryPage";
import WithdrawalHistoryPage from "../pages/WithdrawalHistoryPage";

export default function AccountMenu({
  profile,
  setProfile,
  addXP,
  updateProfileField
}) {
  const [view, setView] = useState("main");
  const [displayName, setDisplayName] = useState(profile.displayName || "");

  async function saveName(e) {
    e.preventDefault();
    if (!displayName) return alert("Enter a name");
    await updateProfileField({ displayName });
    setProfile((prev) => ({ ...prev, displayName }));
    alert("Saved");
    setView("main");
  }

  // Rank Info
  const {
    xp = 0,
    level = 1,
    totalWins = 0,
    totalMatches = 0,
    rankImage = "bronze1.jpg"
  } = profile;

  const nextXP = level * 100;
  const progress = Math.min(100, Math.round((xp / nextXP) * 100));

  return (
    <div>
      {/* MAIN ACCOUNT MENU */}
      {view === "main" && (
        <section className="panel account-profile-card">
          <h3 className="modern-title">{profile.username || "Username"}</h3>
          <p className="modern-subtitle">{profile.email}</p>

          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setView("profile")}>
              Profile Settings
            </button>

            <button className="btn" onClick={() => setView("rank")}>
              Rank
            </button>

            <button className="btn ghost" onClick={() => setView("refer")}>
              Refer a Friend
            </button>

            <button className="btn" onClick={() => setView("match_history")}>
              Match History
            </button>

            <button className="btn" onClick={() => setView("withdraw_history")}>
              Withdrawal History
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
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button className="btn">Save</button>
          </form>
        </section>
      )}

      {/* REFER A FRIEND */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>

          <h3>Refer a Friend</h3>
          <p>
            Your code: <strong>{profile.referralCode}</strong>
          </p>
          <p>Share and earn rewards when friends redeem.</p>
        </section>
      )}

      {/* MATCH HISTORY */}
      {view === "match_history" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>
          <MatchHistoryPage />
        </section>
      )}

      {/* WITHDRAW HISTORY */}
      {view === "withdraw_history" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>
          <WithdrawalHistoryPage />
        </section>
      )}

      {/* RANK PAGE */}
      {view === "rank" && (
        <section className="panel rank-panel">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>

          <h2 className="rank-title">Your Rank</h2>

          <div className="rank-card">
            <img
              className="rank-badge"
              src={`/ranks/${rankImage}`}
              alt="Rank Badge"
            />

            <h3 className="rank-level">Level {level}</h3>

            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${progress}%` }} />
            </div>

            <p className="xp-text">
              {xp} / {nextXP} XP
            </p>

            <div className="rank-stats">
              <p>
                <strong>{totalWins}</strong> Wins
              </p>
              <p>
                <strong>{totalMatches}</strong> Played
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
