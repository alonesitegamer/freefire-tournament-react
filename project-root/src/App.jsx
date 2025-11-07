import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onIdTokenChanged } from "firebase/auth";
import { auth, appCheckInstance } from "./firebase"; // Import appCheckInstance
import { getToken } from "firebase/app-check"; // Import getToken

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
    const unsubscribeAuth = onIdTokenChanged(auth, async (user) => {
      if (user) {
        // User is logged in.
        // NOW, we must wait for the App Check token.
        try {
          console.log("User found, waiting for App Check token...");
          // Wait for the token to be ready
          await getToken(appCheckInstance, false);
          console.log("App Check token is ready!");
          // Once we have the token, set the user
          setUser(user);
        } catch (err) {
          console.error("App Check error, logging out:", err);
          // If App Check fails, we can't let them in
          setUser(null);
        } finally {
          // We only stop loading *after* the check is done.
          setLoading(false);
        }
      } else {
        // User is logged out
        setUser(null);
        // Stop loading
        setLoading(false);
      }
    });

    // Cleanup listener on unmount
    return () => unsubscribeAuth();
  }, []); // Only run this once

  // Show the splash screen while checking login & App Check
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
