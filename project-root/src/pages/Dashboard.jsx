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

  /** User Loader */
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

  /** Load Matches */
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

  /** Admin Requests */
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

  /** Update profile field */
  async function updateProfileField(patch) {
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, patch);
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
  }

  /** Add coins */
  async function addCoins(n = 1) {
    const ref = doc(db, "users", user.uid);
    const newCoins = (profile.coins || 0) + n;
    await updateDoc(ref, { coins: newCoins });
    setProfile(prev => ({ ...prev, coins: newCoins }));
  }

  /** Add XP */
  async function addXP(amount = 0) {
    const oldXp = profile.xp || 0;
    const newXp = oldXp + amount;

    const oldLevel = xpToLevel(oldXp);
    const newLevel = xpToLevel(newXp);

    await updateDoc(doc(db, "users", user.uid), { xp: newXp, level: newLevel });
    setProfile(prev => ({ ...prev, xp: newXp, level: newLevel }));

    if (newLevel > oldLevel) {
      setShowLevelUp({ from: oldLevel, to: newLevel });
    }
  }

  /** Claim daily */
  async function claimDaily() {
    const last = profile.lastDaily && profile.lastDaily.toDate
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
    alert("+1 coin added!");
  }

  /** Watch Ad */
  async function watchAd() {
    if (adLoading) return;
    if (adWatchToday >= 3) return alert("Daily limit reached (3)");

    setAdLoading(true);

    try {
      await new Promise(r => setTimeout(r, 1500)); // simulate
      await addCoins(2);
      await addXP(5);

      setAdWatchToday(c => c + 1);
      alert("+2 coins added!");
    } finally {
      setAdLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  /** Admin actions */
  async function approveRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "approved", processedAt: serverTimestamp() });

    if (type === "topup") {
      const uRef = doc(db, "users", req.userId);
      const snap = await getDoc(uRef);
      if (snap.exists()) {
        await updateDoc(uRef, {
          coins: (snap.data().coins || 0) + (req.coins || req.amount)
        });
      }
    }

    setRequests(prev => ({
      ...prev,
      [type]: prev[type].filter(i => i.id !== req.id)
    }));
  }

  async function rejectRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "rejected", processedAt: serverTimestamp() });

    setRequests(prev => ({
      ...prev,
      [type]: prev[type].filter(i => i.id !== req.id)
    }));
  }

  /** Loading Screen */
  if (loading || !profile) {
    return (
      <div className="loading-screen">Loading Dashboard...</div>
    );
  }

  return (
    <div className="dash-root">

      <audio ref={audioRef} src="/levelup.mp3" />

      {/* Background Video */}
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      {/* Header */}
      <header className="dash-header">
        <div className="logo-row">
          <img src="/icon.jpg" className="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">{profile.username || profile.displayName || profile.email}</div>
          </div>
        </div>

        <div className="header-actions">
          <HomeButtons />
          {profile.email === adminEmail && (
            <button className="btn small" onClick={()=>setActiveTab("admin")}>Admin Panel</button>
          )}
          <button className="btn small ghost" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="dash-main">

        {/* Coins ONLY (Rank removed) */}
        <section className="panel">
          <div className="muted">Coins</div>
          <div className="big coin-row">
            <img src="/coin.jpg" className="coin-icon" />
            <span className="coin-value">{profile.coins}</span>
          </div>
        </section>

        {/* HOME TAB */}
        {activeTab === "home" && (
          <>
            <section className="panel">
              <h3>Welcome back!</h3>
              <p>Check matches or top up to start playing.</p>

              <div className="flex-row gap">
                <button className="btn" onClick={claimDaily}>Claim Daily (+1)</button>
                <button className="btn ghost" disabled={adLoading} onClick={watchAd}>
                  {adLoading ? "Loading..." : `Watch Ad (+2) ${adWatchToday}/3`}
                </button>
              </div>
            </section>

            <section className="panel">
              <h3>Featured Matches</h3>
              <MatchList matches={matches} onSelect={(m)=>{ setSelectedMatch(m); setActiveTab("matches"); }} />
            </section>
          </>
        )}

        {/* MATCHES TAB */}
        {activeTab === "matches" && (
          selectedMatch
            ? <MatchDetails match={selectedMatch} onBack={()=>setSelectedMatch(null)} />
            : <section className="panel"><h3>Matches</h3><MatchList matches={matches} onSelect={(m)=>setSelectedMatch(m)} /></section>
        )}

        {/* TOPUP */}
        {activeTab === "topup" && (
          <TopupPage user={user} profile={profile} />
        )}

        {/* WITHDRAW */}
        {activeTab === "withdraw" && (
          <WithdrawPage profile={profile} />
        )}

        {/* ACCOUNT MENU */}
        {activeTab === "account" && (
          <AccountMenu
            profile={profile}
            setProfile={setProfile}
            addXP={addXP}
            updateProfileField={updateProfileField}
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
      <footer className="bottom-nav">
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
