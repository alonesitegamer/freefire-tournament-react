import React, { useEffect } from "react";
import "./Popup.css";

export default function Popup({ type = "success", message = "", onClose = () => {} }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="popup-overlay">
      <div className={`popup-box popup-${type}`}>
        <div className="popup-icon">
          {type === "success" && "✓"}
          {type === "error" && "✕"}
          {type === "warning" && "!"}
        </div>
        <div className="popup-message">{message}</div>
      </div>
    </div>
  );
}
