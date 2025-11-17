// src/components/MatchList.jsx
import React from "react";

export default function MatchList({ matches = [], onSelect = () => {}, onJoin = () => {} }) {
  return (
    <div className="matchlist-root">
      {matches.map((m) => {
        const joinedCount = m.playersJoined?.length || 0;

        return (
          <div
            key={m.id}
            className="match-card-premium"
            onClick={() => onSelect(m)}
          >
            {/* Thumbnail */}
            <div className="match-thumb">
              <img src={m.imageUrl || "/bt.jpg"} alt={m.title} />

              {/* Mode badge */}
              <div className="match-mode-badge">
                {m.mode || m.teamType || "Solo"}
              </div>
            </div>

            {/* Content */}
            <div className="match-body">
              <div className="match-title">{m.title}</div>

              <div className="match-sub">
                <span className="entry-pill">Entry: {m.entryFee}</span>
                <span className="players-pill">
                  {joinedCount}/{m.maxPlayers}
                </span>
              </div>

              <div className="match-meta-row">
                <div className="map-pill">
                  {m.autoRotate ? "Auto Map" : (m.map || "Map: TBD")}
                </div>

                <button
                  className="join-btn-premium"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoin(m);
                  }}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
