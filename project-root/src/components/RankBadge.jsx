// src/components/RankBadge.jsx
import React from "react";

/**
 * This version loads images directly from /public/
 * Example: /bronze1.jpg, /silver2.png etc.
 */

export default function RankBadge({ level = 1, size = 96 }) {
  const mapping = [
    "bronze1.png",   // Level 1
    "bronze2.png",   // 2
    "bronze3.png",   // 3
    "silver1.png",   // 4
    "silver2.png",   // 5
    "silver3.png",   // 6
    "gold1.png",     // 7
    "gold2.png",     // 8
    "gold3.png",     // 9
    "gold4.png",     // 10
    "platinum1.png", // 11
    "platinum2.png", // 12
    "platinum3.png", // 13
    "platinum4.png", // 14
    "diamond1.png",  // 15
    "diamond2.png",  // 16
    "diamond3.png",  // 17
    "heroic.png"     // 18
  ];

  const index = Math.max(0, Math.min(mapping.length - 1, level - 1));

  const src = `/${mapping[index]}`; // ← Loads directly from /public/
  
  const fallback = "/fallback-badge.png"; // Put 1 small fallback image in public/

  return (
    <div
      className="rank-badge"
      style={{
        width: size,
        height: size,
        position: "relative"
      }}
    >
      <img
        src={src}
        onError={(e) => {
          e.currentTarget.src = fallback;
        }}
        alt="Rank Badge"
        className="rank-badge-img"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain"
        }}
      />
    </div>
  );
}
