import React from "react";
import { motion } from "framer-motion";

/*
  Splash screen – plays bg video behind and a centered logo animation.
*/
export default function Splash() {
  return (
    <div className="splash-root">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/media/bg.mp4" type="video/mp4" />
      </video>

      <div className="splash-overlay" />
      <motion.div
        className="splash-card"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9 }}
      >
        <img src="/media/icon.jpg" alt="logo" className="splash-logo" />
        <h1>Imperial X Esports</h1>
      </motion.div>
    </div>
  );
}
