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

  const [showLevelUp, setShowLevelUp] = useState(null); // { from, to }
  const [adWatchToday, setAdWatchToday] = useState(0);
  const [adLoading, setAdLoading] = useState(false);

  // Avatar selector modal
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarSelecting, setAvatarSelecting] = useState(false);

  const audioRef = useRef(null);
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

  // Avatar list (public/avatars/)
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
          // ensure avatar saved server-side
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
        console.error("Dashboard load error:", err);
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

  // ---------- Avatar selection (Account page only) ----------
  function openAvatarModal() {
    setShowAvatarModal(true);
  }
  function closeAvatarModal() {
    setShowAvatarModal(false);
    setAvatarSelecting(false);
  }

  // compute required level for an avatar (simple mapping; we can change later)
  function avatarRequiredLevel(index) {
    // first avatar (default.jpg) unlocked for everyone
    if (index === 0) return 1;
    // map indexes to tiers: Bronze (1-2), Silver (3-8), Gold (9-12), etc.
    // we'll convert those to simple "stars" labels in UI
    return Math.min(18, Math.floor(index / 2) + 1);
  }

  async function selectAvatar(filename) {
    if (!profile) return;
    const idx = AVATARS.indexOf(filename);
    if (idx === -1) return;
    const required = avatarRequiredLevel(idx);
    if ((profile.level || 1) < required) {
      return alert(`You need to be Level ${required} to use this avatar.`);
    }
    setAvatarSelecting(true);
    try {
      const avatarPath = `/avatars/${filename}`;
      await updateDoc(doc(db, "users", user.uid), { avatar: avatarPath });
      const snap = await getDoc(doc(db, "users", user.uid));
      setProfile({ id: snap.id, ...snap.data() });
      // small select sound if available
      try { audioRef.current && audioRef.current.play(); } catch {}
      alert("Avatar updated!");
      closeAvatarModal();
    } catch (err) {
      console.error("selectAvatar error", err);
      alert("Failed to update avatar.");
      setAvatarSelecting(false);
    }
  }

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

  return (
    <div className="dash-root">
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
          {profile.email === adminEmail && <button className="btn small" onClick={() => setActiveTab("admin")}>Admin</button>}
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
              <div style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                <img src={profile.avatar || "/avatars/default.jpg"} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

            {/* Featured matches */}
            <section className="panel glow-panel">
              <h3>Featured Matches</h3>
              <MatchList matches={matches} onSelect={(m) => { setSelectedMatch(m); setActiveTab("matches"); }} />
            </section>

            {/* Avatar quick-card — only shows on HOME (per your request) */}
            <section className="panel glow-panel">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <img src={profile.avatar || "/avatars/default.jpg"} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{profile.displayName || profile.username || "Player"}</div>
                  <div style={{ color: "#bfc7d1", fontSize: 13 }}>{`Level ${profile.level || 1}`}</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <button className="btn" onClick={() => { setActiveTab("account"); setTimeout(openAvatarModal, 120); }}>
                    Change Avatar
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
                Click "Change Avatar" to choose an avatar from your available list. Some avatars require higher levels.
              </div>
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

        {/* ACCOUNT - includes AccountMenu and small avatar / "Change Avatar" (no duplicate big quick-card) */}
        {activeTab === "account" && (
          <div>
            <AccountMenu
              profile={profile}
              setProfile={setProfile}
              updateProfileField={updateProfileField}
              addXP={addXP}
              onRankClick={() => setActiveTab("rank")}
              onLogout={handleLogoutNavigate}
              openAvatarModal={openAvatarModal}  // pass handler so AccountMenu can open modal
            />
            {/* On account page we do not render the HOME quick-card — user asked it only on home */}
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
      {showAvatarModal && activeTab === "account" && (
        <div className="modal-overlay" onClick={closeAvatarModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Choose Avatar</h3>
            <p className="modern-subtitle">Tap avatar to select. Locked avatars show tier (Bronze / Silver / Gold).</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 12, marginTop: 12, maxHeight: "56vh", overflow: "auto", paddingRight: 8 }}>
              {AVATARS.map((f, idx) => {
                const path = `/avatars/${f}`;
                const required = avatarRequiredLevel(idx);
                const locked = (profile.level || 1) < required;
                // convert required to tier stars (simple)
                const tierStars = required <= 2 ? "☆" : required <= 6 ? "☆☆" : required <= 10 ? "☆☆☆" : "☆☆☆☆";
                return (
                  <div key={f} style={{ textAlign: "center" }}>
                    <button
                      className="icon-button"
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: 8,
                        padding: 0,
                        overflow: "hidden",
                        position: "relative",
                        border: profile.avatar === path ? "2px solid var(--accent2)" : "1px solid rgba(255,255,255,0.06)",
                        background: locked ? "rgba(0,0,0,0.35)" : "transparent"
                      }}
                      disabled={avatarSelecting}
                      onClick={() => !locked && selectAvatar(f)}
                      title={locked ? `Locked — Tier ${tierStars}` : "Select avatar"}
                    >
                      <img src={path} alt={f} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {locked && (
                        <div style={{
                          position: "absolute",
                          left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)",
                          color: "#fff", fontSize: 13, padding: "6px 4px"
                        }}>
                          {tierStars}
                        </div>
                      )}
                    </button>
                    <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12, textTransform: "capitalize" }}>{f.replace(".jpg", "").replace(/-/g, " ")}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn small ghost" onClick={closeAvatarModal} disabled={avatarSelecting}>Cancel</button>
            </div>
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
