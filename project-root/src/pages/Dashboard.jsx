import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";

/*
 Dashboard:
 - shows coins
 - daily login reward: +1 coin once per day
 - watch ad (placeholder) +1 coin
 - simple match grid
*/
export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const adminEmail = "esportsimperial50@gmail.com";

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        if (mounted) setProfile({ id: snap.id, ...snap.data() });
      } else {
        // create default
        await setDoc(ref, {
          email: user.email,
          coins: 0,
          displayName: user.displayName || "",
          lastDaily: null,
          createdAt: serverTimestamp()
        });
        const s2 = await getDoc(ref);
        if (mounted) setProfile({ id: s2.id, ...s2.data() });
      }
      setLoading(false);
    }
    load();
    return () => (mounted = false);
  }, [user.uid, user.email]);

  // helper to credit coin
  async function addCoin(n = 1) {
    if (!profile) return;
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, { coins: (profile.coins || 0) + n });
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
  }

  // daily reward check
  async function claimDaily() {
    if (!profile) return;
    const last = profile.lastDaily ? profile.lastDaily.toDate() : null;
    const now = new Date();
    const isSameDay = last && last.toDateString() === now.toDateString();
    if (isSameDay) {
      alert("You already claimed today's login coin.");
      return;
    }
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, { coins: (profile.coins || 0) + 1, lastDaily: serverTimestamp() });
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
    alert("+1 coin credited for daily login!");
  }

  async function watchAd() {
    // placeholder: in real integrate ads -> after completion give coin
    // For now immediate reward
    await addCoin(1);
    alert("+1 coin for watching the ad (demo)");
  }

  async function handleLogout() {
    await signOut(auth);
    window.location.reload();
  }

  if (loading || !profile) return <div className="center">Loading dashboard…</div>;

  return (
    <div className="dash-root">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/media/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      <header className="dash-header">
        <div className="logo-row">
          <img src="/media/icon.jpg" alt="logo" className="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">{profile.displayName || profile.email}</div>
          </div>
        </div>

        <div className="header-actions">
          {profile.email === adminEmail && (
            <button className="btn small" onClick={() => alert("Admin: coming soon")}>
              Admin
            </button>
          )}
          <button className="btn small ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dash-main">
        <section className="panel">
          <div className="panel-row">
            <div>
              <div className="muted">Coins</div>
              <div className="big">{profile.coins ?? 0} ₹</div>
            </div>
            <div>
              <button className="btn" onClick={claimDaily}>
                Claim Daily (1 coin)
              </button>
              <button className="btn ghost" onClick={watchAd}>
                Watch Ad (+1 coin)
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <h3>Featured Matches</h3>
          <div className="grid">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="match-card">
                <img src="/media/bt.jpg" alt="bt" />
                <div className="match-info">
                  <div className="match-title">Battle Royale #{i}</div>
                  <div className="match-meta">Start: 18:{10 + i} • Joined: {Math.floor(Math.random()*12)+1}/16</div>
                  <button className="btn" onClick={() => alert("Join flow will be implemented next phase")}>Join</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bottom-nav">
        <button className="nav-btn active">Home</button>
        <button className="nav-btn">Matches</button>
        <button className="nav-btn">Account</button>
      </footer>
    </div>
  );
}
