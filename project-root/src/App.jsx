// In your App.jsx file

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Splash from "./components/Splash";
import MatchHistoryPage from "./pages/MatchHistoryPage";
import WithdrawalHistoryPage from "./pages/WithdrawalHistoryPage";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

// --- IMPORTS FOR NEW PAGES ---
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import About from "./pages/About";
import Footer from "./components/Footer";

// 1. IMPORT YOUR FINAL PAGE
import Contact from "./pages/Contact";

export default function App() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // ... (Your useEffect, error, and loading logic remains unchanged) ...

  React.useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Auth listener error:", err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  if (error) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "white",
          fontFamily: "monospace",
        }}
      >
        <h2>⚠️ App crashed</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (loading) return <Splash />;

  return (
    <>
      <Routes>
        {/* --- YOUR ORIGINAL AUTH-PROTECTED ROUTES --- */}
        <Route
          path="/"
          element={
            user ? (
              <Dashboard user={user} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/match-history"
          element={
            user ? <MatchHistoryPage /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/withdrawal-history"
          element={
            user ? <WithdrawalHistoryPage /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />

        {/* --- NEW PUBLIC ROUTES --- */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/about" element={<About />} />
        
        {/* 2. ADD THE FINAL ROUTE */}
        <Route path="/contact" element={<Contact />} />

        {/* --- Original catch-all route --- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      <Footer />
    </>
  );
}
