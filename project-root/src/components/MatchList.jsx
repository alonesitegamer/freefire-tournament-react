// src/components/MatchList.jsx
import React from "react";

export default function MatchList({ matches = [], onSelect = () => {}, onJoin = () => {} }) {
  return (
    <div className="matchlist-grid">
      {matches.map((match) => (
        <div
          key={match.id}
          className="match-card-premium"
          onClick={() => onSelect(match)}
        >
          <div className="match-banner">
            <img
              src={match.imageUrl || "/bt.jpg"}
              alt={match.title}
              className="match-banner-img"
            />

            <div className="match-info-overlay">
              <div className="match-title-premium">{match.title}</div>

              <div className="match-meta-premium">
                Entry: {match.entryFee ?? 0} | Joined:{" "}
                {match.playersJoined?.length || 0}/{match.maxPlayers || "?"}
              </div>

              <button
                className="match-join-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin(match);
                }}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
