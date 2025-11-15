// src/components/MatchList.jsx
import React from "react";

export default function MatchList({ matches = [], onSelect = ()=>{}, onJoin = ()=>{} }) {
  return (
    <div className="grid">
      {matches.map(match => (
        <div
          key={match.id}
          className="match-card"
          onClick={() => onSelect(match)}
        >
          <img src={match.imageUrl || "/bt.jpg"} alt={match.title} />

          <div className="match-info">
            <div className="match-title">{match.title}</div>
            <div className="match-meta">
              Entry: {match.entryFee} | Joined:{" "}
              {match.playersJoined?.length || 0}/{match.maxPlayers}
            </div>

            <button
              className="btn"
              onClick={(e) => {
                e.stopPropagation();
                onJoin(match);
              }}
            >
              Join
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
