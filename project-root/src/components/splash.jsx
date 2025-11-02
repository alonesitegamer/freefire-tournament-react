import React from "react";
import { motion } from "framer-motion";

/*
  Splash screen – plays bg video behind and a centered logo animation.
*/
export default function Splash() {
  return (
    <div className="splash-root" style={styles.root}>
      {/* Background Video */}
      <video
        className="bg-video"
        autoPlay
        loop
        muted
        playsInline
        style={styles.video}
      >
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div className="splash-overlay" style={styles.overlay} />

      {/* Animated Logo Section */}
      <motion.div
        className="splash-card"
        style={styles.card}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9 }}
      >
        <img
          src="/icon.jpg"
          alt="logo"
          className="splash-logo"
          style={styles.logo}
        />
        <h1 style={styles.title}>Imperial X Esports</h1>
      </motion.div>
    </div>
  );
}

/* Inline fallback styles (in case your CSS isn’t loading) */
const styles = {
  root: {
    position: "relative",
    width: "100%",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  video: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    zIndex: 0,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 1,
  },
  card: {
    position: "relative",
    zIndex: 2,
    textAlign: "center",
    color: "white",
  },
  logo: {
    width: "120px",
    height: "120px",
    borderRadius: "50%",
    marginBottom: "20px",
  },
  title: {
    fontSize: "1.8rem",
    fontWeight: "600",
    letterSpacing: "1px",
  },
};
