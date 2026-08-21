import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "./firebase";

import Login from "./pages/LoginServer";
import Dashboard from "./pages/DashboardServer";
import Splash from "./components/Splash";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermOfService from "./components/TermOfService";
import Contact from "./components/Contact";

function Private({ user, children }) {
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(!auth.currentUser);

  useEffect(() => onIdTokenChanged(auth, (firebaseUser) => {
    setUser(firebaseUser);
    setLoading(false);
  }), []);

  if (loading) return <Splash />;

  return (
    <Routes>
      <Route path="/" element={<Private user={user}><Dashboard user={user} /></Private>} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermOfService />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}
