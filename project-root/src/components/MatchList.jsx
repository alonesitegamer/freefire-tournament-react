// src/components/MatchList.jsx
import React from "react";

export default function MatchList({ matches = [], onSelect = ()=>{}, onJoin = ()=>{} }) {
  return (
    <div className="match-grid">
      {matches.map((match) => (
        <div
          key={match.id}
          className="match-card-premium"
          onClick={() => onSelect(match)}
        >
          <img
            src={match.imageUrl || "/bt.jpg"}
            className="match-card-img"
            alt="match"
          />

          <div className="match-card-body">
            <div className="match-card-title">{match.title}</div>

            <div className="match-card-info">
              <span>Entry: {match.entryFee}</span>
              <span>{match.playersJoined?.length || 0}/{match.maxPlayers}</span>
            </div>

            <button
              className="join-btn"
              onClick={(e) => {
                e.stopPropagation(); // prevent opening match details
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
