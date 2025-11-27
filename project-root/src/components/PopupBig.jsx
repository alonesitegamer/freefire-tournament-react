// src/components/PopupBig.jsx
import React from "react";
import "../styles/popupbig.css";

export default function PopupBig({ open = false, type = "success", title = "", message = "" }) {
  if (!open) return null;
  return (
    <div className="popupbig-overlay">
      <div className={`popupbig-card popupbig-${type}`}>
        <div className="popupbig-left">
          <div className="popupbig-icon">
            {type === "success" && <span className="coin">🪙</span>}
            {type === "error" && <span className="err">✕</span>}
            {type === "warning" && <span className="warn">!</span>}
          </div>
        </div>

        <div className="popupbig-right">
          <div className="popupbig-title">{title}</div>
          <div className="popupbig-msg">{message}</div>
        </div>
      </div>
    </div>
  );
}
