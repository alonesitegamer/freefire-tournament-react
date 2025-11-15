// src/components/LevelUpPopup.jsx
import React, { useEffect } from "react";
import RankBadge from "./RankBadge";

export default function LevelUpPopup({ from, to, onClose }) {
  useEffect(() => {
    const t = setTimeout(() => onClose && onClose(), 3600);
    return () => clearTimeout(t);
  }, [onClose]);

  useEffect(() => {
    // try to play sound if available
    const audio = document.querySelector('audio');
    try { audio && audio.play(); } catch(e){}
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-content modern-card levelup-card" onClick={() => onClose && onClose()}>
        <div className="levelup-body">
          <div className="levelup-badges">
            <div className="old">
              <RankBadge level={from} size={84} />
              <div className="caption">Lv {from}</div>
            </div>
            <div className="lvlup-glow">LEVEL UP!</div>
            <div className="new">
              <RankBadge level={to} size={120} />
              <div className="caption">Lv {to}</div>
            </div>
          </div>
          <p className="modern-subtitle" style={{textAlign:"center", marginTop:12}}>Congratulations! You reached level {to}.</p>
        </div>
      </div>
    </div>
  );
}
