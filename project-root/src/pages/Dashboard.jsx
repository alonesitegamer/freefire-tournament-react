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
  addDoc,
  deleteDoc,
  arrayUnion,
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

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarSelecting, setAvatarSelecting] = useState(false);

  const audioRef = useRef(null);
  const selectAudioRef = useRef(null);

  // admin create/edit UI state (optional small helpers)
  const [adminCreateOpen, setAdminCreateOpen] = useState(false);

  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";

  const XP_LEVELS = [
    100, 200, 350, 500, 700, 900, 1200, 1500, 1900, 2300,
    2800, 3400, 4000, 4700, 5500, 6300, 7200, 9999999,
  ];

  function xpToLevel(xp = 0) {
    for (let i = 0; i < XP_LEVELS.length; i++) {
      if (xp < XP_LEVELS[i]) return i + 1;
    }
    return XP_LEVELS.length;
  }

  const AVATARS = [
    "angelic.jpg","authentic.jpg","brain.jpg","chicken.jpg","crown.jpg","cyberpunk.jpg",
    "default.jpg","dragon.jpg","flame-falco.jpg","flower-wind.jpg","flower.jpg","free.jpg",
    "freefire.jpg","ghost-mask.jpg","ghost.jpg","girl.jpg","helm.jpg","panda.jpg",
    "pink-glow.jpg","purple.jpg","radiation.jpg","season7.jpg","season8.jpg","season9.jpg",
    "star.jpg","unknown.jpg","water.jpg",
  ];

  const AVATAR_META = {
    "angelic.jpg": { level: 15, label: "Diamond ★★★" },
    "authentic.jpg": { level: 8, label: "Gold ★★" },
    "brain.jpg": { level: 3, label: "Bronze ★★★" },
    "chicken.jpg": { level: 5, label: "Silver ★★" },
    "crown.jpg": { level: 14, label: "Platinum ★★★★" },
    "cyberpunk.jpg": { level: 4, label: "Silver ★" },
    "default.jpg": { level: 1, label: "Bronze ★" },
    "dragon.jpg": { level: 9, label: "Gold ★★★" },
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

  function tierClass(label) {
    const cat = rankCategory(label);
    return `tier-${cat.toLowerCase()}`;
  }

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

          if (!data.referralCode) {
            await updateDoc(ref, { referralCode: safe.referralCode });
          }
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

  // load matches when matches tab or on initial
  useEffect(() => {
    if (activeTab !== "matches" && activeTab !== "home") return;
    let mounted = true;
    (async () => {
      try {
        const matchesRef = collection(db, "matches");
        const q = query(matchesRef, where("status", "==", "upcoming"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (mounted) setMatches(arr);
      } catch (err) {
        console.error("Load matches error:", err);
      }
    })();
    return () => (mounted = false);
  }, [activeTab]);

  // admin pending requests
  useEffect(() => {
    if (profile?.email !== adminEmail) return;
    (async () => {
      try {
        const top = await getDocs(query(collection(db, "topupRequests"), where("status", "==", "pending")));
        const wd = await getDocs(query(collection(db, "withdrawRequests"), where("status", "==", "pending")));
        setRequests({
          topup: top.docs.map((d) => ({ id: d.id, ...d.data() })),
          withdraw: wd.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
      } catch (err) {
        console.error("Admin load error", err);
      }
    })();
  }, [profile]);

  async function updateProfileField(patch) {
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, patch);
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
  }

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
      setTimeout(() => setShowLevelUp(null), 3500);
    }
  }

  async function claimDaily() {
    if (!profile) return;
    const last = profile.lastDaily && typeof profile.lastDaily.toDate === "function"
      ? profile.lastDaily.toDate() : profile.lastDaily ? new Date(profile.lastDaily) : null;
    const now = new Date();
    if (last && last.toDateString() === now.toDateString()) {
      return alert("You already claimed today's reward.");
    }
    await updateDoc(doc(db, "users", user.uid), { coins: (profile.coins || 0) + 1, lastDaily: serverTimestamp() });
    await addXP(10);
    alert("+1 coin credited!");
  }

  async function watchAd() {
    if (adLoading) return;
    if (adWatchToday >= 3) return alert("You have reached the daily ad limit (3).");
    setAdLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1400));
      await addCoins(2);
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

  // admin approve/reject
  async function approveRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "approved", processedAt: serverTimestamp() });
    if (type === "topup") {
      const uRef = doc(db, "users", req.userId);
      const snap = await getDoc(uRef);
      if (snap.exists()) {
        await updateDoc(uRef, { coins: (snap.data().coins || 0) + (req.coins || req.amount || 0) });
      }
    }
    setRequests((prev) => ({ ...prev, [type]: prev[type].filter((i) => i.id !== req.id) }));
  }

  async function rejectRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "rejected", processedAt: serverTimestamp() });
    setRequests((prev) => ({ ...prev, [type]: prev[type].filter((i) => i.id !== req.id) }));
  }

  async function handleLogoutNavigate() {
    await signOut(auth);
    navigate("/login");
  }

  function toggleSound() {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play();
    else audioRef.current.pause();
  }

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
      try {
        if (selectAudioRef.current) {
          selectAudioRef.current.currentTime = 0;
          await selectAudioRef.current.play();
        }
      } catch (e) {}
      setAvatarSelecting(false);
      closeAvatarModal();
    } catch (err) {
      console.error("selectAvatar error", err);
      alert("Failed to update avatar.");
      setAvatarSelecting(false);
    }
  }

  useEffect(() => {
    try {
      audioRef.current = new Audio("/levelup.mp3");
      audioRef.current.volume = 0.9;
    } catch (e) {
      audioRef.current = null;
    }
    try {
      selectAudioRef.current = new Audio("/select.mp3");
      selectAudioRef.current.volume = 0.9;
    } catch (e) {
      selectAudioRef.current = null;
    }
  }, []);

  // ---------------------------
  // JOIN integration: join logic inside Dashboard (used by MatchList Join + preview join)
  // ---------------------------
  async function joinMatch(matchObj) {
    if (!profile) return alert("Profile missing.");
    // Save username if missing
    let ingame = profile.username || profile.displayName || "";
    if (!ingame) {
      ingame = window.prompt("Enter your in-game username (this will be saved):", "");
      if (!ingame) return alert("You must enter an in-game username to join.");
      try {
        await updateProfileField({ username: ingame });
      } catch (e) {
        console.error("save username", e);
      }
    }

    // reload latest match (avoid stale)
    try {
      const ref = doc(db, "matches", matchObj.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return alert("Match not found.");
      const match = { id: snap.id, ...snap.data() };

      const playerCount = (match.playersJoined || []).length;
      if (match.maxPlayers && playerCount >= match.maxPlayers) return alert("Match is full.");

      // push join
      const playerObj = { uid: user.uid, username: ingame, joinedAt: serverTimestamp() };
      await updateDoc(ref, { playersJoined: arrayUnion(playerObj) });

      // refresh matches locally
      const snap2 = await getDoc(ref);
      const updated = { id: snap2.id, ...snap2.data() };
      setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setSelectedMatch(updated);
      setActiveTab("matches");
      alert("Joined match!");
      return true;
    } catch (err) {
      console.error("joinMatch error", err);
      alert("Failed to join.");
      return false;
    }
  }

  // Called when pressing Join from MatchList (outer button)
  function handleJoinFromList(match) {
  // When selecting from MatchList, send autoJoin flag
  setSelectedMatch({ ...match, _autoJoin: true });
  setActiveTab("matches");
  }
  // ---------------------------
  // Admin helpers: create / edit / delete match (exposed to AdminPanel)
  // ---------------------------
  async function createMatch(payload) {
    const docRef = await addDoc(collection(db, "matches"), {
      ...payload,
      createdAt: serverTimestamp(),
      playersJoined: [],
      status: payload.status || "upcoming",
    });
    const snap = await getDoc(docRef);
    setMatches((prev)matc{ id: snap.id, ...snap.data() }, ...prev]);
    return docRef.id;
  }

  async function editMatch(matchId, patch) {
    await updateDoc(doc(db, "matches", matchId), patch);
    const snap = await getDoc(doc(db, "matches", matchId));
    const updated = { id: snap.id, ...snap.data() };
    setMatches((prev) => prev.map((m) => (m.id === matchId ? updated : m)));
    if (selectedMatch?.id === matchId) setSelectedMatch(updated);
  }

  async function removeMatch(matchId) {
    await deleteDoc(doc(db, "matches", matchId));
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    if (selectedMatch?.id === matchId) setSelectedMatch(null);
  }

  // ---------------------------
  // Derived values / avatar grouping
  // ---------------------------
  if (loading || !profile) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        Loading Dashboard...
      </div>
    );
  }

  const curLevel = profile.level || xpToLevel(profile.xp || 0);
  const xpForCurLevel =
    XP_LEVELS[Math.max(0, Math.min(XP_LEVELS.length - 1, curLevel - 1))] || 100;
  const xpPercent = Math.min(
    100,
    Math.round(((profile.xp || 0) / xpForCurLevel) * 100)
  );

  const avatarsWithMeta = AVATARS.map((f) => {
    const meta = getAvatarMeta(f);
    return { file: f, meta, path: `/avatars/${f}` };
  });

  avatarsWithMeta.sort((a, b) => {
    if (a.file === "default.jpg") return -1;
    if (b.file === "default.jpg") return 1;
    return (a.meta.level || 999) - (b.meta.level || 999);
  });

  const grouped = {};
  avatarsWithMeta.forEach((av) => {
    const cat = rankCategory(av.meta.label) || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(av);
  });

  const categoryOrder = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Heroic", "Other"];

  // small helper: detect if profile has joined a specific match
  function profileHasJoined(match) {
    if (!match) return false;
    return (match.playersJoined || []).some((p) => p.uid === user.uid);
  }

  return (
    <div className="dash-root">
      <audio ref={audioRef} src="/levelup.mp3" />

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
        <section className="panel glow-panel" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="muted">Coins</div>
            <div className="big coin-row" style={{ alignItems: "center" }}>
              <img src="/coin.jpg" className="coin-icon-fixed" alt="coin" />
              <span style={{ fontSize: 26, fontWeight: 800, marginLeft: 10 }}>{profile.coins ?? 0}</span>
            </div>
          </div>

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
                title="Click to change avatar"
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
                <div style={{ fontWeight: 800 }}>
                  {profile.displayName || profile.username || "Player"}
                </div>
                <div style={{ color: "#bfc7d1", fontSize: 13 }}>
                  Level {curLevel} • {profile.xp || 0} XP
                </div>

                <div className="xpbar-root" style={{ marginTop: 8 }}>
                  <div className="xpbar-track" style={{ height: 10 }}>
                    <div
                      className="xpbar-fill"
                      style={{ width: `${xpPercent}%`, height: 10, borderRadius: 8 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

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
              <MatchList
                matches={matches}
                onSelect={(m) => {
                  setSelectedMatch(m);
                  setActiveTab("matches");
                }}
                onJoin={(m) => handleJoinFromList(m)}
              />
            </section>
          </>
        )}

        {activeTab === "matches" && (
          selectedMatch ? (
            profileHasJoined(selectedMatch) ? (
              // player already joined -> show full details
              <MatchDetails
                match={selectedMatch}
                onBack={() => setSelectedMatch(null)}
                user={user}
                profile={profile}
                updateProfileField={updateProfileField}
              />
            ) : (
              // player hasn't joined -> show compact preview + big Join button
              <section className="panel match-preview">
                <button className="back-btn" onClick={() => setSelectedMatch(null)}>Back</button>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 360px", minWidth: 260 }}>
                    <img className="match-details-image" src={selectedMatch.imageUrl || "/match-default.jpg"} alt={selectedMatch.title} />
                  </div>
                  <div style={{ flex: "1 1 320px", minWidth: 260 }}>
                    <h2 style={{ margin: 0 }}>{selectedMatch.title}</h2>
                    <div className="match-meta time" style={{ marginTop: 6 }}>{selectedMatch.mode || selectedMatch.teamType || "Solo"}</div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ color: "#bfc7d1", fontSize: 13 }}>Entry: {selectedMatch.entryFee ?? 0}</div>
                      <div style={{ fontWeight: 800, marginTop: 8 }}>{(selectedMatch.playersJoined || []).length}/{selectedMatch.maxPlayers || "?"}</div>
                    </div>

                    <div style={{ marginTop: 18 }}>
                      <button className="btn large" onClick={() => joinMatch(selectedMatch)}>Join Match</button>
                    </div>

                    <div style={{ marginTop: 18, color: "var(--muted)" }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Preview</div>
                      <div>
                        Room ID & Password are hidden until you join. Room details are revealed {selectedMatch.revealDelayMinutes ? `${selectedMatch.revealDelayMinutes} minute(s)` : "a few minutes"} before match.
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <strong>Map:</strong> { (selectedMatch.mapPool && selectedMatch.mapPool[0]) || selectedMatch.map || "Bermuda" } {selectedMatch.autoRotate ? "(auto-rotate)" : ""}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <strong>Rules:</strong> 1 Kill = {selectedMatch.type === "custom" ? (selectedMatch.killReward ?? "custom") : 75} coins. Total coins decide ranking.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )
          ) : (
            <section className="panel glow-panel">
              <h3>Matches</h3>
              <MatchList matches={matches} onSelect={setSelectedMatch} onJoin={(m) => handleJoinFromList(m)} />
            </section>
          )
        )}

        {activeTab === "topup" && <TopupPage user={user} profile={profile} />}
        {activeTab === "withdraw" && <WithdrawPage profile={profile} />}

        {activeTab === "account" && (
          <AccountMenu
            profile={profile}
            setProfile={setProfile}
            updateProfileField={updateProfileField}
            addXP={addXP}
            onRankClick={() => setActiveTab("rank")}
            onLogout={handleLogoutNavigate}
            openAvatarModal={openAvatarModal}
          />
        )}

        {activeTab === "rank" && (
          <RankPage
            profile={profile}
            xpForLevel={(l) => XP_LEVELS[Math.max(0, l - 1)]}
            onBack={() => setActiveTab("account")}
          />
        )}

        {activeTab === "admin" && profile.email === adminEmail && (
          <AdminPanel
            requests={requests}
            approveRequest={approveRequest}
            rejectRequest={rejectRequest}
            matches={matches}
            createMatch={createMatch}
            editMatch={editMatch}
            deleteMatch={removeMatch}
          />
        )}
      </main>

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

      {showAvatarModal && (
        <div className="modal-overlay" onClick={closeAvatarModal}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 920 }}
          >
            <h3 className="modern-title">Choose Avatar</h3>
            <p className="modern-subtitle">Tap avatar to select. Locked avatars show required rank.</p>

            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 14 }}>
              {categoryOrder.map((cat) => {
                const items = grouped[cat];
                if (!items || items.length === 0) return null;

                return (
                  <div key={cat}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>{cat}</div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {items.map((av) => {
                        const locked = (profile.level || 1) < (av.meta.level || 999);
                        const isSelected =
                          (profile.avatar || "").endsWith(av.file) ||
                          profile.avatar === av.path;

                        return (
                          <div key={av.file} style={{ textAlign: "center" }}>
                            <button
                              className={`icon-button avatar-tile ${tierClass(av.meta.label)} 
                                ${locked ? "locked" : ""} 
                                ${isSelected ? "selected-avatar" : ""}`}
                              style={{
                                width: 100,
                                height: 100,
                                borderRadius: 10,
                                padding: 0,
                                overflow: "hidden",
                                position: "relative",
                                border: isSelected
                                  ? "2px solid var(--accent2)"
                                  : "1px solid rgba(255,255,255,0.06)",
                              }}
                              disabled={avatarSelecting || locked}
                              onClick={() => selectAvatar(av.file)}
                              title={locked ? `${av.meta.label} (locked)` : `Use this avatar — ${av.meta.label}`}
                            >
                              <img
                                src={av.path}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />

                              {locked && (
                                <div className="avatar-locked-label">
                                  🔒 {av.meta.label}
                                </div>
                              )}

                              {isSelected && !locked && (
                                <div className="avatar-selected-badge">Selected</div>
                              )}
                            </button>

                            <div
                              style={{
                                marginTop: 8,
                                color: "var(--muted)",
                                fontSize: 12,
                              }}
                            >
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

            <div className="avatar-modal-footer">
              <button
                className="btn small ghost"
                onClick={closeAvatarModal}
                disabled={avatarSelecting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
