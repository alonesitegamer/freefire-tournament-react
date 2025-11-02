import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// ✅ Global error catcher for debugging (especially in Eruda)
window.addEventListener("error", (e) => {
  console.error("💥 Uncaught Error:", e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("💥 Promise Rejection:", e.reason);
});

// ✅ Only render App — Router is already inside App.jsx
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
