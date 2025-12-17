import React from "react";
import "./MatchList.css";

export default function MatchList({
  matches = [],
  onSelect = () => {},
  onJoin = () => {},
}) {
  return (
    <div className="minimal-match-grid">
      {matches.map((m) => {
        const banner =
          m.imageUrls && m.imageUrls.length > 0
            ? m.imageUrls[0] // FF1.jpeg
            : "/bt.jpg";     // safe fallback

        return (
          <div
            key={m.id}
            className="minimal-match-card"
            onClick={() => onSelect(m)}
          >
            {/* Banner */}
            <div className="minimal-banner-wrapper">
              <img
                src={banner}
                alt={m.title}
                className="minimal-banner"
              />
            </div>

            {/* Body */}
            <div className="minimal-match-body">
              <div className="minimal-title">{m.title}</div>

              <div className="minimal-meta">
                Entry: {m.entryFee ?? 0} •{" "}
                {m.playersJoined?.length || 0}/{m.maxPlayers}
              </div>

              <button
                className="minimal-join-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin(m);
                }}
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
