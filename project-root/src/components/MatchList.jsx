// src/components/MatchList.jsx
import React from "react";

export default function MatchList({ matches = [], onJoin = () => {} }) {
  return (
    <div className="matchlist-premium-grid">
      {matches.map((match) => {
        const joined = match.playersJoined?.length || 0;
        const max = match.maxPlayers || 0;
        const percent = max > 0 ? Math.min(100, Math.round((joined / max) * 100)) : 0;

        return (
          <div key={match.id} className="match-card-premium">

            {/* IMAGE */}
            <div className="match-card-img-wrapper">
              <img
                src={match.imageUrl || "/bt.jpg"}
                alt={match.title}
                className="match-card-img"
                onError={(e) => (e.target.src = "/bt.jpg")}
              />
              <div className="match-card-gradient" />
            </div>

            {/* INFO */}
            <div className="match-card-body">
              <div className="match-title">{match.title}</div>

              <div className="match-meta">
                <span>Entry: {match.entryFee ?? 0}</span>
                <span>{joined}/{max} players</span>
              </div>

              <div className="match-progress">
                <div
                  className="match-progress-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <button
                className="match-join-btn"
                onClick={() => onJoin(match)}
              >
                Join Match
              </button>
            </div>

          </div>
        );
      })}
    </div>
  );
}
