// src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase";
import { signOut, updateProfile } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  arrayUnion,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import {
  FaVolumeUp,
  FaVolumeMute,
  FaHistory,
  FaMoneyBillWave,
  FaGift,
  FaSignOutAlt,
  FaArrowLeft,
  FaUserEdit,
  FaUserCog,
} from "react-icons/fa";

/**
 * Full Dashboard.jsx
 *
 * - Keeps original features: matches, topup, withdraw, admin approvals
 * - Adds 19-level badge system (images live in /public/)
 * - Persists xp & coin changes to Firestore (under users/<uid>)
 * - ClaimDaily: +1 coin (once per day)
 * - WatchAd: +2 coins and +2 XP (max 3 ads/day)
 * - JoinMatch: deduct entryFee in coins and +10 XP
 * - Booyah (award): +50 XP
 * - Level-up popup when level increases
 *
 * Make sure badge images exist in /public with the exact filenames.
 */

/* ---------- Helper: level data ---------- */
const LEVELS = [
  { name: "Bronze I", max: 300, icon: "/bronze1.jpg" },
  { name: "Bronze II", max: 700, icon: "/bronze2.jpg" },
  { name: "Bronze III", max: 1300, icon: "/bronze3.jpg" },
  { name: "Silver I", max: 2100, icon: "/silver1.jpg" },
  { name: "Silver II", max: 3100, icon: "/silver2.jpg" },
  { name: "Silver III", max: 4500, icon: "/silver3.jpg" },
  { name: "Gold I", max: 6500, icon: "/gold1.jpg" },
  { name: "Gold II", max: 9000, icon: "/gold2.jpg" },
  { name: "Gold III", max: 12000, icon: "/gold3.jpg" },
  { name: "Gold IV", max: 15000, icon: "/gold4.jpg" },
  { name: "Platinum I", max: 19000, icon: "/platinum1.jpg" },
  { name: "Platinum II", max: 24000, icon: "/platinum2.jpg" },
  { name: "Platinum III", max: 30000, icon: "/platinum3.jpg" },
  { name: "Platinum IV", max: 38000, icon: "/platinum4.jpg" },
  { name: "Diamond I", max: 47000, icon: "/diamond1.jpg" },
  { name: "Diamond II", max: 58000, icon: "/diamond2.jpg" },
  { name: "Diamond III", max: 71000, icon: "/diamond3.jpg" },
  { name: "Diamond IV", max: 90000, icon: "/diamond4.jpg" },
  { name: "Heroic", max: Infinity, icon: "/heroic.jpg" },
];

function computeXP(profile) {
  // XP derived from coins + matchesPlayed + kills (if provided)
  // We also persist xp separately (profile.xp) so incremental changes are stored.
  // But to compute current effective XP for level detection, prefer profile.xp if present.
  const baseFromFields = (profile?.xp) ?? null;
  if (baseFromFields !== null) return baseFromFields;

  const coins = profile?.coins ?? 0;
  const matches = profile?.matchesPlayed ?? 0;
  const kills = profile?.kills ?? 0;
  return coins + matches * 50 + kills * 10;
}

function getLevelForXP(xp) {
  let idx = 0;
  while (idx < LEVELS.length && xp >= LEVELS[idx].max) idx++;
  // idx points to first level with max > xp, but we want that as current
  const cur = LEVELS[Math.min(idx, LEVELS.length - 1)];
  const prevMax = idx === 0 ? 0 : LEVELS[idx - 1].max;
  const range = cur.max === Infinity ? cur.max - prevMax || 1 : cur.max - prevMax;
  const progress = cur.max === Infinity ? 100 : Math.max(0, Math.min(100, ((xp - prevMax) / range) * 100));
  const levelNum = Math.min(idx + 1, LEVELS.length);
  return {
    levelNum,
    name: cur.name,
    icon: cur.icon,
    xp,
    next: cur.max,
    progress,
    prevMax,
  };
}

/* ---------- Component ---------- */
export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI states
  const [activeTab, setActiveTab] = useState("home");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // topup/withdraw UI
  const [topupAmount, setTopupAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [paymentUpiId, setPaymentUpiId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawUpi, setWithdrawUpi] = useState("");

  // admin requests
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });

  // matches
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  // UX & forms
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [modalMessage, setModalMessage] = useState(null);

  // level-up popup
  const [levelUpInfo, setLevelUpInfo] = useState(null); // {levelNum, name, icon}

  // ad limits
  const AD_DAILY_LIMIT = 3;

  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";

  /* ---------- Load profile ---------- */
  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        setLoading(true);
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          // ensure xp field exists (we will persist xp separately)
          if (data.xp === undefined) data.xp = computeXP(data);
          if (mounted) {
            setProfile({ id: snap.id, ...data });
            setNewDisplayName(data.displayName || "");
            setNewUsername(data.username || "");
          }
        } else {
          const initialData = {
            email: user.email,
            coins: 0,
            matchesPlayed: 0,
            kills: 0,
            booyahs: 0,
            xp: 0,
            lastDaily: null,
            lastAdDates: [], // store dates for daily ad counting
            referralCode: user.uid.substring(0, 8).toUpperCase(),
            hasRedeemedReferral: false,
            createdAt: serverTimestamp(),
          };
          await setDoc(ref, initialData);
          const s = await getDoc(ref);
          if (mounted) {
            setProfile({ id: s.id, ...s.data() });
            setNewDisplayName(initialData.displayName || "");
            setNewUsername(initialData.username || "");
          }
        }

        // if admin, load pending requests
        if (mounted) {
          const dataSnapTopup = await getDocs(query(collection(db, "topupRequests"), where("status", "==", "pending")));
          const dataSnapWithdraw = await getDocs(query(collection(db, "withdrawRequests"), where("status", "==", "pending")));
          setRequests({
            topup: dataSnapTopup.docs.map((d) => ({ id: d.id, ...d.data() })),
            withdraw: dataSnapWithdraw.docs.map((d) => ({ id: d.id, ...d.data() })),
          });
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
        setModalMessage("Error loading profile. Check console.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => (mounted = false);
  }, [user.uid, user.email]);

  /* ---------- Level detection and level-up animation ---------- */
  // compute current level from profile.xp
  const levelData = getLevelForXP(profile?.xp ?? computeXP(profile ?? {}));

  // Detect when level increases and show popup
  const prevLevelRef = useRef(levelData.levelNum);
  useEffect(() => {
    if (!profile) return;
    const currentLevel = getLevelForXP(profile.xp ?? computeXP(profile)).levelNum;
    const prevLevel = prevLevelRef.current || 0;
    if (currentLevel > prevLevel) {
      // show level up popup
      const ld = getLevelForXP(profile.xp ?? computeXP(profile));
      setLevelUpInfo({ levelNum: ld.levelNum, name: ld.name, icon: ld.icon });
      setTimeout(() => setLevelUpInfo(null), 3500); // auto hide after 3.5s
    }
    prevLevelRef.current = currentLevel;
  }, [profile?.xp]);

  /* ---------- Helper functions: persist small updates ---------- */
  async function safeUpdateUser(fields) {
    try {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, fields);
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error("safeUpdateUser failed", err);
      setModalMessage("Failed to update user (see console).");
    }
  }

  /* ---------- Coins & XP functions ---------- */
  // Add coins (and optionally xp)
  async function addCoinsAndXP({ coins = 0, xp = 0 }) {
    if (!profile) return;
    const newCoins = (profile.coins || 0) + coins;
    const newXP = (profile.xp || 0) + xp;
    await safeUpdateUser({ coins: newCoins, xp: newXP });
  }

  // Claim daily (coins + xp); only once per day
  async function claimDaily() {
    if (!profile) return;
    const last = profile.lastDaily && typeof profile.lastDaily.toDate === "function" ? profile.lastDaily.toDate() : profile.lastDaily ? new Date(profile.lastDaily) : null;
    const now = new Date();
    const isSameDay = last && last.toDateString() === now.toDateString();
    if (isSameDay) {
      setModalMessage("You already claimed today's reward.");
      return;
    }

    try {
      // give +1 coin and +1 XP
      await safeUpdateUser({
        coins: (profile.coins || 0) + 1,
        xp: (profile.xp || 0) + 1,
        lastDaily: serverTimestamp(),
      });
      setModalMessage("+1 coin and +1 XP credited for daily login!");
    } catch (err) {
      console.error("claimDaily error", err);
      setModalMessage("Failed to claim daily reward.");
    }
  }

  // Watch ad (limit daily to 3)
  async function watchAd() {
    if (!profile) return;
    // compute today's date string
    const today = new Date().toISOString().split("T")[0];
    const lastAdDates = profile.lastAdDates || []; // array of date strings for ads watched
    const todayCount = lastAdDates.filter((d) => d === today).length;
    if (todayCount >= AD_DAILY_LIMIT) {
      setModalMessage(`Ad limit reached for today (${AD_DAILY_LIMIT}).`);
      return;
    }

    try {
      // update lastAdDates append today
      const updatedDates = [...lastAdDates, today];
      const newCoins = (profile.coins || 0) + 2; // +2 coins per ad
      const newXP = (profile.xp || 0) + 2; // +2 XP per ad
      await safeUpdateUser({ lastAdDates: updatedDates, coins: newCoins, xp: newXP });
      setModalMessage("+2 coins and +2 XP for watching ad!");
    } catch (err) {
      console.error("watchAd error", err);
      setModalMessage("Failed to record ad watch.");
    }
  }

  /* ---------- Topup flow ---------- */
  function topupAmountToCoins(amountInRupee) {
    // As per your economy: 1 ₹ = 10 coins
    return Math.floor(amountInRupee * 10);
  }

  async function handleTopupSubmit() {
    const amt = parseInt(selectedAmount || topupAmount);
    if (!amt || amt < 20) {
      setModalMessage("Minimum top-up is ₹20.");
      return;
    }
    try {
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: amt,
        coins: topupAmountToCoins(amt),
        upiId: paymentUpiId || null,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setModalMessage("Top-up request submitted. Admin will verify soon.");
      setTopupAmount("");
      setSelectedAmount(null);
      setPaymentUpiId("");
      setActiveTab("home");
    } catch (err) {
      console.error("handleTopupSubmit error", err);
      setModalMessage("Failed to submit top-up.");
    }
  }

  /* ---------- Withdraw flow (10% commission) ----------
     As you wanted: e.g., ₹500 -> coins needed: 550 (10% commission)
     We deduct coins immediately on submit.
  */
  async function handleWithdrawSubmit() {
    const amt = parseInt(withdrawAmount);
    if (!amt || amt < 50) {
      setModalMessage("Minimum withdrawal is ₹50.");
      return;
    }
    if (!withdrawUpi) {
      setModalMessage("Please enter your UPI ID.");
      return;
    }
    const requiredCoins = Math.ceil(amt * 1.1); // +10%
    if ((profile.coins || 0) < requiredCoins) {
      setModalMessage(`You need ${requiredCoins} coins to withdraw ₹${amt} (10% commission).`);
      return;
    }

    try {
      await addDoc(collection(db, "withdrawRequests"), {
        userId: user.uid,
        email: profile.email,
        upiId: withdrawUpi,
        amount: amt,
        coinsDeducted: requiredCoins,
        status: "pending",
        createdAt: serverTimestamp(),
        method: "UPI",
      });

      // Deduct coins locally & persist
      await safeUpdateUser({ coins: (profile.coins || 0) - requiredCoins });
      setModalMessage(`Withdrawal request submitted: ₹${amt} (coins deducted: ${requiredCoins}).`);
      setWithdrawAmount("");
      setWithdrawUpi("");
      setActiveTab("home");
    } catch (err) {
      console.error("handleWithdrawSubmit error", err);
      setModalMessage("Failed to submit withdrawal request.");
    }
  }

  /* ---------- Admin actions: approve/reject ---------- */
  async function approveRequest(type, req) {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "approved" });

      if (type === "topup") {
        // credit user coins
        const userRef = doc(db, "users", req.userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const currentCoins = snap.data().coins || 0;
          await updateDoc(userRef, { coins: currentCoins + (req.coins || 0) });
        }
      } else if (type === "withdraw") {
        // admin will pay via UPI externally; nothing to change
      }

      // remove from local UI
      setRequests((prev) => ({ ...prev, [type]: prev[type].filter((r) => r.id !== req.id) }));
      setModalMessage(`${type} request approved.`);
    } catch (err) {
      console.error("approveRequest error", err);
      setModalMessage("Failed to approve request.");
    }
  }

  async function rejectRequest(type, req) {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "rejected" });
      setRequests((prev) => ({ ...prev, [type]: prev[type].filter((r) => r.id !== req.id) }));
      setModalMessage(`${type} request rejected.`);
    } catch (err) {
      console.error("rejectRequest error", err);
      setModalMessage("Failed to reject request.");
    }
  }

  /* ---------- Matches (user join) ---------- */
  // load matches when matches tab active
  useEffect(() => {
    if (activeTab !== "matches") return;
    let mounted = true;
    async function loadMatches() {
      try {
        setLoadingMatches(true);
        const matchesRef = collection(db, "matches");
        const q = query(matchesRef, where("status", "==", "upcoming"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (mounted) setMatches(data);
      } catch (err) {
        console.error("loadMatches error", err);
        setModalMessage("Failed to load matches.");
      } finally {
        if (mounted) setLoadingMatches(false);
      }
    }
    loadMatches();
    return () => (mounted = false);
  }, [activeTab]);

  async function handleJoinMatch(match) {
    if (!profile) return;
    if (!profile.username) {
      setModalMessage("Set your in-game username before joining.");
      setShowUsernameModal(true);
      return;
    }

    const entryFee = match.entryFee || 0;
    if ((profile.coins || 0) < entryFee) {
      setModalMessage("You don't have enough coins to join.");
      return;
    }

    const alreadyJoined = (match.playersJoined || []).includes(user.uid);
    if (alreadyJoined) {
      setModalMessage("You already joined this match.");
      return;
    }

    // check capacity
    if ((match.playersJoined || []).length >= (match.maxPlayers || 0)) {
      setModalMessage("Match is full.");
      return;
    }

    try {
      // deduct coins, add xp (join reward)
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        coins: (profile.coins || 0) - entryFee,
        xp: (profile.xp || 0) + 10,
      });

      // update match players list
      const matchRef = doc(db, "matches", match.id);
      await updateDoc(matchRef, { playersJoined: arrayUnion(user.uid) });

      // update UI
      const s = await getDoc(userRef);
      setProfile({ id: s.id, ...s.data() });

      // local matches update
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, playersJoined: [...(m.playersJoined || []), user.uid] } : m)));
      setModalMessage("Joined match! +10 XP awarded.");
    } catch (err) {
      console.error("handleJoinMatch error", err);
      setModalMessage("Failed to join match.");
    }
  }

  /* ---------- Username & display name ---------- */
  async function handleSetUsername(e) {
    e.preventDefault();
    if (!newUsername) return setModalMessage("Username cannot be blank.");
    try {
      await updateDoc(doc(db, "users", user.uid), { username: newUsername });
      setProfile((p) => ({ ...p, username: newUsername }));
      setShowUsernameModal(false);
      setModalMessage("Username saved.");
    } catch (err) {
      console.error("handleSetUsername error", err);
      setModalMessage("Failed to save username.");
    }
  }

  async function handleUpdateDisplayName(e) {
    e.preventDefault();
    if (!newDisplayName) return setModalMessage("Display name cannot be blank.");
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newDisplayName });
      }
      await updateDoc(doc(db, "users", user.uid), { displayName: newDisplayName });
      setProfile((p) => ({ ...p, displayName: newDisplayName }));
      setModalMessage("Display name updated.");
    } catch (err) {
      console.error("handleUpdateDisplayName error", err);
      setModalMessage("Failed to update display name.");
    }
  }

  /* ---------- Small UI helpers ---------- */
  function shortenEmail(e) {
    if (!e) return "";
    return e.length > 28 ? e.slice(0, 24) + "..." : e;
  }

  /* ---------- Inline styles for popup & progress (so you don't need stylesheet changes) ---------- */
  // Inject minimal styles once
  useEffect(() => {
    if (document.getElementById("dashboard-inline-styles")) return;
    const style = document.createElement("style");
    style.id = "dashboard-inline-styles";
    style.innerHTML = `
      /* Level-up popup */
      .levelup-popup {
        position: fixed;
        left: 50%;
        top: 18%;
        transform: translateX(-50%) translateY(-10px);
        background: linear-gradient(135deg, rgba(255,192,0,0.15), rgba(255,255,255,0.03));
        border: 1px solid rgba(255,255,255,0.08);
        padding: 18px 22px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        gap: 14px;
        z-index: 9999;
        backdrop-filter: blur(6px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.6);
        animation: levpop 0.45s cubic-bezier(.16,.84,.35,1);
      }
      @keyframes levpop {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.95); }
        60% { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1.03); }
        100% { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1); }
      }
      .levelup-popup img { width: 64px; height: 64px; border-radius: 10px; object-fit: cover; }
      .levelup-popup h4 { margin: 0; font-size: 1.05rem; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,0.6);}
      .levelup-popup p { margin: 0; color: #cfeecf; font-size: 0.9rem; }
      /* progress bar */
      .level-display { display:flex; gap:14px; align-items:center; }
      .level-badge { width:72px; height:72px; border-radius:12px; object-fit:cover; }
      .progress-bar { width:220px; height:10px; border-radius:999px; background: rgba(255,255,255,0.08); overflow:hidden; margin-top:8px; }
      .progress-fill { height:100%; background: linear-gradient(90deg,#ffd54f,#ff9100); transition: width 0.6s ease; }
      /* modern small UI tweaks */
      .modern-card { background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent); padding:14px; border-radius:12px; border:1px solid rgba(255,255,255,0.03); }
      .muted-small { color: #bfc7d1; font-size:0.9rem; }
      .center-screen { height:100vh; display:flex; align-items:center; justify-content:center; color:#fff; background:#000; }
    `;
    document.head.appendChild(style);
  }, []);

  /* ---------- Rendering ---------- */
  if (loading || !profile) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="dash-root">
      <audio ref={audioRef} src="/bgm.mp3" loop />
      <video className="bg-video" autoPlay loop muted playsInline style={{ zIndex: -10 }}>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      {/* Header */}
      <header className="dash-header">
        <div className="logo-row">
          <img src="/icon.jpg" alt="logo" className="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">{profile.username || profile.displayName || shortenEmail(profile.email)}</div>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn small ghost" onClick={() => {
            if (!audioRef.current) return;
            if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
            setIsPlaying(!isPlaying);
          }}>
            {isPlaying ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>

          {profile.email === adminEmail && (
            <button className="btn small" onClick={() => setActiveTab("admin")}>Admin Panel</button>
          )}

          <button className="btn small ghost" onClick={async () => { await signOut(auth); navigate("/login"); }}>
            Logout
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="dash-main">
        {/* Home */}
        {activeTab === "home" && (
          <>
            <section className="panel">
              <div className="panel-row" style={{ alignItems: "center" }}>
                <div>
                  <div className="muted">Coins</div>
                  <div className="big" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <img src="/coin.jpg" alt="coin" style={{ width: 36, height: 36, borderRadius: "50%", animation: "spinCoin 2s linear infinite" }} />
                    <div style={{ fontWeight: 800, fontSize: 22 }}>{profile.coins ?? 0}</div>
                  </div>
                  <div className="muted-small">XP: {Math.floor(profile.xp ?? computeXP(profile))}</div>
                </div>

                <div>
                  <button className="btn" onClick={claimDaily}>Claim Daily (+1 coin)</button>
                  <button className="btn ghost" onClick={watchAd}>Watch Ad (+2 coins)</button>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Welcome</h3>
              <p>Check Matches tab to join games, or use Top-up to add coins.</p>
            </section>
          </>
        )}

        {/* Matches */}
        {activeTab === "matches" && (
          <>
            <section className="panel">
              <h3>Available Matches</h3>
              {loadingMatches ? <p>Loading matches…</p> : null}
              {!loadingMatches && matches.length === 0 && <p>No upcoming matches.</p>}

              <div className="grid">
                {matches.map((m) => {
                  const hasJoined = (m.playersJoined || []).includes(user.uid);
                  const isFull = (m.playersJoined || []).length >= (m.maxPlayers || 0);
                  return (
                    <div key={m.id} className="match-card" style={{ cursor: "pointer" }}>
                      <img src={m.imageUrl || "/bt.jpg"} alt={m.title} />
                      <div className="match-info">
                        <div className="match-title">{m.title}</div>
                        <div className="match-meta">Start: {m.startTime ? new Date(m.startTime.seconds * 1000).toLocaleString() : "TBD"}</div>
                        <div className="match-meta">Entry: {m.entryFee || 0} coins • Joined: {(m.playersJoined || []).length}/{m.maxPlayers || "-"}</div>
                        <button className="btn" onClick={() => handleJoinMatch(m)} disabled={hasJoined || isFull}>
                          {hasJoined ? "Joined" : isFull ? "Full" : "Join"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Topup */}
        {activeTab === "topup" && (
          <section className="panel modern-card">
            <h3>Top-up Coins</h3>
            <p className="muted-small">1 ₹ = 10 Coins | Minimum ₹20</p>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              {[20, 50, 100, 200].map((amt) => (
                <div key={amt} className={`amount-btn ${selectedAmount === amt ? "selected" : ""}`} onClick={() => { setSelectedAmount(amt); setTopupAmount(""); }} style={{ padding: 12, borderRadius: 10, background: selectedAmount === amt ? "linear-gradient(90deg,#ff7a18,#ffb199)" : "rgba(255,255,255,0.03)", cursor: "pointer" }}>
                  <div style={{ fontWeight: 700 }}>₹{amt}</div>
                  <div style={{ fontSize: 12 }}>{topupAmountToCoins(amt)} coins</div>
                </div>
              ))}
            </div>

            <input type="number" placeholder="Or enter custom amount ₹" value={topupAmount} onChange={(e) => { setTopupAmount(e.target.value); setSelectedAmount(null); }} className="field" style={{ marginTop: 12 }} />
            <input type="text" placeholder="Enter payment UPI ID (optional)" value={paymentUpiId} onChange={(e) => setPaymentUpiId(e.target.value)} className="field" style={{ marginTop: 8 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button className="btn glow" onClick={handleTopupSubmit}>Submit Top-up Request</button>
              <button className="btn ghost" onClick={() => { setSelectedAmount(null); setTopupAmount(""); setPaymentUpiId(""); }}>Clear</button>
            </div>
          </section>
        )}

        {/* Withdraw */}
        {activeTab === "withdraw" && (
          <section className="panel modern-card">
            <h3>Withdraw</h3>
            <p className="muted-small">10% commission. Minimum ₹50.</p>

            <input type="number" placeholder="Enter amount ₹" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="field" />
            <input type="text" placeholder="Enter your UPI ID" value={withdrawUpi} onChange={(e) => setWithdrawUpi(e.target.value)} className="field" />
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn glow" onClick={handleWithdrawSubmit}>Request Withdrawal</button>
              <button className="btn ghost" onClick={() => { setWithdrawAmount(""); setWithdrawUpi(""); }}>Clear</button>
            </div>
          </section>
        )}

        {/* Admin */}
        {activeTab === "admin" && profile.email === adminEmail && (
          <section className="panel">
            <h3>Admin Panel</h3>
            <h4>Top-up Requests</h4>
            {requests.topup.length === 0 ? <p className="muted-small">No pending top-up requests</p> : requests.topup.map((r) => (
              <div key={r.id} className="admin-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>{r.email} • ₹{r.amount} • {r.upiId || "—"}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn small" onClick={() => approveRequest("topup", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("topup", r)}>Reject</button>
                </div>
              </div>
            ))}

            <h4 style={{ marginTop: 20 }}>Withdraw Requests</h4>
            {requests.withdraw.length === 0 ? <p className="muted-small">No pending withdraw requests</p> : requests.withdraw.map((r) => (
              <div key={r.id} className="admin-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>{r.email} • ₹{r.amount} • {r.upiId || r.type || "—"}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn small" onClick={() => approveRequest("withdraw", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("withdraw", r)}>Reject</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Account */}
        {activeTab === "account" && (
          <div className="account-container">
            <section className="panel account-profile-card">
              <div className="level-display">
                <img src={levelData.icon} alt="badge" className="level-badge" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{profile.displayName || profile.email}</div>
                  <div className="muted-small">{profile.email}</div>
                  <div style={{ marginTop: 8, fontWeight: 700, color: "#ffd54f" }}>Level {levelData.levelNum} — {levelData.name}</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${levelData.progress}%` }} />
                  </div>
                  <div className="muted-small" style={{ marginTop: 6 }}>{Math.floor(levelData.xp)} XP</div>
                </div>
              </div>
            </section>

            <section className="panel account-menu">
              <button className="account-option" onClick={() => { setActiveTab("topup"); }}>
                <FaGift size={18} /> <span>Top-up</span>
              </button>

              <button className="account-option" onClick={() => { setActiveTab("withdraw"); }}>
                <FaMoneyBillWave size={18} /> <span>Withdraw</span>
              </button>

              <button className="account-option" onClick={() => setShowUsernameModal(true)}>
                <FaUserEdit size={18} /> <span>Edit In-Game Username</span>
              </button>

              <button className="account-option logout" onClick={handleLogout}>
                <FaSignOutAlt size={18} /> <span>Logout</span>
              </button>
            </section>

            {/* Profile edit area */}
            <section className="panel" style={{ marginTop: 12 }}>
              <h4>Profile Settings</h4>
              <form onSubmit={handleUpdateDisplayName}>
                <label>Display Name</label>
                <input className="field" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
                <button className="btn" type="submit" style={{ marginTop: 8 }}>Save Name</button>
              </form>
            </section>
          </div>
        )}

      </main>

      {/* Footer nav */}
      <footer className="bottom-nav">
        {["home", "matches", "topup", "withdraw", "account", "admin"].map((tab) => {
          // hide admin button from non-admins in footer (but admin button above header exists)
          if (tab === "admin" && profile.email !== adminEmail) return null;
          return (
            <button key={tab} className={`nav-btn ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          );
        })}
      </footer>

      {/* Username modal */}
      {showUsernameModal && (
        <div className="modal-overlay" onClick={() => setShowUsernameModal(false)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3>{profile.username ? "Edit Username" : "Set In-game Username"}</h3>
            <input className="field" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn" onClick={handleSetUsername}>Save</button>
              <button className="btn ghost" onClick={() => setShowUsernameModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Level-up popup */}
      {levelUpInfo && (
        <div className="levelup-popup" role="status" aria-live="polite">
          <img src={levelUpInfo.icon} alt={levelUpInfo.name} />
          <div>
            <h4>Level Up! 🎉</h4>
            <p>You reached {levelUpInfo.name} (Level {levelUpInfo.levelNum})</p>
          </div>
        </div>
      )}

      {/* Modal message */}
      {modalMessage && (
        <div className="modal-overlay" onClick={() => setModalMessage(null)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3>Notice</h3>
            <p>{modalMessage}</p>
            <button className="btn glow large" onClick={() => setModalMessage(null)}>OK</button>
          </div>
        </div>
      )}

    </div>
  );
}
