import React from "react";

export default function RankPage({ profile }) {
  const { xp = 0, level = 1 } = profile;

  // XP needed for next level (example: level * 100)
  const nextXP = level * 100;
  const progress = Math.min(100, Math.round((xp / nextXP) * 100));

  // Badge image (must be inside public/ranks/)
  const badge = `/ranks/${profile.rankImage || "bronze1.jpg"}`;

  return (
    <div className="rank-container">

      <h2 className="rank-title">Your Rank</h2>

      <div className="rank-card">
        <img src={badge} className="rank-badge" alt="Rank Badge" />

        <h3 className="rank-level">Level {level}</h3>

        <div className="xp-bar">
          <div className="xp-fill" style={{ width: `${progress}%` }} />
        </div>

        <p className="xp-text">
          {xp} / {nextXP} XP
        </p>

        <div className="rank-stats">
          <p><strong>{profile.totalWins || 0}</strong> Wins</p>
          <p><strong>{profile.totalMatches || 0}</strong> Played</p>
        </div>
      </div>
    </div>
  );
}
