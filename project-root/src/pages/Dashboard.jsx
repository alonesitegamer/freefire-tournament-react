// src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import HomeButtons from "../components/HomeButtons";
import MatchList from "../components/MatchList";
import MatchDetails from "../components/MatchDetails";
import TopupPage from "../components/TopupPage";
import WithdrawPage from "../components/WithdrawPage";
import AccountMenu from "../components/AccountMenu";
import AdminPanel from "../components/AdminPanel";
import RankPage from "../components/RankPage";

export default function Dashboard({ user }) {

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });

  const [showLevelUp, setShowLevelUp] = useState(null);
  const [adWatchToday, setAdWatchToday] = useState(0);
  const [adLoading, setAdLoading] = useState(false);

  const navigate = useNavigate();
  const audioRef = useRef(null);

  const adminEmail = "esportsimperial50@gmail.com";

  /** XP Curve */
  const XP_LEVELS = [
    100,200,350,500,700,900,1200,1500,1900,2300,
    2800,3400,4000,4700,5500,6300,7200,9999999
  ];

  function xpToLevel(xp = 0) {
    for (let i = 0; i < XP_LEVELS.length; i++) {
      if (xp < XP_LEVELS[i]) return i + 1;
    }
    return XP_LEVELS.length;
  }

  /** Load user profile */
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();

          const safe = {
            coins: data.coins ?? 0,
            xp: data.xp ?? 0,
            level: data.level ?? xpToLevel(data.xp ?? 0),
            username: data.username ?? "",
            displayName: data.displayName ?? "",
            referralCode: data.referralCode ?? user.uid.substring(0,8).toUpperCase(),
            lastDaily: data.lastDaily ?? null,
            ...data
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
            lastDaily: null,
            createdAt: serverTimestamp(),
          };

          await setDoc(ref, initial);
          if (mounted) setProfile({ id: ref.id, ...initial });
        }

      } catch (err) {
        console.error("Profile load error", err);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => (mounted = false);

  }, [user.uid, user.email, user.displayName]);

  /** Load matches */
  useEffect(() => {
    if (activeTab !== "matches") return;
    let mounted = true;

    (async () => {
      try {
        const qRef = query(
          collection(db, "matches"),
          where("status", "==", "upcoming"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(qRef);
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (mounted) setMatches(arr);
      } catch (err) {
        console.error("Load matches error:", err);
      }
    })();

    return () => (mounted = false);

  }, [activeTab]);

  /** Load admin requests */
  useEffect(() => {
    if (profile?.email !== adminEmail) return;

    (async () => {
      try {
        const top = await getDocs(query(collection(db, "topupRequests"), where("status","==","pending")));
        const wd = await getDocs(query(collection(db, "withdrawRequests"), where("status","==","pending")));

        setRequests({
          topup: top.docs.map(d => ({ id: d.id, ...d.data() })),
          withdraw: wd.docs.map(d => ({ id: d.id, ...d.data() })),
        });

      } catch (err) {
        console.error("Admin load error", err);
      }
    })();

  }, [profile]);

  /** Update user field */
  async function updateProfileField(patch) {
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, patch);
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
  }

  /** Add coins */
  async function addCoins(n = 1) {
    const newCoins = (profile.coins || 0) + n;
    await updateDoc(doc(db, "users", user.uid), { coins: newCoins });
    setProfile(prev => ({ ...prev, coins: newCoins }));
  }

  /** Add XP */
  async function addXP(amount = 0) {
    const newXp = (profile.xp || 0) + amount;
    const oldLevel = xpToLevel(profile.xp || 0);
    const newLevel = xpToLevel(newXp);

    await updateDoc(doc(db, "users", user.uid), { xp: newXp, level: newLevel });

    setProfile(prev => ({ ...prev, xp: newXp, level: newLevel }));

    if (newLevel > oldLevel) {
      setShowLevelUp({ from: oldLevel, to: newLevel });
      if (audioRef.current) audioRef.current.play();
    }
  }

  /** Daily reward */
  async function claimDaily() {
    const last = profile.lastDaily?.toDate
      ? profile.lastDaily.toDate()
      : profile.lastDaily ? new Date(profile.lastDaily) : null;

    const now = new Date();
    if (last && last.toDateString() === now.toDateString()) {
      return alert("Already claimed today.");
    }

    await updateDoc(doc(db, "users", user.uid), {
      coins: (profile.coins || 0) + 1,
      lastDaily: serverTimestamp(),
    });

    await addXP(10);
    alert("+1 coin!");
  }

  /** Watch rewarded ad */
  async function watchAd() {
    if (adLoading) return;
    if (adWatchToday >= 3) return alert("Ad limit reached.");

    setAdLoading(true);

    try {
      await new Promise(r => setTimeout(r, 1500));
      await addCoins(2);
      await addXP(5);
      setAdWatchToday(c => c + 1);
      alert("+2 coins!");
    } finally {
      setAdLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  /** Loading */
  if (loading || !profile) {
    return (
      <div className="loading-screen">Loading Dashboard...</div>
    );
  }

  return (
    <div className="dash-root">

      <audio ref={audioRef} src="/levelup.mp3" />

      {/* Background */}
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      {/* Header */}
      <header className="dash-header glow-header">
        <div className="logo-row">
          <img src="/icon.jpg" className="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">{profile.username || profile.displayName || profile.email}</div>
          </div>
        </div>

        <div className="header-actions-fixed">
          <HomeButtons />
          {profile.email === adminEmail && (
            <button className="btn small" onClick={()=>setActiveTab("admin")}>Admin</button>
          )}
          <button className="btn small ghost" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Main */}
      <main className="dash-main">

        {/* Coins panel */}
        <section className="panel glow-panel">
          <div className="muted">Coins</div>
          <div className="big coin-row">
            <img src="/coin.jpg" className="coin-icon-fixed" />
            <span className="coin-value">{profile.coins}</span>
          </div>
        </section>

        {/* HOME TAB */}
        {activeTab === "home" && (
          <>
            <section className="panel glow-panel">
              <h3>Welcome back!</h3>
              <p>Check matches or top up to start playing.</p>

              <div className="home-top-buttons">
                <button className="btn glow" onClick={claimDaily}>Daily Reward +1</button>
                <button className="btn ghost glow" disabled={adLoading} onClick={watchAd}>
                  {adLoading ? "Loading..." : `Watch Ad +2 (${adWatchToday}/3)`}
                </button>
              </div>
            </section>

            <section className="panel glow-panel">
              <h3>Featured Matches</h3>
              <MatchList matches={matches} onSelect={(m)=>{ setSelectedMatch(m); setActiveTab("matches"); }} />
            </section>
          </>
        )}

        {/* MATCHES */}
        {activeTab === "matches" && (
          selectedMatch
            ? <MatchDetails match={selectedMatch} onBack={()=>setSelectedMatch(null)} />
            : <section className="panel glow-panel"><h3>Matches</h3><MatchList matches={matches} onSelect={(m)=>setSelectedMatch(m)} /></section>
        )}

        {/* TOPUP */}
        {activeTab === "topup" && (
          <TopupPage user={user} profile={profile} />
        )}

        {/* WITHDRAW */}
        {activeTab === "withdraw" && (
          <WithdrawPage profile={profile} />
        )}

        {/* ACCOUNT */}
        {activeTab === "account" && (
          <AccountMenu
            profile={profile}
            setProfile={setProfile}
            updateProfileField={updateProfileField}
            addXP={addXP}
            onRankClick={() => setActiveTab("rank")}
          />
        )}

        {/* RANK PAGE */}
        {activeTab === "rank" && (
          <RankPage
            profile={profile}
            onBack={() => setActiveTab("account")}
          />
        )}

        {/* ADMIN */}
        {activeTab === "admin" && profile.email === adminEmail && (
          <AdminPanel
            requests={requests}
            approveRequest={approveRequest}
            rejectRequest={rejectRequest}
            matches={matches}
          />
        )}

      </main>

      {/* Bottom Nav */}
      <footer className="bottom-nav glow-nav">
        {["home","matches","topup","withdraw","account"].map(tab => (
          <button
            key={tab}
            className={`nav-btn ${activeTab===tab ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab);
              setSelectedMatch(null);
            }}
          >
            {tab.charAt(0).toUpperCase()+tab.slice(1)}
          </button>
        ))}
      </footer>

    </div>
  );
}
