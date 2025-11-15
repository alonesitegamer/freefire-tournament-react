// src/components/RankPage.jsx
import React from "react";
import RankBadge from "./RankBadge";

/**
 * Props:
 *  - profile (object) required: { xp, level, coins, wins, played }
 *  - onBack() optional
 */
export default function RankPage({ profile = {}, onBack = () => {} }) {
  const xp = profile.xp || 0;
  const level = profile.level || 1;

  // XP table should match the one in Dashboard
  const XP_LEVELS = [
    100,200,350,500,700,900,1200,1500,1900,2300,
    2800,3400,4000,4700,5500,6300,7200,9999999
  ];

  const currentLevelIndex = Math.max(0, Math.min(XP_LEVELS.length - 1, level - 1));
  const nextXpCap = XP_LEVELS[currentLevelIndex];
  // xpForPrevLevel: sum base logic — we assume progress is xp mod cap (simple)
  const prevCap = currentLevelIndex === 0 ? 0 : XP_LEVELS[currentLevelIndex - 1];
  const progressValue = Math.max(0, xp - prevCap);
  const progressTotal = Math.max(1, nextXpCap - prevCap);
  const percent = Math.round((progressValue / progressTotal) * 100);

  return (
    <section className="panel rank-container">
      <button className="back-btn" onClick={onBack}>Back</button>

      <h3>Your Rank</h3>

      <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 8 }}>
        <RankBadge level={level} size={110} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Level {level}</div>
          <div style={{ marginTop: 8, marginBottom: 10 }}>{progressValue} / {progressTotal} XP</div>
          <div className="xpbar-root" style={{ height: 14 }}>
            <div className="xpbar-track" style={{ height: "100%", borderRadius: 8 }}>
              <div className="xpbar-fill" style={{ width: `${percent}%`, height: "100%" }} />
            </div>
          </div>

          <div style={{ marginTop: 10, color: "var(--muted)" }}>
            <span style={{ marginRight: 20 }}>{profile.wins ?? 0} Wins</span>
            <span>{profile.played ?? 0} Played</span>
          </div>
        </div>
      </div>
    </section>
  );
}
