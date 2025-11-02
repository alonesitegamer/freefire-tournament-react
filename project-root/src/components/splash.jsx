import React from "react";
import { motion } from "framer-motion";

export default function Splash() {
  return (
    <div style={styles.root}>
      {/* Background Video */}
      <video
        style={styles.video}
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div style={styles.overlay}></div>

      {/* Animated Logo Section */}
      <motion.div
        style={styles.card}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9 }}
      >
        <img src="/icon.jpg" alt="logo" style={styles.logo} />
        <h1 style={styles.title}>Imperial X Esports</h1>
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
