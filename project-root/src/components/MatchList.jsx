// src/components/MatchList.jsx
import React from "react";

export default function MatchList({ matches = [], onSelect = ()=>{}, onJoin = ()=>{} }) {
  return (
    <div className="grid">
      {matches.map(match => (
        <div key={match.id} className="match-card" onClick={()=>onSelect(match)}>
          <img src={match.imageUrl || "/bt.jpg"} alt={match.title} />
          <div className="match-info">
            <div className="match-title">{match.title}</div>
            <div className="match-meta">Entry: {match.entryFee} | Joined: {match.playersJoined?.length || 0}/{match.maxPlayers}</div>
            <button className="btn" onClick={(e)=>{ e.stopPropagation(); onJoin(match); }}>{match.playersJoined?.includes?.(window?.firebase?.auth?.currentUser?.uid) ? "Joined" : "Join"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// src/components/MatchDetails.jsx
import React from "react";

export default function MatchDetails({ match, onBack = ()=>{}, onJoin = ()=>{} }) {
  if (!match) return null;
  return (
    <section className="panel match-details-view">
      <div className="match-details-header">
        <button className="back-btn" onClick={onBack}>Back</button>
      </div>
      <img src={match.imageUrl || "/bt.jpg"} alt="match" className="match-details-image" />
      <h3 className="modern-title">{match.title}</h3>
      <p className="match-details-time">Starts: {match.startTime ? new Date(match.startTime.seconds ? match.startTime.seconds*1000 : match.startTime).toLocaleString() : "TBD"}</p>
      <div className="match-rules">
        <h4>Rules</h4>
        <p>{match.rules || "No special rules."}</p>
      </div>
      <div style={{marginTop:12}}>
        <button className="btn" onClick={()=>onJoin(match)}>Join for {match.entryFee} coins</button>
      </div>
    </section>
  );
}
