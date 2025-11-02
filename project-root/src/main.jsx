import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import "./styles.css";

window.onerror = (msg, src, line, col, err) => {
  document.body.innerHTML = `
    <div style="background:black;color:white;padding:1rem;font-family:monospace">
      <h3>🔥 JS Error</h3>
      <pre>${msg}</pre>
      <pre>${src}:${line}:${col}</pre>
      <pre>${err ? err.stack : ""}</pre>
    </div>`;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
