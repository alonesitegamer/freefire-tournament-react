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

/**
 * Dashboard.jsx — Option A (Avatar modal only via Account page avatar click)
 *
 * Changes made:
 * - Avatar modal grouped & sorted by rank low -> high
 * - `default.jpg` unlocked by default and auto-selected for new users
 * - Lock overlay, selected glow, animated border, select sound
 * - Clicking top-right or profile avatar opens modal (only allowed from Account tab)
 */

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });

  const [showLevelUp, setShowLevelUp] = useState(null); // { from, to }
  const [adWatchToday, setAdWatchToday] = useState(0);
  const [adLoading, setAdLoading] = useState(false);

  // Avatar modal state (only triggered from Account page)
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarSelecting, setAvatarSelecting] = useState(false);

  const audioRef = useRef(null); // level up sound
  const selectAudioRef = useRef(null); // selection sound

  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";

  // XP levels (18 entries, last is heroic cap)
  const XP_LEVELS = [
    100, 200, 350, 500, 700, 900, 1200, 1500, 1900, 2300, 2800, 3400, 4000, 4700,
    5500, 6300, 7200, 9999999,
  ];

  function xpToLevel(xp = 0) {
    for (let i = 0; i < XP_LEVELS.length; i++) {
      if (xp < XP_LEVELS[i]) return i + 1;
    }
    return XP_LEVELS.length;
  }

  // ---------- Avatar list and required-rank mapping ----------
  const AVATARS = [
    "angelic.jpg",
    "authentic.jpg",
    "brain.jpg",
    "chicken.jpg",
    "crown.jpg",
    "cyberpunk.jpg",
    "default.jpg",
    "dragon.jpg",
    "flame-falco.jpg",
    "flower-wind.jpg",
    "flower.jpg",
    "free.jpg",
    "freefire.jpg",
    "ghost-mask.jpg",
    "ghost.jpg",
    "girl.jpg",
    "helm.jpg",
    "panda.jpg",
    "pink-glow.jpg",
    "purple.jpg",
    "radiation.jpg",
    "season7.jpg",
    "season8.jpg",
    "season9.jpg",
    "star.jpg",
    "unknown.jpg",
    "water.jpg",
  ];

  // mapping based on your list (filename -> { level, label })
  const AVATAR_META = {
    "angelic.jpg": { level: 15, label: "Diamond ★★★" }, // diamond 3+
    "authentic.jpg": { level: 8, label: "Gold ★★" }, // gold2+
    "brain.jpg": { level: 3, label: "Bronze ★★★" }, // bronze3+
    "chicken.jpg": { level: 5, label: "Silver ★★" }, // silver2+
    "crown.jpg": { level: 14, label: "Platinum ★★★★" }, // platinum4+
    "cyberpunk.jpg": { level: 4, label: "Silver ★" },
    "default.jpg": { level: 1, label: "Bronze ★" }, // free/unlocked
    "dragon.jpg": { level: 9, label: "Gold ★★★" }, // gold3+
    "flame-falco.jpg": { level: 18, label: "Diamond ★★★★" },
    "flower-wind.jpg": { level: 15, label: "Diamond ★" },
    "flower.jpg": { level: 16, label: "Diamond ★★" },
    "free.jpg": { level: 11, label: "Platinum ★" },
    "freefire.jpg": { level: 18, label: "Heroic" },
    "ghost-mask.jpg": { level: 15, label: "Diamond ★" },
    "ghost.jpg": { level: 14, label: "Platinum ★★★★" },
    "girl.jpg": { level: 2, label: "Bronze ★★" },
    "helm.jpg": { level: 8, label: "Gold ★★" },
    "panda.jpg": { level: 4, label: "Silver ★" },
    "pink-glow.jpg": { level: 10, label: "Gold ★★★★" },
    "purple.jpg": { level: 8, label: "Gold ★★" },
    "radiation.jpg": { level: 17, label: "Diamond ★★★" },
    "season7.jpg": { level: 14, label: "Platinum ★★★★" },
    "season8.jpg": { level: 13, label: "Platinum ★★★" },
    "season9.jpg": { level: 12, label: "Platinum ★★" },
    "star.jpg": { level: 10, label: "Gold ★★★★" },
    "unknown.jpg": { level: 18, label: "Heroic" },
    "water.jpg": { level: 12, label: "Platinum ★★" },
  };

  function getAvatarMeta(filename) {
    return AVATAR_META[filename] ?? { level: 18, label: "Heroic" };
  }

  // helper: derive rank category (Bronze/Silver/Gold/Platinum/Diamond/Heroic)
  function rankCategory(label) {
    if (!label) return "Other";
    const low = label.toLowerCase();
    if (low.includes("bronze")) return "Bronze";
    if (low.includes("silver")) return "Silver";
    if (low.includes("gold")) return "Gold";
    if (low.includes("platinum")) return "Platinum";
    if (low.includes("diamond")) return "Diamond";
    if (low.includes("heroic")) return "Heroic";
    return "Other";
  }

  // ---------- Load / bootstrap profile ----------
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
            referralCode:
              data.referralCode ?? user.uid.substring(0, 8).toUpperCase(),
            lastDaily: data.lastDaily ?? null,
            avatar: data.avatar ?? "/avatars/default.jpg",
            wins: data.wins ?? 0,
            played: data.played ?? 0,
            ...data,
          };

          // ensure referral saved server-side
          if (!data.referralCode) {
            await updateDoc(ref, { referralCode: safe.referralCode });
          }
          // ensure avatar saved server-side — default.jpg selected for new users
          if (!data.avatar) {
            await updateDoc(ref, { avatar: safe.avatar });
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
            referralCode: user.uid.substring(0, 8).toUpperCase(),
            lastDaily: null,
            avatar: "/avatars/default.jpg",
            createdAt: serverTimestamp(),
          };
          await setDoc(ref, initial);
          if (mounted) setProfile({ id: ref.id, ...initial });
        }
      } catch (err) {
        console.error("Dashboard load error", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid, user.email, user.displayName]);

  // ---------- Load matches only when user opens matches tab ----------
  useEffect(() => {
    if (activeTab !== "matches") return;
    let mounted = true;
    (async () => {
      try {
        const matchesRef = collection(db, "matches");
        const q = query(
          matchesRef,
          where("status", "==", "upcoming"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (mounted) setMatches(arr);
      } catch (err) {
        console.error("Load matches error:", err);
      }
    })();
    return () => (mounted = false);
  }, [activeTab]);

  // ---------- Admin pending requests (admin only) ----------
  useEffect(() => {
    if (profile?.email !== adminEmail) return;
    (async () => {
      try {
        const top = await getDocs(
          query(collection(db, "topupRequests"), where("status", "==", "pending"))
        );
        const wd = await getDocs(
          query(
            collection(db, "withdrawRequests"),
            where("status", "==", "pending")
          )
        );
        setRequests({
          topup: top.docs.map((d) => ({ id: d.id, ...d.data() })),
          withdraw: wd.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
      } catch (err) {
        console.error("Admin load error", err);
      }
    })();
  }, [profile]);

  // ---------- Profile update helper ----------
  async function updateProfileField(patch) {
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, patch);
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
  }

  // ---------- Coins / XP helpers ----------
  async function addCoins(n = 1) {
    if (!profile) return;
    const newCoins = (profile.coins || 0) + n;
    await updateDoc(doc(db, "users", user.uid), { coins: newCoins });
    setProfile((prev) => ({ ...prev, coins: newCoins }));
  }

  async function addXP(amount = 0) {
    if (!profile) return;
    const oldXp = profile.xp || 0;
    const newXp = oldXp + amount;
    const oldLevel = xpToLevel(oldXp);
    const newLevel = xpToLevel(newXp);

    await updateDoc(doc(db, "users", user.uid), { xp: newXp, level: newLevel });
    setProfile((prev) => ({ ...prev, xp: newXp, level: newLevel }));

    if (newLevel > oldLevel) {
      setShowLevelUp({ from: oldLevel, to: newLevel });
      if (audioRef.current) {
        try {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        } catch (e) {}
      }
      // hide after a few seconds
      setTimeout(() => setShowLevelUp(null), 3500);
    }
  }

  // ---------- Daily claim ----------
  async function claimDaily() {
    if (!profile) return;
    const last =
      profile.lastDaily && typeof profile.lastDaily.toDate === "function"
        ? profile.lastDaily.toDate()
        : profile.lastDaily
        ? new Date(profile.lastDaily)
        : null;
    const now = new Date();
    if (last && last.toDateString() === now.toDateString()) {
      return alert("You already claimed today's reward.");
    }
    await updateDoc(doc(db, "users", user.uid), {
      coins: (profile.coins || 0) + 1,
      lastDaily: serverTimestamp(),
    });
    await addXP(10); // daily xp +10
    alert("+1 coin credited!");
  }

  // ---------- Watch ad (demo integration) ----------
  async function watchAd() {
    if (adLoading) return;
    if (adWatchToday >= 3) return alert("You have reached the daily ad limit (3).");
    setAdLoading(true);
    try {
      // placeholder for real ad flow
      await new Promise((r) => setTimeout(r, 1400));
      await addCoins(2); // reward = 2 coins
      await addXP(5);
      setAdWatchToday((c) => c + 1);
      alert("+2 coins for watching ad.");
    } catch (err) {
      console.error("watchAd error", err);
      alert("Ad failed.");
    } finally {
      setAdLoading(false);
    }
  }

  // ---------- Admin approve/reject ----------
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
    setRequests((prev) => ({
      ...prev,
      [type]: prev[type].filter((i) => i.id !== req.id),
    }));
  }

  // ---------- End helpers (Part 1 continues) ----------
// (continuation of src/pages/Dashboard.jsx)

  async function rejectRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "rejected", processedAt: serverTimestamp() });
    setRequests((prev) => ({
      ...prev,
      [type]: prev[type].filter((i) => i.id !== req.id),
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

  // ---------- Avatar modal helpers ----------
  function openAvatarModal() {
    setShowAvatarModal(true);
  }
  function closeAvatarModal() {
    setShowAvatarModal(false);
    setAvatarSelecting(false);
  }

  function avatarRequiredLevelFor(filename) {
    const meta = getAvatarMeta(filename);
    return meta.level || 18;
  }

  async function selectAvatar(filename) {
    if (!profile) return;
    const required = avatarRequiredLevelFor(filename);
    if ((profile.level || 1) < required) {
      const meta = getAvatarMeta(filename);
      return alert(`Locked — requires ${meta.label} (Level ${required}).`);
    }
    setAvatarSelecting(true);
    try {
      const avatarPath = `/avatars/${filename}`;
      await updateDoc(doc(db, "users", user.uid), { avatar: avatarPath });
      const snap = await getDoc(doc(db, "users", user.uid));
      setProfile({ id: snap.id, ...snap.data() });

      // play select sound if available
      try {
        if (selectAudioRef.current) {
          selectAudioRef.current.currentTime = 0;
          await selectAudioRef.current.play();
        }
      } catch (e) {
        // ignore play errors
      }

      // small confirmation and close
      setAvatarSelecting(false);
      closeAvatarModal();
    } catch (err) {
      console.error("selectAvatar error", err);
      alert("Failed to update avatar.");
      setAvatarSelecting(false);
    }
  }

  // ---------- Setup audio refs on first mount ----------
  useEffect(() => {
    // level up audio
    try {
      audioRef.current = new Audio("/levelup.mp3");
      audioRef.current.volume = 0.9;
    } catch (e) {
      audioRef.current = null;
    }
    // selection audio
    try {
      selectAudioRef.current = new Audio("/select.mp3");
      selectAudioRef.current.volume = 0.9;
    } catch (e) {
      selectAudioRef.current = null;
    }
  }, []);

  // ---------- Loading guard ----------
  if (loading || !profile) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        Loading Dashboard...
      </div>
    );
  }

  // ---------- Derived values for XP bar ----------
  const curLevel = profile.level || xpToLevel(profile.xp || 0);
  const xpForCurLevel = XP_LEVELS[Math.max(0, Math.min(XP_LEVELS.length - 1, curLevel - 1))] || 100;
  const xpPercent = Math.min(100, Math.round(((profile.xp || 0) / xpForCurLevel) * 100));

  // ---------- Prepare grouped & sorted avatars for modal (low -> high) ----------
  const avatarsWithMeta = AVATARS.map((f) => {
    const meta = getAvatarMeta(f);
    return { file: f, meta, path: `/avatars/${f}` };
  });

  // Sort by required level ascending, with default.jpg forced first
  avatarsWithMeta.sort((a, b) => {
    if (a.file === "default.jpg") return -1;
    if (b.file === "default.jpg") return 1;
    return (a.meta.level || 999) - (b.meta.level || 999);
  });

  // Group into categories (Bronze/Silver/Gold/Platinum/Diamond/Heroic)
  const grouped = {};
  avatarsWithMeta.forEach((av) => {
    const cat = rankCategory(av.meta.label) || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(av);
  });

  // Order of categories low->high
  const categoryOrder = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Heroic", "Other"];

  return (
    <div className="dash-root">
      {/* element for audio control (kept for compatibility) */}
      <audio ref={audioRef} src="/levelup.mp3" />

      {/* background video + overlay */}
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      <header className="dash-header glow-header">
        <div className="logo-row">
          <img src="/icon.jpg" className="logo" alt="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">{profile.username || profile.displayName || profile.email}</div>
          </div>
        </div>

        <div className="header-actions-fixed">
          <HomeButtons onToggleSound={toggleSound} />
          {profile.email === adminEmail && (
            <button className="btn small" onClick={() => setActiveTab("admin")}>Admin</button>
          )}
        </div>
      </header>

      <main className="dash-main">
        {/* coins + compact user card (not floating) */}
        <section className="panel glow-panel" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="muted">Coins</div>
            <div className="big coin-row" style={{ alignItems: "center" }}>
              <img src="/coin.jpg" className="coin-icon-fixed" alt="coin" />
              <span style={{ fontSize: 26, fontWeight: 800, marginLeft: 10 }}>{profile.coins ?? 0}</span>
            </div>
          </div>

          {/* compact profile card on the right (shows avatar + level + xp) - not floating */}
          <div style={{ maxWidth: 360 }}>
            <div className="modern-card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer",
                }}
                title="Click to change avatar (Account section only)"
                onClick={() => {
                  if (activeTab === "account") openAvatarModal();
                  else {
                    setActiveTab("account");
                    setTimeout(() => openAvatarModal(), 220);
                  }
                }}
              >
                <img
                  src={profile.avatar || "/avatars/default.jpg"}
                  alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{profile.displayName || profile.username || "Player"}</div>
                <div style={{ color: "#bfc7d1", fontSize: 13 }}>{`Level ${curLevel} • ${profile.xp || 0} XP`}</div>

                <div className="xpbar-root" style={{ marginTop: 8 }}>
                  <div className="xpbar-track" style={{ height: 10 }}>
                    <div className="xpbar-fill" style={{ width: `${xpPercent}%`, height: 10, borderRadius: 8 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOME tab */}
        {activeTab === "home" && (
          <>
            <section className="panel glow-panel">
              <h3>Welcome back!</h3>
              <p>Check matches or top up to start playing.</p>

              <div className="home-top-buttons" style={{ marginTop: 12 }}>
                <button className="btn glow" onClick={claimDaily}>Daily Reward +1</button>
                <button className="btn ghost glow" disabled={adLoading} onClick={watchAd}>
                  {adLoading ? "Loading..." : `Watch Ad +2 (${adWatchToday}/3)`}
                </button>
              </div>
            </section>

            <section className="panel glow-panel">
              <h3>Featured Matches</h3>
              <MatchList matches={matches} onSelect={(m) => { setSelectedMatch(m); setActiveTab("matches"); }} />
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

        {/* ACCOUNT - includes avatar-change via clicking the avatar (no duplicate bottom panel) */}
        {activeTab === "account" && (
          <div>
            <AccountMenu
              profile={profile}
              setProfile={setProfile}
              updateProfileField={updateProfileField}
              addXP={addXP}
              onRankClick={() => setActiveTab("rank")}
              onLogout={handleLogoutNavigate}
              openAvatarModal={openAvatarModal} // pass modal opener
            />

            {/* NOTE: removed the bottom avatar panel you asked to remove — clicking the avatar in the card opens the modal */}
          </div>
        )}

        {/* RANK full screen */}
        {activeTab === "rank" && <RankPage profile={profile} xpForLevel={(l) => XP_LEVELS[Math.max(0, l - 1)]} onBack={() => setActiveTab("account")} />}

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

      {/* Bottom nav */}
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

      {/* ---------- Avatar selection modal (Account-only) ---------- */}
      {showAvatarModal && (
        <div className="modal-overlay" onClick={closeAvatarModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 920 }}>
            <h3 className="modern-title">Choose Avatar</h3>
            <p className="modern-subtitle">Tap avatar to select. Locked avatars show required rank.</p>

            {/* Grouped categories in order */}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 14 }}>
              {categoryOrder.map((cat) => {
                const items = grouped[cat];
                if (!items || items.length === 0) return null;
                return (
                  <div key={cat}>
                    <div style={{ fontWeight: 800, color: "#fff", marginBottom: 8 }}>{cat}</div>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                      gap: 12,
                      alignItems: "start"
                    }}>
                      {items.map((av) => {
                        const locked = (profile.level || 1) < (av.meta.level || 999);
                        const isSelected = (profile.avatar || "").endsWith(av.file) || profile.avatar === av.path;

                        // Inline styles for selected glow & animated border
                        const tileStyle = {
                          width: 100,
                          height: 100,
                          borderRadius: 10,
                          padding: 0,
                          overflow: "hidden",
                          position: "relative",
                          border: isSelected ? "2px solid var(--accent2)" : "1px solid rgba(255,255,255,0.06)",
                          boxShadow: isSelected ? "0 0 18px rgba(255,92,46,0.25), 0 0 40px rgba(255,92,46,0.06)" : undefined,
                          transform: isSelected ? "translateY(-4px)" : undefined,
                          transition: "transform .18s ease, box-shadow .2s ease, border .18s ease",
                          background: "rgba(0,0,0,0.06)"
                        };

                        // shimmer keyframes fallback inline (for locked)
                        const shimmer = {
                          animation: locked ? "shimmer 1.6s infinite linear" : undefined,
                          backgroundSize: locked ? "200% 100%" : undefined,
                        };

                        return (
                          <div key={av.file} style={{ textAlign: "center" }}>
                            <button
  className={`icon-button avatar-tile 
    ${tierClass(meta.label)} 
    ${locked ? "locked" : ""} 
    ${isSelected ? "selected-avatar" : ""}`
  }
  style={{ ...tileStyle, ...shimmer }}
  disabled={avatarSelecting || locked}
  onClick={() => selectAvatar(av.file)}
  title={locked ? `${av.meta.label} (locked)` : `Use this avatar — ${av.meta.label}`}
>
                              <img
                                src={av.path}
                                alt={av.file}
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />

                              {/* locked overlay */}
                              {locked && (
                                <div style={{
                                  position: "absolute",
                                  left: 0, right: 0, bottom: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 8,
                                  background: "rgba(0,0,0,0.6)",
                                  color: "#fff",
                                  fontSize: 12,
                                  padding: "6px 4px",
                                }}>
                                  <span style={{ opacity: 0.95 }}>🔒</span>
                                  <span style={{ fontWeight: 700 }}>{av.meta.label}</span>
                                </div>
                              )}

                              {/* Selected badge */}
                              {isSelected && !locked && (
                                <div style={{
                                  position: "absolute",
                                  top: 6,
                                  right: 6,
                                  background: "rgba(0,0,0,0.45)",
                                  padding: "4px 6px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  color: "#fff",
                                  fontWeight: 700,
                                }}>Selected</div>
                              )}
                            </button>

                            {/* subtle label (no filename) */}
                            <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
                              {av.meta.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn small ghost" onClick={closeAvatarModal} disabled={avatarSelecting}>Cancel</button>
            </div>

            {/* inline shimmer keyframes to ensure it works even if global CSS missing */}
            <style>{`
              @keyframes shimmer {
                0% { background-position: -150% 0; }
                100% { background-position: 150% 0; }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* ---------- Level up popup (simple) ---------- */}
      {showLevelUp && (
        <LevelUpPopup from={showLevelUp.from} to={showLevelUp.to} onClose={() => setShowLevelUp(null)} />
      )}
    </div>
  );
}
