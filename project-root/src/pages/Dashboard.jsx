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
  orderBy,
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
import LevelUpPopup from "../components/LevelUpPopup";

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

  // Avatar modal
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarSelecting, setAvatarSelecting] = useState(false);

  const audioRef = useRef(null);
  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";

  // XP levels
  const XP_LEVELS = [
    100, 200, 350, 500, 700, 900,
    1200, 1500, 1900, 2300, 2800,
    3400, 4000, 4700, 5500, 6300,
    7200, 9999999,
  ];

  function xpToLevel(xp = 0) {
    for (let i = 0; i < XP_LEVELS.length; i++) {
      if (xp < XP_LEVELS[i]) return i + 1;
    }
    return XP_LEVELS.length;
  }

  // Avatars from public/avatars
  const AVATARS = [
    "angelic.jpg","authentic.jpg","brain.jpg","chicken.jpg","crown.jpg",
    "cyberpunk.jpg","default.jpg","dragon.jpg","flame-falco.jpg",
    "flower-wind.jpg","flower.jpg","free.jpg","freefire.jpg","ghost-mask.jpg",
    "ghost.jpg","girl.jpg","helm.jpg","panda.jpg","pink-glow.jpg","purple.jpg",
    "radiation.jpg","season7.jpg","season8.jpg","season9.jpg","star.jpg",
    "unknown.jpg","water.jpg"
  ];

  // ---------- Load Profile ----------
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
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
            referralCode: data.referralCode ?? user.uid.substring(0, 8).toUpperCase(),
            lastDaily: data.lastDaily ?? null,
            avatar: data.avatar ?? "/avatars/default.jpg",
            wins: data.wins ?? 0,
            played: data.played ?? 0,
            ...data,
          };

          // ensure referralCode saved
          if (!data.referralCode)
            await updateDoc(ref, { referralCode: safe.referralCode });

          // ensure avatar saved
          if (!data.avatar)
            await updateDoc(ref, { avatar: safe.avatar });

          if (mounted) setProfile({ id: snap.id, ...safe });
        } else {
          const initial = {
            email: user.email,
            coins: 0,
            xp: 0,
            level: 1,
            username: "",
            displayName: user.displayName || "",
            referralCode: user.uid.substring(0, 8).toUpperCase(),
            lastDaily: null,
            avatar: "/avatars/default.jpg",
            createdAt: serverTimestamp()
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

  // ---------- Load Matches Only When Tab Active ----------
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

  // ---------- Load Admin Requests ----------
  useEffect(() => {
    if (profile?.email !== adminEmail) return;

    (async () => {
      try {
        const top = await getDocs(
          query(collection(db, "topupRequests"), where("status", "==", "pending"))
        );
        const wd = await getDocs(
          query(collection(db, "withdrawRequests"), where("status", "==", "pending"))
        );

        setRequests({
          topup: top.docs.map(d => ({ id: d.id, ...d.data() })),
          withdraw: wd.docs.map(d => ({ id: d.id, ...d.data() })),
        });
      } catch (err) {
        console.error("Admin load error", err);
      }
    })();
  }, [profile]);

  // ---------- Update Profile ----------
  async function updateProfileField(patch) {
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, patch);
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
  }

  // ---------- XP / Coins ----------
  async function addCoins(amount = 1) {
    if (!profile) return;
    const newCoins = (profile.coins || 0) + amount;
    await updateDoc(doc(db, "users", user.uid), { coins: newCoins });
    setProfile(prev => ({ ...prev, coins: newCoins }));
  }

  async function addXP(amount = 0) {
    if (!profile) return;

    const oldXp = profile.xp || 0;
    const newXp = oldXp + amount;
    const oldLevel = xpToLevel(oldXp);
    const newLevel = xpToLevel(newXp);

    await updateDoc(doc(db, "users", user.uid), {
      xp: newXp,
      level: newLevel
    });

    setProfile(prev => ({ ...prev, xp: newXp, level: newLevel }));

    if (newLevel > oldLevel) {
      setShowLevelUp({ from: oldLevel, to: newLevel });

      if (audioRef.current) {
        try {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        } catch {}
      }

      setTimeout(() => setShowLevelUp(null), 3500);
    }
  }

  // ---------- Daily Reward ----------
  async function claimDaily() {
    if (!profile) return;

    const last = profile.lastDaily?.toDate
      ? profile.lastDaily.toDate()
      : profile.lastDaily ? new Date(profile.lastDaily) : null;

    const now = new Date();

    if (last && last.toDateString() === now.toDateString())
      return alert("Already claimed today.");

    await updateDoc(doc(db, "users", user.uid), {
      coins: (profile.coins || 0) + 1,
      lastDaily: serverTimestamp()
    });

    await addXP(10);
    alert("+1 coin!");
  }

  // ---------- Watch Ad ----------
  async function watchAd() {
    if (adLoading) return;
    if (adWatchToday >= 3) return alert("Ad limit reached");

    setAdLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1400)); // demo delay
      await addCoins(2);
      await addXP(5);
      setAdWatchToday(c => c + 1);
      alert("+2 coins received");
    } finally {
      setAdLoading(false);
    }
  }
  // ---------- Approve / Reject Admin Requests ----------
  async function approveRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "approved", processedAt: serverTimestamp() });

    if (type === "topup") {
      const uRef = doc(db, "users", req.userId);
      const snap = await getDoc(uRef);
      if (snap.exists()) {
        await updateDoc(uRef, {
          coins: (snap.data().coins || 0) + (req.coins || req.amount || 0),
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

  // ---------- Logout ----------
  async function handleLogoutNavigate() {
    await signOut(auth);
    navigate("/login");
  }

  // ---------- Sound toggle ----------
  function toggleSound() {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play();
    else audioRef.current.pause();
  }

  // ---------- Avatar Modal Controls ----------
  const openAvatarModal = () => setShowAvatarModal(true);
  const closeAvatarModal = () => {
    setShowAvatarModal(false);
    setAvatarSelecting(false);
  };

  function avatarRequiredLevel(i) {
    if (i <= 5) return 1;
    return Math.min(18, Math.floor(i / 2) + 1);
  }

  async function selectAvatar(filename) {
    if (!profile) return;

    const idx = AVATARS.indexOf(filename);
    const required = avatarRequiredLevel(idx);

    if ((profile.level || 1) < required) {
      return alert(`You must be Level ${required} to use this avatar.`);
    }

    setAvatarSelecting(true);

    try {
      const avatarPath = `/avatars/${filename}`;
      await updateDoc(doc(db, "users", user.uid), { avatar: avatarPath });
      const snap = await getDoc(doc(db, "users", user.uid));
      setProfile({ id: snap.id, ...snap.data() });
      closeAvatarModal();
      alert("Avatar updated!");
    } catch (err) {
      console.error("selectAvatar error:", err);
      alert("Failed to update avatar.");
      setAvatarSelecting(false);
    }
  }

  // ---------- Loading Screen ----------
  if (loading || !profile) {
    return (
      <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>
        Loading Dashboard...
      </div>
    );
  }

  // ---------- XP % ----------
  const level = profile.level || xpToLevel(profile.xp || 0);
  const xpNeeded = XP_LEVELS[level - 1] || 100;
  const xpPercent = Math.min(100, Math.round(((profile.xp || 0) / xpNeeded) * 100));

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
          <img src="/icon.jpg" className="logo" alt="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">
              {profile.username || profile.displayName || profile.email}
            </div>
          </div>
        </div>

        <div className="header-actions-fixed">
          <HomeButtons onToggleSound={toggleSound} />
          {profile.email === adminEmail && (
            <button className="btn small" onClick={() => setActiveTab("admin")}>
              Admin
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="dash-main">
        {/* Coins + Mini Profile */}
        <section className="panel glow-panel" style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div className="muted">Coins</div>
            <div className="big coin-row">
              <img src="/coin.jpg" className="coin-icon-fixed" alt="coin" />
              <span style={{ fontSize:26, fontWeight:800, marginLeft:10 }}>
                {profile.coins ?? 0}
              </span>
            </div>
          </div>

          {/* Mini compact profile card */}
          <div style={{ maxWidth:360 }}>
            <div className="modern-card" style={{ padding:12, display:"flex", gap:12 }}>
              <div style={{ width:64, height:64, borderRadius:10, overflow:"hidden" }}>
                <img
                  src={profile.avatar || "/avatars/default.jpg"}
                  alt="avatar"
                  style={{ width:"100%", height:"100%", objectFit:"cover" }}
                />
              </div>

              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800 }}>
                  {profile.displayName || profile.username || "Player"}
                </div>

                <div style={{ color:"#bfc7d1", fontSize:13 }}>
                  Level {level} • {profile.xp || 0} XP
                </div>

                <div className="xpbar-root" style={{ marginTop:8 }}>
                  <div className="xpbar-track">
                    <div className="xpbar-fill" style={{ width:`${xpPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOME */}
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
              <MatchList
                matches={matches}
                onSelect={(m) => {
                  setSelectedMatch(m);
                  setActiveTab("matches");
                }}
              />
            </section>
          </>
        )}

        {/* MATCHES */}
        {activeTab === "matches" && (
          selectedMatch ? (
            <MatchDetails match={selectedMatch} onBack={() => setSelectedMatch(null)} />
          ) : (
            <section className="panel glow-panel">
              <h3>Matches</h3>
              <MatchList matches={matches} onSelect={(m) => setSelectedMatch(m)} />
            </section>
          )
        )}

        {/* TOPUP */}
        {activeTab === "topup" && <TopupPage user={user} profile={profile} />}

        {/* WITHDRAW */}
        {activeTab === "withdraw" && <WithdrawPage profile={profile} />}

        {/* ACCOUNT */}
        {activeTab === "account" && (
          <AccountMenu
            profile={profile}
            setProfile={setProfile}
            updateProfileField={updateProfileField}
            addXP={addXP}
            onRankClick={() => setActiveTab("rank")}
            onLogout={handleLogoutNavigate}

            // IMPORTANT: Avatar open function passed to AccountMenu
            openAvatarModal={openAvatarModal}
          />
        )}

        {/* RANK */}
        {activeTab === "rank" && (
          <RankPage
            profile={profile}
            xpForLevel={(l) => XP_LEVELS[l - 1]}
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

      {/* NAV BAR */}
      <footer className="bottom-nav glow-nav">
        {["home", "matches", "topup", "withdraw", "account"].map((tab) => (
          <button
            key={tab}
            className={`nav-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab);
              setSelectedMatch(null);
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>

      {/* ---------- AVATAR MODAL ---------- */}
      {showAvatarModal && (
        <div className="modal-overlay" onClick={closeAvatarModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Choose Avatar</h3>
            <p className="modern-subtitle">Click to select. Some require higher levels.</p>

            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit, minmax(96px, 1fr))",
              gap:12,
              marginTop:12
            }}>
              {AVATARS.map((f, idx) => {
                const path = `/avatars/${f}`;
                const required = avatarRequiredLevel(idx);
                const locked = level < required;

                return (
                  <div key={f} style={{ textAlign:"center" }}>
                    <button
                      className="icon-button"
                      disabled={locked || avatarSelecting}
                      onClick={() => selectAvatar(f)}
                      style={{
                        width:96, height:96, borderRadius:12,
                        overflow:"hidden", position:"relative",
                        border: profile.avatar === path
                          ? "2px solid var(--accent2)"
                          : "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <img src={path} alt={f} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      {locked && (
                        <div style={{
                          position:"absolute",
                          bottom:0, left:0, right:0,
                          background:"rgba(0,0,0,0.6)",
                          fontSize:12, padding:"6px 4px"
                        }}>
                          Level {required}+
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign:"right", marginTop:16 }}>
              <button className="btn small ghost" onClick={closeAvatarModal} disabled={avatarSelecting}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEVEL UP POPUP */}
      {showLevelUp && (
        <LevelUpPopup
          from={showLevelUp.from}
          to={showLevelUp.to}
          onClose={() => setShowLevelUp(null)}
        />
      )}
    </div>
  );
      }
