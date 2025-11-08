import React from "react";
import { motion } from "framer-motion";

export default function Splash() {
  return (
    <div style={styles.root}>
      {/* ✅ Background Video (safe fallback) */}
      <video
        style={styles.video}
        autoPlay
        loop
        muted
        playsInline
        onError={(e) => console.warn("⚠️ bg.mp4 not found or failed to load", e)}
      >
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      {/* ✅ Overlay */}
      <div style={styles.overlay} />

      {/* ✅ Animated Logo Section */}
      <motion.div
        style={styles.card}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <img
          src="/icon.jpg"
          alt="Imperial X Esports logo"
          style={styles.logo}
          onError={(e) => {
            e.currentTarget.src =
              "https://via.placeholder.com/120?text=Logo+Missing"; // fallback if missing
          }}
        />
        <h1 style={styles.title}>Imperial X Esports</h1>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p style={styles.subtitle}>Loading...</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

const styles = {
  root: {
    position: "relative",
    width: "100%",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
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
    backgroundColor: "rgba(0, 0, 0, 0.45)",
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
    objectFit: "cover",
    boxShadow: "0 0 20px rgba(255,255,255,0.3)",
  },
  title: {
    fontSize: "1.9rem",
    fontWeight: "600",
    letterSpacing: "1px",
    textShadow: "0 0 8px rgba(255,255,255,0.4)",
  },
  subtitle: {
    marginTop: "10px",
    fontSize: "1rem",
    opacity: 0.8,
  },
};
