import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom"; // ✅ removed BrowserRouter
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "./firebase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Splash from "./components/Splash";

function Private({ user, children }) {
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onIdTokenChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  if (loading) return <Splash />;

  return (
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
    </Routes>
  );
}
