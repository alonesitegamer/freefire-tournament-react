import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Splash from "./components/Splash";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // simple splash timeout -> 2.5s then show login
    const t = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  if (showSplash) return <Splash />;
  if (!authReady) return <div className="center">Loading…</div>;

  return user ? <Dashboard user={user} /> : <Login />;
}
