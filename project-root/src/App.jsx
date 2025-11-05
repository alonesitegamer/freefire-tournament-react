import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Splash from "./components/Splash";
import MatchHistoryPage from "./pages/MatchHistoryPage";
import WithdrawalHistoryPage from "./pages/WithdrawalHistoryPage";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

// --- 1. IMPORTS FOR NEW PAGES (Corrected Paths) ---
import PrivacyPolicy from "./components/PrivacyPolicy.js"; // Fixed path
import TermsOfService from "./components/TermOfService.jsx"; // Fixed path & name
import About from "./components/About.jsx"; // Fixed path
import Contact from "./components/Contact.jsx"; // Fixed path
import Footer from "./components/Footer.jsx";

export default function App() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

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

  // Error display (Original code, unchanged)
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

  // Loading state (Original code, unchanged)
  if (loading) return <Splash />;

  // We use a fragment <>...</> so the Footer can be outside the Routes
  return (
    <>
      <Routes>
        {/* --- YOUR ORIGINAL AUTH-PROTECTED ROUTES (Unchanged) --- */}
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

        {/* --- 3. NEW PUBLIC ROUTES (Paths are unchanged) --- */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />

        {/* Original catch-all route (Unchanged) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* The Footer will now appear on every page */}
      <Footer />
    </>
  );
        }
