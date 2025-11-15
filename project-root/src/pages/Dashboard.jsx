// src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { auth, db, appCheckInstance } from "../firebase";
import { signOut, updateProfile } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  arrayUnion,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import RankBadge from "../components/RankBadge";
import XPBar from "../components/XPBar";
import LevelUpPopup from "../components/LevelUpPopup";
import HomeButtons from "../components/HomeButtons";
import MatchList from "../components/MatchList";
import MatchDetails from "../components/MatchDetails";
import TopupPage from "../components/TopupPage";
import WithdrawPage from "../components/WithdrawPage";
import AccountMenu from "../components/AccountMenu";
import AdminPanel from "../components/AdminPanel";
import UserStatsBox from "../components/UserStatsBox";

import { getToken } from "firebase/app-check";

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });
  const [showLevelUp, setShowLevelUp] = useState(null); // {fromLevel,toLevel}
  const [xpChangeQueue, setXpChangeQueue] = useState([]); // queue of xp increments for animation
  const [adLoading, setAdLoading] = useState(false);
  const [adWatchToday, setAdWatchToday] = useState(0); // limit 3 per day (you asked 3)
  const audioRef = useRef(null);
  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";

  // XP curve (increasing)
  const XP_LEVELS = [
    100,200,350,500,700,900,1200,1500,1900,2300,2800,3400,4000,4700,5500,6300,7200,9999999
  ]; // 18 levels (last is heroic cap)

  // get current level from xp
  function xpToLevel(xp = 0) {
    for (let i = 0; i < XP_LEVELS.length; i++) {
      if (xp < XP_LEVELS[i]) return i + 1; // level number (1-based)
    }
    return XP_LEVELS.length;
  }

  // get xp required for next level
  function xpForLevel(level) {
    return XP_LEVELS[Math.max(0, Math.min(XP_LEVELS.length - 1, level - 1))];
  }

  // bootstrap profile document
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          // ensure fields exist
          const safe = {
            coins: data.coins ?? 0,
            xp: data.xp ?? 0,
            level: data.level ?? xpToLevel(data.xp ?? 0),
            referralCode: data.referralCode ?? user.uid.substring(0,8).toUpperCase(),
            hasRedeemedReferral: data.hasRedeemedReferral ?? false,
            ...data,
          };
          if (!data.referralCode) {
            await updateDoc(ref, { referralCode: safe.referralCode });
          }
          if (mounted) setProfile({ id: snap.id, ...safe });
        } else {
          const initial = {
            email: user.email,
            coins: 0,
            xp: 0,
            level: 1,
            displayName: user.displayName || "",
            username: "",
            referralCode: user.uid.substring(0,8).toUpperCase(),
            hasRedeemedReferral: false,
            lastDaily: null,
            createdAt: serverTimestamp(),
          };
          await setDoc(ref, initial);
          if (mounted) setProfile({ id: ref.id, ...initial });
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [user.uid, user.email, user.displayName]);

  // load matches for matches tab
  useEffect(() => {
    if (activeTab !== "matches") return;
    let mounted = true;
    (async () => {
      try {
        const matchesRef = collection(db, "matches");
        const q = query(matchesRef, where("status", "==", "upcoming"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (mounted) setMatches(arr);
      } catch (err) {
        console.error("Load matches error:", err);
      }
    })();
    return () => (mounted = false);
  }, [activeTab]);

  // admin fetch pending requests
  useEffect(() => {
    if (profile?.email !== adminEmail) return;
    (async () => {
      try {
        const topupSnap = await getDocs(query(collection(db, "topupRequests"), where("status","==","pending")));
        const withdrawSnap = await getDocs(query(collection(db, "withdrawRequests"), where("status","==","pending")));
        setRequests({
          topup: topupSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          withdraw: withdrawSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        });
      } catch (err) {
        console.error("Admin load error:", err);
      }
    })();
  }, [profile?.email]);

  // wrapper to safely update profile locally + firestore (coins/xp/level)
  async function updateProfileField(patch) {
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, patch);
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
  }

  // add coins helper
  async function addCoins(n = 1) {
    if (!profile) return;
    const newCoins = (profile.coins || 0) + n;
    await updateDoc(doc(db, "users", user.uid), { coins: newCoins });
    setProfile(prev => ({ ...prev, coins: newCoins }));
  }

  // add xp helper: handles leveling logic and animation queue
  async function addXP(amount = 0) {
    if (!profile) return;
    const oldXp = profile.xp || 0;
    const newXp = oldXp + amount;
    const oldLevel = xpToLevel(oldXp);
    const newLevel = xpToLevel(newXp);
    await updateDoc(doc(db, "users", user.uid), { xp: newXp, level: newLevel });
    setProfile(prev => ({ ...prev, xp: newXp, level: newLevel }));
    // queue xp change for UI (animation)
    setXpChangeQueue(q => [...q, amount]);
    if (newLevel > oldLevel) {
      setShowLevelUp({ from: oldLevel, to: newLevel });
    }
  }

  // Claim daily coin — you asked daily coin = 1
  async function claimDaily() {
    if (!profile) return;
    const last = profile.lastDaily && typeof profile.lastDaily.toDate === "function" ? profile.lastDaily.toDate() : profile.lastDaily ? new Date(profile.lastDaily) : null;
    const now = new Date();
    if (last && last.toDateString() === now.toDateString()) {
      return alert("You already claimed today's reward.");
    }
    await updateDoc(doc(db, "users", user.uid), {
      coins: (profile.coins || 0) + 1,
      lastDaily: serverTimestamp(),
    });
    await addXP(10); // daily xp +10
    const snap = await getDoc(doc(db, "users", user.uid));
    setProfile({ id: snap.id, ...snap.data() });
    setTimeout(() => setShowLevelUp(null), 4000);
    alert("+1 coin credited!");
  }

  // Watch ad — coin reward changed to 2
  async function watchAd() {
    if (adLoading) return;
    if (adWatchToday >= 3) {
      return alert("You have reached the daily ad limit (3).");
    }
    // Demo ad behavior — this will integrate with ad provider client-side if you add it
    setAdLoading(true);
    try {
      // simulate ad watch
      await new Promise(r => setTimeout(r, 1500));
      await addCoins(2); // 2 coins per ad (you asked 3->2)
      await addXP(5); // xp for watching ad
      setAdWatchToday(c => c + 1);
      alert("+2 coins for watching ad (demo).");
    } catch (err) {
      console.error("watchAd error", err);
      alert("Ad failed.");
    } finally {
      setAdLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  // Admin approve/reject (same logic as earlier but safe)
  async function approveRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "approved", processedAt: serverTimestamp() });
    if (type === "topup") {
      // credit user coins by req.coins
      const userRef = doc(db, "users", req.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const ucoins = userSnap.data().coins || 0;
        await updateDoc(userRef, { coins: ucoins + (req.coins || req.amount || 0) });
      }
    }
    setRequests(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== req.id) }));
  }

  async function rejectRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "rejected", processedAt: serverTimestamp() });
    setRequests(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== req.id) }));
  }

  if (loading || !profile) {
    return (
      <div style={{height: "100vh", display:"flex", justifyContent:"center", alignItems:"center", color:"#fff", background:"#000"}}>
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="dash-root">
      <audio ref={audioRef} src="/levelup.mp3" />
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      <header className="dash-header">
        <div className="logo-row">
          <img src="/icon.jpg" alt="logo" className="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">{profile.username || profile.displayName || profile.email}</div>
          </div>
        </div>

        <div className="header-actions">
          <HomeButtons onToggleSound={() => {
            if (audioRef.current) {
              if (audioRef.current.paused) audioRef.current.play();
              else audioRef.current.pause();
            }
          }} />
          {profile.email === adminEmail && (
            <button className="btn small" onClick={() => setActiveTab("admin")}>Admin Panel</button>
          )}
          <button className="btn small ghost" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="dash-main">
        <section className="panel panel-row" style={{alignItems: "flex-start"}}>
          <div style={{flex:1}}>
            <div className="muted">Coins</div>
            <div className="big coin-row" style={{alignItems:"center", display:"flex", gap:8}}>
              <img src="/coin.jpg" alt="coin" className="coin-icon" style={{width:32,height:32,animation:"spinCoin 3s linear infinite"}} />
              <span style={{fontSize:26,fontWeight:800}}>{profile.coins ?? 0}</span>
            </div>
          </div>

          <div style={{width:320, marginLeft:16}}>
            <UserStatsBox profile={profile} xpToLevel={xpToLevel} xpForLevel={xpForLevel} />
            <XPBar xp={profile.xp || 0} level={profile.level || 1} xpForLevel={xpForLevel} />
          </div>
        </section>

        {activeTab === "home" && (
          <>
            <section className="panel">
              <h3>Welcome back!</h3>
              <p>Check matches or top up to start playing.</p>
              <div style={{display:"flex", gap:8, marginTop:12}}>
                <button className="btn" onClick={claimDaily}>Claim Daily (+1 coin)</button>
                <button className="btn ghost" onClick={watchAd} disabled={adLoading}>
                  {adLoading ? "Loading Ad..." : `Watch Ad (+2) ${adWatchToday}/3`}
                </button>
              </div>
            </section>

            <section className="panel">
              <h3>Featured Matches</h3>
              <MatchList matches={matches} onSelect={(m)=>{ setSelectedMatch(m); setActiveTab("matches") }} onJoin={async (m) => {/* wrapper if needed */}} />
            </section>
          </>
        )}

        {activeTab === "matches" && (
          selectedMatch ? <MatchDetails match={selectedMatch} onBack={()=>setSelectedMatch(null)} onJoin={async (m) => { /* join handled inside MatchDetails */ }} /> :
            <section className="panel"><h3>Matches</h3><MatchList matches={matches} onSelect={(m)=>setSelectedMatch(m)} /></section>
        )}

        {activeTab === "topup" && (
          <TopupPage user={user} profile={profile} onSubmitted={() => { /* refresh requests */ }} />
        )}

        {activeTab === "withdraw" && (
          <WithdrawPage profile={profile} onRequested={() => { /* refresh */ }} />
        )}

        {activeTab === "account" && (
          <AccountMenu profile={profile} setProfile={setProfile} addXP={addXP} updateProfileField={updateProfileField} />
        )}

        {activeTab === "admin" && profile.email === adminEmail && (
          <AdminPanel requests={requests} approveRequest={approveRequest} rejectRequest={rejectRequest} matches={matches} createMatch={() => {}} />
        )}
      </main>

      <footer className="bottom-nav">
        {["home","matches","topup","withdraw","account"].map(tab => (
          <button key={tab} className={`nav-btn ${activeTab===tab ? "active":""}`} onClick={()=>{
            setActiveTab(tab);
            setSelectedMatch(null);
          }}>
            {tab.charAt(0).toUpperCase()+tab.slice(1)}
          </button>
        ))}
      </footer>

      {showLevelUp && (
        <LevelUpPopup from={showLevelUp.from} to={showLevelUp.to} onClose={()=>setShowLevelUp(null)} />
      )}

    </div>
  );
}
