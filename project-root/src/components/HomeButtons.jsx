// src/components/HomeButtons.jsx
import React from "react";

/** simple component with two glowing buttons (side-by-side) */
export default function HomeButtons({ onToggleSound }) {
  return (
    <div style={{display:"flex", gap:8, alignItems:"center"}}>
      <button className="btn small glow" onClick={() => window.scrollTo({top:0, behavior:"smooth"})}>Top</button>
      <button className="btn small glow" onClick={() => window.scrollTo({top:document.body.scrollHeight, behavior:"smooth"})}>Down</button>
      <button className="btn small ghost" onClick={onToggleSound}>Sound</button>
    </div>
  );
}
