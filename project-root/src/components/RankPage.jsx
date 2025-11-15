// src/components/RankPage.jsx
import React from "react";
import XPBar from "./XPBar";

/**
 * RankPage shows current badge, level, xp and stats.
 * expects profile { xp, level, coins, wins, played } and xpForLevel function
 * badge files must be in public/ as given:
 * bronze1.jpg, bronze2.jpg, bronze3.jpg,
 * silver1.jpg, silver2.jpg, silver3.jpg,
 * gold1.jpg,gold2.jpg,gold3.jpg,gold4.jpg,
 * platinum1.jpg,platinum2.jpg,platinum3.jpg,platinum4.jpg,
 * diamond1.jpg,diamond2.jpg,diamond3.jpg,diamond4.jpg,
 * heroic.jpg
 */
export default function RankPage({ profile, xpForLevel, onBack = () => {} }) {
  const badges = [
    "/bronze1.jpg","/bronze2.jpg","/bronze3.jpg",
    "/silver1.jpg","/silver2.jpg","/silver3.jpg",
    "/gold1.jpg","/gold2.jpg","/gold3.jpg","/gold4.jpg",
    "/platinum1.jpg","/platinum2.jpg","/platinum3.jpg","/platinum4.jpg",
    "/diamond1.jpg","/diamond2.jpg","/diamond3.jpg","/diamond4.jpg",
    "/heroic.jpg"
  ];

  const levelIndex = Math.max(1, Math.min(18, profile.level || 1)) - 1;
  const badge = badges[levelIndex] || badges[0];
  const xp = profile.xp || 0;
  const level = profile.level || 1;
  const xpFor = xpForLevel(level);

  return (
    <section className="panel glow-panel">
      <button className="back-btn" onClick={onBack}>Back</button>
      <h3>Your Rank</h3>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 12 }}>
        <div style={{ width: 120, height: 120, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
          <img src={badge} alt="badge" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Level {level}</div>
          <div style={{ marginTop: 8 }}>{xp} / {xpFor} XP</div>
          <div style={{ marginTop: 12 }}>
            <XPBar xp={xp} level={level} xpForLevel={(l)=>xpFor} />
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 12, color: "var(--muted)" }}>
            <div>{profile.wins || 0} Wins</div>
            <div>{profile.played || 0} Played</div>
          </div>
        </div>
      </div>
    </section>
  );
}
