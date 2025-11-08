import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "./firebase"; // Removed appCheckInstance

// Removed getToken

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Splash from "./components/Splash";

// Private route component
function Private({ user, children }) {
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listens for user login changes
    const unsubscribeAuth = onIdTokenChanged(auth, (user) => {
      // This is now simple
      setUser(user);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribeAuth();
  }, []); // Only run this once

  // Show the splash screen while checking login
  if (loading) {
    return <Splash />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Private user={user}>
              <Dashboard user={user} />
            </Private>
          }
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />
        {/* Add your other public routes here */}
      </Routes>
    </BrowserRouter>
  );
}
