// src/components/RankPage.jsx
import React from "react";
import XPBar from "./XPBar";

export default function RankPage({ profile, onBack = () => {} }) {

  // === XP curve duplicate (same as Dashboard) ===
  const XP_LEVELS = [
    100,200,350,500,700,900,1200,1500,1900,2300,
    2800,3400,4000,4700,5500,6300,7200,9999999
  ];

  function xpForLevel(level) {
    const i = Math.max(1, Math.min(18, level)) - 1;
    return XP_LEVELS[i];
  }

  // === Badge images ===
  const badges = [
    "/bronze1.jpg","/bronze2.jpg","/bronze3.jpg",
    "/silver1.jpg","/silver2.jpg","/silver3.jpg",
    "/gold1.jpg","/gold2.jpg","/gold3.jpg","/gold4.jpg",
    "/platinum1.jpg","/platinum2.jpg","/platinum3.jpg","/platinum4.jpg",
    "/diamond1.jpg","/diamond2.jpg","/diamond3.jpg","/diamond4.jpg",
    "/heroic.jpg"
  ];

  const level = profile.level || 1;
  const xp = profile.xp || 0;

  const levelIndex = Math.max(1, Math.min(18, level)) - 1;
  const badge = badges[levelIndex] || badges[0];

  const xpFor = xpForLevel(level);

  return (
    <section className="panel glow-panel">

      <button className="back-btn" onClick={onBack}>Back</button>

      <h2 className="modern-title" style={{ textAlign: "center" }}>Your Rank</h2>

      <div style={{ display: "flex", gap: 16, marginTop: 18 }}>

        {/* Rank Badge */}
        <div style={{
          width: 120,
          height: 120,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)"
        }}>
          <img
            src={badge}
            alt="badge"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Level {level}</div>
          <div style={{ marginTop: 6, color: "#ddd" }}>
            {xp} / {xpFor} XP
          </div>

          <div style={{ marginTop: 10 }}>
            <XPBar xp={xp} level={level} xpForLevel={xpForLevel} />
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 14, color: "var(--muted)" }}>
            <div>{profile.wins || 0} Wins</div>
            <div>{profile.played || 0} Played</div>
          </div>
        </div>

      </div>
    </section>
  );
}
