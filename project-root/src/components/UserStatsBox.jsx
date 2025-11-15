// src/components/UserStatsBox.jsx
import React from "react";
import RankBadge from "./RankBadge";

export default function UserStatsBox({ profile, xpToLevel, xpForLevel }) {
  const lvl = profile.level || xpToLevel(profile.xp || 0);
  return (
    <div className="user-stats-box modern-card">
      <div style={{display:"flex", alignItems:"center", gap:12}}>
        <RankBadge level={lvl} size={60} />
        <div>
          <div style={{fontWeight:800}}>{profile.displayName || profile.email.split("@")[0]}</div>
          <div className="muted-small">Level {lvl} • {profile.xp ?? 0} XP</div>
        </div>
      </div>
      <div style={{marginTop:10, display:"flex", gap:8, justifyContent:"space-between"}}>
        <div className="stat">
          <div className="stat-value">{profile.coins ?? 0}</div>
          <div className="muted-small">Coins</div>
        </div>
        <div className="stat">
          <div className="stat-value">{profile.wins ?? 0}</div>
          <div className="muted-small">Wins</div>
        </div>
        <div className="stat">
          <div className="stat-value">{profile.played ?? 0}</div>
          <div className="muted-small">Played</div>
        </div>
      </div>
    </div>
  );
}
