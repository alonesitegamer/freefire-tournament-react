import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Splash from "./components/Splash";
import MatchHistoryPage from "./pages/MatchHistoryPage"; // NEW IMPORT
import WithdrawalHistoryPage from "./pages/WithdrawalHistoryPage"; // NEW IMPORT
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

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

  // Error display
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

  // Loading state
  if (loading) return <Splash />;

  // Routing (no nested BrowserRouter!)
  return (
    <Routes>
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
      {/* NEW ROUTES FOR HISTORY PAGES (Require Authentication) */}
      <Route
        path="/match-history" 
        element={user ? <MatchHistoryPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/withdrawal-history" 
        element={user ? <WithdrawalHistoryPage /> : <Navigate to="/login" replace />}
      />
      {/* END NEW ROUTES */}
      
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
