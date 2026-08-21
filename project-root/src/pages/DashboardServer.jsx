import React, { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { secureApi } from "../utils/apiClient";
import HomeButtons from "../components/HomeButtons";
import MatchList from "../components/MatchList";
import MatchDetails from "../components/MatchDetails";
import TopupPage from "../components/TopupPage";
import WithdrawPage from "../components/WithdrawPage";
import AccountMenu from "../components/AccountMenu";
import AdminPanel from "../components/AdminPanel";
import RankPage from "../components/RankPage";
import LevelUpPopup from "../components/LevelUpPopup";
import "./Dashboard.css";

const XP_LEVELS = [100, 200, 350, 500, 700, 900, 1200, 1500, 1900, 2300, 2800, 3400, 4000, 4700, 5500, 6300, 7200, 9999999];
const AVATARS = [
  "angelic.jpg", "authentic.jpg", "brain.jpg", "chicken.jpg", "crown.jpg", "cyberpunk.jpg", "default.jpg",
  "dragon.jpg", "flame-falco.jpg", "flower-wind.jpg", "flower.jpg", "free.jpg", "freefire.jpg", "ghost-mask.jpg",
  "ghost.jpg", "girl.jpg", "helm.jpg", "panda.jpg", "pink-glow.jpg", "purple.jpg", "radiation.jpg", "season7.jpg",
  "season8.jpg", "season9.jpg", "star.jpg", "unknown.jpg", "water.jpg",
];
const AVATAR_META = {
  "angelic.jpg": { level: 15, label: "Diamond ★★★" }, "authentic.jpg": { level: 8, label: "Gold ★★" }, "brain.jpg": { level: 3, label: "Bronze ★★★" },
  "chicken.jpg": { level: 5, label: "Silver ★★" }, "crown.jpg": { level: 14, label: "Platinum ★★★★" }, "cyberpunk.jpg": { level: 4, label: "Silver ★" },
  "default.jpg": { level: 1, label: "Bronze ★" }, "dragon.jpg": { level: 9, label: "Gold ★★★" }, "flame-falco.jpg": { level: 18, label: "Diamond ★★★★" },
  "flower-wind.jpg": { level: 15, label: "Diamond ★" }, "flower.jpg": { level: 16, label: "Diamond ★★" }, "free.jpg": { level: 11, label: "Platinum ★" },
  "freefire.jpg": { level: 18, label: "Heroic" }, "ghost-mask.jpg": { level: 15, label: "Diamond ★" }, "ghost.jpg": { level: 14, label: "Platinum ★★★★" },
  "girl.jpg": { level: 2, label: "Bronze ★★" }, "helm.jpg": { level: 8, label: "Gold ★★" }, "panda.jpg": { level: 4, label: "Silver ★" },
  "pink-glow.jpg": { level: 10, label: "Gold ★★★★" }, "purple.jpg": { level: 8, label: "Gold ★★" }, "radiation.jpg": { level: 17, label: "Diamond ★★★" },
  "season7.jpg": { level: 14, label: "Platinum ★★★★" }, "season8.jpg": { level: 13, label: "Platinum ★★★" }, "season9.jpg": { level: 12, label: "Platinum ★★" },
  "star.jpg": { level: 10, label: "Gold ★★★★" }, "unknown.jpg": { level: 18, label: "Heroic" }, "water.jpg": { level: 12, label: "Platinum ★★" },
};

function xpToLevel(xp = 0) {
  for (let i = 0; i < XP_LEVELS.length; i += 1) if (xp < XP_LEVELS[i]) return i + 1;
  return XP_LEVELS.length;
}

export default function DashboardServer({ user }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });
  const [activeTab, setActiveTab] = useState("home");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const audioRef = useRef(null);

  const isAdmin = profile?.isAdmin === true;

  const refreshProfile = useCallback(async () => {
    const response = await secureApi("/api/user");
    const next = response.profile;
    next.isAdmin = Boolean(auth.currentUser?.getIdTokenResult && (await auth.currentUser.getIdTokenResult()).claims.admin);
    setProfile(next);
    return next;
  }, []);

  const refreshMatches = useCallback(async () => {
    const response = await secureApi("/api/matches");
    setMatches(response.matches || []);
    return response.matches || [];
  }, []);

  const refreshAdminQueue = useCallback(async () => {
    if (!profile?.isAdmin) return;
    const response = await secureApi("/api/admin-queue");
    setRequests({ topup: response.topup || [], withdraw: response.withdraw || [] });
  }, [profile?.isAdmin]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        await secureApi("/api/referral", { method: "POST", body: JSON.stringify({ referralCode: "" }) }).catch((error) => {
          if (error.message !== "Welcome/referral reward already processed") throw error;
        });
        const nextProfile = await refreshProfile();
        if (!active) return;
        await refreshMatches();
        if (nextProfile.isAdmin) await refreshAdminQueue();
      } catch (error) {
        console.error("Dashboard initialization failed", error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refreshProfile, refreshMatches, refreshAdminQueue]);

  useEffect(() => {
    if (!profile?.isAdmin) return;
    refreshAdminQueue().catch((error) => console.error("Admin queue refresh failed", error));
  }, [profile?.isAdmin, refreshAdminQueue]);

  const updateProfileField = useCallback(async (patch) => {
    const response = await secureApi("/api/user", { method: "PATCH", body: JSON.stringify(patch) });
    const next = response.profile;
    next.isAdmin = Boolean(profile?.isAdmin);
    setProfile(next);
    return next;
  }, [profile?.isAdmin]);

  async function claimDaily() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await secureApi("/api/economy", { method: "POST", body: JSON.stringify({ action: "daily" }) });
      setProfile((current) => current ? { ...current, coins: result.coins, xp: result.xp, level: result.level } : current);
      alert("+1 coin credited!");
    } catch (error) { alert(error.message); }
    finally { setBusy(false); }
  }

  async function watchAd() {
    if (adLoading) return;
    setAdLoading(true);
    try {
      await secureApi("/api/economy", { method: "POST", body: JSON.stringify({ action: "ad" }) });
    } catch (error) {
      alert("Ad rewards are temporarily unavailable until a verified ad provider is connected.");
    } finally { setAdLoading(false); }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login", { replace: true });
  }

  async function createMatch(payload) {
    const response = await secureApi(`/api/admin-matches`, { method: "POST", body: JSON.stringify(payload) });
    await refreshMatches();
    return response.id;
  }

  async function editMatch(matchId, patch) {
    await secureApi(`/api/admin-matches?matchId=${encodeURIComponent(matchId)}`, { method: "PATCH", body: JSON.stringify(patch) });
    await refreshMatches();
  }

  async function removeMatch(matchId) {
    await secureApi(`/api/admin-matches?matchId=${encodeURIComponent(matchId)}`, { method: "DELETE" });
    await refreshMatches();
    setSelectedMatch((current) => current?.id === matchId ? null : current);
  }

  async function getFreshMatch(matchId) {
    const response = await secureApi(`/api/matches?matchId=${encodeURIComponent(matchId)}`);
    return response.match;
  }

  function selectMatch(match) {
    setSelectedMatch(match);
    setActiveTab("matches");
  }

  function toggleSound() {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }

  async function selectAvatar(filename) {
    const meta = AVATAR_META[filename] || { level: 18, label: "Heroic" };
    if ((profile.level || 1) < meta.level) return alert(`Locked — requires ${meta.label} (Level ${meta.level}).`);
    try {
      const next = await updateProfileField({ avatar: `/avatars/${filename}` });
      setProfile(next);
      setShowAvatarModal(false);
    } catch (error) { alert(error.message || "Failed to update avatar"); }
  }

  const curLevel = profile?.level || xpToLevel(profile?.xp || 0);
  const xpForCurLevel = XP_LEVELS[Math.max(0, Math.min(XP_LEVELS.length - 1, curLevel - 1))] || 100;
  const xpPercent = Math.min(100, Math.round(((profile?.xp || 0) / xpForCurLevel) * 100));

  if (loading || !profile) {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>Loading Dashboard...</div>;
  }

  return (
    <div className="dash-root">
      <audio ref={audioRef} src="/levelup.mp3" />
      <video className="bg-video" autoPlay loop muted playsInline><source src="/bg.mp4" type="video/mp4" /></video>
      <div className="dash-overlay" />

      <header className="dash-header glow-header">
        <div className="logo-row">
          <img src="/icon.jpg" className="logo" alt="logo" />
          <div><div className="title">Imperial X Esports</div><div className="subtitle">{profile.username || profile.displayName || profile.email}</div></div>
        </div>
        <div className="header-actions-fixed">
          <HomeButtons onToggleSound={toggleSound} />
          {isAdmin && <button className="btn small" onClick={() => setActiveTab("admin")}>Admin</button>}
        </div>
      </header>

      <main className="dash-main">
        <section className="panel glow-panel" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}><div className="muted">Coins</div><div className="big coin-row"><img src="/coin.jpg" className="coin-icon-fixed" alt="coin" /><span style={{ fontSize: 26, fontWeight: 800, marginLeft: 10 }}>{profile.coins ?? 0}</span></div></div>
          <div className="modern-card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", maxWidth: 360 }}>
            <button onClick={() => setShowAvatarModal(true)} style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", padding: 0, border: 0, background: "transparent" }} title="Change avatar">
              <img src={profile.avatar || "/avatars/default.jpg"} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{profile.username || profile.displayName || "Player"}</div><div style={{ color: "#bfc7d1", fontSize: 13 }}>Level {curLevel} • {profile.xp || 0} XP</div><div className="xpbar-root" style={{ marginTop: 8 }}><div className="xpbar-track" style={{ height: 10 }}><div className="xpbar-fill" style={{ width: `${xpPercent}%`, height: 10, borderRadius: 8 }} /></div></div></div>
          </div>
        </section>

        {activeTab === "home" && <>
          <section className="panel glow-panel"><h3>Welcome back!</h3><p>Check matches or top up to start playing.</p><div className="home-top-buttons" style={{ marginTop: 12 }}><button className="btn glow" disabled={busy} onClick={claimDaily}>Daily Reward +1</button><button className="btn ghost glow" disabled={adLoading} onClick={watchAd}>{adLoading ? "Unavailable..." : "Verified Ad Reward"}</button></div></section>
          <section className="panel glow-panel"><h3>Featured Matches</h3><MatchList matches={matches} onSelect={selectMatch} onJoin={selectMatch} /></section>
        </>}

        {activeTab === "matches" && (selectedMatch ? <MatchDetails match={selectedMatch} user={user} onBack={() => setSelectedMatch(null)} /> : <section className="panel glow-panel"><h3>Matches</h3><MatchList matches={matches} onSelect={selectMatch} onJoin={selectMatch} /></section>)}
        {activeTab === "topup" && <TopupPage user={user} profile={profile} />}
        {activeTab === "withdraw" && <WithdrawPage profile={profile} />}
        {activeTab === "account" && <AccountMenu profile={profile} setProfile={setProfile} updateProfileField={updateProfileField} onRankClick={() => setActiveTab("rank")} onLogout={handleLogout} openAvatarModal={() => setShowAvatarModal(true)} />}
        {activeTab === "rank" && <RankPage profile={profile} onBack={() => setActiveTab("account")} />}
        {activeTab === "admin" && isAdmin && <AdminPanel requests={requests} onRefreshRequests={refreshAdminQueue} matches={matches} createMatch={createMatch} editMatch={editMatch} deleteMatch={removeMatch} />}
      </main>

      <footer className="bottom-nav glow-nav">{["home", "matches", "topup", "withdraw", "account"].map((tab) => <button key={tab} className={`nav-btn ${activeTab === tab ? "active" : ""}`} onClick={() => { setActiveTab(tab); setSelectedMatch(null); }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}</footer>

      {showAvatarModal && <div className="modal-overlay" onClick={() => setShowAvatarModal(false)}><div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 920 }}><h3>Choose Avatar</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 12 }}>{AVATARS.map((file) => { const meta = AVATAR_META[file] || { level: 18, label: "Heroic" }; const locked = curLevel < meta.level; return <button key={file} disabled={locked} className={`icon-button avatar-tile ${locked ? "locked" : ""}`} onClick={() => selectAvatar(file)} title={locked ? `Requires ${meta.label}` : `Use ${meta.label}`}><img src={`/avatars/${file}`} alt="" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10 }} /><div style={{ fontSize: 12, marginTop: 4 }}>{locked ? `🔒 ${meta.label}` : meta.label}</div></button>; })}</div><button className="btn small ghost" onClick={() => setShowAvatarModal(false)} style={{ marginTop: 16 }}>Close</button></div></div>}
      {showLevelUp && <LevelUpPopup from={showLevelUp.from} to={showLevelUp.to} onClose={() => setShowLevelUp(null)} />}
    </div>
  );
}
