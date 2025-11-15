// src/components/RankBadge.jsx
import React from "react";

/**
 * RankBadge renders the badge image for a specific level (1..18)
 * Expects images in /public/ named exactly as:
 * bronze1.jpg, bronze2.jpg, bronze3.jpg,
 * silver1.jpg, silver2.jpg, silver3.jpg,
 * gold1.jpg, gold2.jpg, gold3.jpg, gold4.jpg,
 * platinum1.jpg, platinum2.jpg, platinum3.jpg, platinum4.jpg,
 * diamond1.jpg,diamond2.jpg,diamond3.jpg,diamond4.jpg,
 * heroic.jpg
 */

const LEVEL_MAP = [
  "bronze1.jpg","bronze2.jpg","bronze3.jpg",
  "silver1.jpg","silver2.jpg","silver3.jpg",
  "gold1.jpg","gold2.jpg","gold3.jpg","gold4.jpg",
  "platinum1.jpg","platinum2.jpg","platinum3.jpg","platinum4.jpg",
  "diamond1.jpg","diamond2.jpg","diamond3.jpg","diamond4.jpg",
  "heroic.jpg"
];

export default function RankBadge({ level = 1, size = 64, className = "" }) {
  const idx = Math.max(0, Math.min(LEVEL_MAP.length - 1, level - 1));
  const src = `/${LEVEL_MAP[idx]}`;
  return (
    <div className={`rank-badge ${className}`} style={{width:size,height:size}}>
      <img src={src} alt={`level-${level}`} style={{width:"100%",height:"100%",objectFit:"contain"}} />
    </div>
  );
}
