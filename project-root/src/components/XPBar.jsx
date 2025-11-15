// src/components/XPBar.jsx
import React from "react";
import RankBadge from "./RankBadge";

export default function XPBar({ xp = 0, level = 1, xpForLevel }) {
  const next = xpForLevel(level);
  const prev = level === 1 ? 0 : xpForLevel(level - 1);
  const progress = Math.max(0, Math.min(1, (xp - prev) / Math.max(1, next - prev)));
  return (
    <div className="xpbar-root">
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <RankBadge level={level} size={48} />
        <div style={{flex:1}}>
          <div className="xpbar-track" style={{height:12, borderRadius:12, overflow:"hidden", background:"rgba(255,255,255,0.06)"}}>
            <div className="xpbar-fill" style={{width:`${progress*100}%`, height:"100%", transition:"width 900ms cubic-bezier(.2,.9,.3,1)", boxShadow:"0 0 18px rgba(0,200,150,0.3)"}} />
          </div>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginTop:6}}>
            <div>Lvl {level}</div>
            <div>{xp - prev} / {next - prev} XP</div>
          </div>
        </div>
      </div>
    </div>
  );
}
