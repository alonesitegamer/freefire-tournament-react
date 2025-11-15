// src/components/HomeButtons.jsx
import React from "react";

/**
 * Minimal header buttons: Sound toggle (icon) only.
 * You can extend to add Top/Down in future.
 */
export default function HomeButtons({ onToggleSound = () => {} }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button className="music-btn" title="Toggle sound" onClick={onToggleSound}>
        {/* simple speaker icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M11 5L6 9H2v6h4l5 4V5z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
          <path d="M19 5a7 7 0 0 1 0 14" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
        </svg>
      </button>
    </div>
  );
}
