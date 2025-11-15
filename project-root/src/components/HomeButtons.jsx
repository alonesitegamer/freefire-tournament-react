// src/components/HomeButtons.jsx
import React, { useState } from "react";

export default function HomeButtons({ onToggleSound = () => {} }) {
  const [sound, setSound] = useState(true);

  function toggle() {
    setSound(!sound);
    onToggleSound();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      {/* SOUND TOGGLE BUTTON (round) */}
      <button
        onClick={toggle}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backdropFilter: "blur(6px)"
        }}
      >
        {sound ? (
          <span style={{ fontSize: 18 }}>🔊</span>
        ) : (
          <span style={{ fontSize: 18 }}>🔇</span>
        )}
      </button>
    </div>
  );
}
