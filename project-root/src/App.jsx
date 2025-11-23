import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "./firebase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Splash from "./components/Splash";

// ✅ Add these
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermOfService from "./components/TermOfService";
import Contact from "./components/Contact";

function Private({ user, children }) {
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(!auth.currentUser);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <Splash />;
  }

  return (
    <Routes>
      {/* Dashboard (Protected) */}
      <Route
        path="/"
        element={
          <Private user={user}>
            <Dashboard user={user} />
          </Private>
        }
      />

      {/* Login */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      {/* 📄 PUBLIC PAGES */}
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermOfService />} />
      <Route path="/contact" element={<Contact />} />
    </Routes>
  );
}
