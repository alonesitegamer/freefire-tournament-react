// src/components/MatchList.jsx
import React from "react";

export default function MatchList({ matches = [], onSelect = () => {} }) {
  return (
    <div className="matchlist-premium-grid">
      {matches.map((match) => {
        const filled = (match.playersJoined?.length || 0);
        const max = match.maxPlayers || 0;
        const percent = max > 0 ? Math.min(100, Math.round((filled / max) * 100)) : 0;

        return (
          <div
            key={match.id}
            className="match-card-premium"
            onClick={() => onSelect(match)}
          >
            {/* IMAGE */}
            <div className="match-card-img-wrapper">
              <img
                src={match.imageUrl || "/bt.jpg"}
                alt={match.title}
                className="match-card-img"
                onError={(e) => (e.target.src = "/bt.jpg")}
              />

              {/* GRADIENT OVERLAY */}
              <div className="match-card-gradient" />
            </div>

            {/* DETAILS */}
            <div className="match-card-body">
              <div className="match-title">{match.title}</div>

              <div className="match-meta">
                <span>Entry: {match.entryFee ?? 0}</span>
                <span>
                  {filled}/{max} joined
                </span>
              </div>

              {/* PROGRESS BAR */}
              <div className="match-progress">
                <div
                  className="match-progress-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* JOIN BUTTON */}
              <button className="match-join-btn">Join</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
