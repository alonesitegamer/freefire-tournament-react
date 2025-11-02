import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Splash from "./components/splash";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Show splash for 2.5s
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  if (showSplash) return <Splash />;
  if (!authReady) return <div className="center">Loading…</div>;

  return user ? <Dashboard user={user} /> : <Login />;
}
