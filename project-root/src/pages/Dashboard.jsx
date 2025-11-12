// src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase"; // do not require appCheckInstance here
import { signOut, updateProfile, sendPasswordResetEmail } from "firebase/auth";
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
import { getToken } from "firebase/app-check"; // used only if appCheckInstance exists in firebase
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

import MatchHistoryPage from "./MatchHistoryPage";
import WithdrawalHistoryPage from "./WithdrawalHistoryPage";

const initialMatchState = {
  title: "",
  type: "BR",
  imageUrl: "",
  entryFee: 200,
  maxPlayers: 48,
  prizeModel: "Scalable",
  commissionPercent: 15,
  perKillReward: 75,
  booyahPrize: 0,
  teamType: "Solo",
  startTime: "",
  rules: "",
};

const rewardOptions = [
  { type: "UPI", amount: 50, cost: 550, icon: "/upi.png" },
  { type: "UPI", amount: 100, cost: 1100, icon: "/upi.png" },
  { type: "UPI", amount: 200, cost: 2200, icon: "/upi.png" },
  { type: "Google Play", amount: 50, cost: 550, icon: "/google-play.png" },
  { type: "Amazon", amount: 50, cost: 550, icon: "/amazon.png" },
];

// LEVELS: 18 levels thresholds (XP = coins here). Tweak thresholds as needed.
const LEVELS = [
  { name: "Bronze I", icon: "/bronze1.jpg", min: 0 },
  { name: "Bronze II", icon: "/bronze2.jpg", min: 100 },
  { name: "Bronze III", icon: "/bronze3.jpg", min: 250 },

  { name: "Silver I", icon: "/silver1.jpg", min: 500 },
  { name: "Silver II", icon: "/silver2.jpg", min: 800 },
  { name: "Silver III", icon: "/silver3.jpg", min: 1200 },

  { name: "Gold I", icon: "/gold1.jpg", min: 1700 },
  { name: "Gold II", icon: "/gold2.jpg", min: 2300 },
  { name: "Gold III", icon: "/gold3.jpg", min: 3000 },
  { name: "Gold IV", icon: "/gold4.jpg", min: 3800 },

  { name: "Platinum I", icon: "/platinum1.jpg", min: 4700 },
  { name: "Platinum II", icon: "/platinum2.jpg", min: 5700 },
  { name: "Platinum III", icon: "/platinum3.jpg", min: 6900 },
  { name: "Platinum IV", icon: "/platinum4.jpg", min: 8300 },

  { name: "Diamond I", icon: "/diamond1.jpg", min: 9900 },
  { name: "Diamond II", icon: "/diamond2.jpg", min: 11800 },
  { name: "Diamond III", icon: "/diamond3.jpg", min: 14000 },
  { name: "Heroic", icon: "/heroic.jpg", min: 16500 },
];

// reward configuration
const DAILY_REWARD = 1; // +1 coin
const AD_REWARD = 2; // +2 coins per ad
const AD_MAX_PER_DAY = 10;

function formatMatchTime(ts) {
  if (!ts || typeof ts.toDate !== "function") return "TBD";
  return ts.toDate().toLocaleString();
}

function calculateLevel(coins) {
  // find highest level with min <= coins
  let levelIndex = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (coins >= LEVELS[i].min) levelIndex = i;
    else break;
  }
  const level = LEVELS[levelIndex];
  // xp progress to next level
  const next = LEVELS[levelIndex + 1];
  const currentMin = level.min;
  const nextMin = next ? next.min : currentMin + 1000;
  const progress = Math.min(1, (coins - currentMin) / (nextMin - currentMin));
  return { index: levelIndex, level, progress, nextMin, currentMin };
}

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [newMatch, setNewMatch] = useState(initialMatchState);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [accountView, setAccountView] = useState("main");
  const [referralInput, setReferralInput] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [adLoading, setAdLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState(null);
  const [topupView, setTopupView] = useState("select");
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [paymentUpiId, setPaymentUpiId] = useState("");
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });
  const [showLevelPopup, setShowLevelPopup] = useState(false);
  const [levelUpData, setLevelUpData] = useState(null);
  const navigate = useNavigate();

  const adminEmail = "esportsimperial50@gmail.com";

  // local daily/ad usage tracking stored in localStorage to avoid server changes
  useEffect(() => {
    // initialize user doc if necessary
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          // create referral code if missing
          if (!data.referralCode) {
            const code = user.uid.slice(0, 8).toUpperCase();
            await updateDoc(ref, { referralCode: code, hasRedeemedReferral: data.hasRedeemedReferral || false });
            setProfile({ id: snap.id, ...data, referralCode: code });
            setNewUsername(data.username || "");
          } else {
            setProfile({ id: snap.id, ...data });
            setNewUsername(data.username || "");
          }
        } else {
          const newReferralCode = user.uid.slice(0, 8).toUpperCase();
          const initialData = {
            email: user.email,
            coins: 0,
            displayName: user.displayName || "",
            username: "",
            lastDaily: null,
            createdAt: serverTimestamp(),
            referralCode: newReferralCode,
            hasRedeemedReferral: false,
            upiId: "",
          };
          await setDoc(ref, initialData);
          setProfile({ id: ref.id, ...initialData });
          setNewUsername(initialData.username);
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
        setModalMessage("Failed to load profile. See console.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [user.uid, user.email, user.displayName]);

  // load upcoming matches when tab selected
  useEffect(() => {
    async function loadMatches() {
      setLoadingMatches(true);
      try {
        const matchesRef = collection(db, "matches");
        const q = query(matchesRef, where("status", "==", "upcoming"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error loading matches:", err);
      } finally {
        setLoadingMatches(false);
      }
    }
    if (activeTab === "matches") loadMatches();
  }, [activeTab]);

  // admin: load requests and upcoming matches for admin
  useEffect(() => {
    if (profile?.email !== adminEmail) return;
    (async () => {
      try {
        const topupQuery = query(collection(db, "topupRequests"), where("status", "==", "pending"));
        const withdrawQuery = query(collection(db, "withdrawRequests"), where("status", "==", "pending"));
        const matchesQuery = query(collection(db, "matches"), where("status", "==", "upcoming"), orderBy("createdAt", "desc"));

        const [topupSnap, withdrawSnap, matchesSnap] = await Promise.all([
          getDocs(topupQuery),
          getDocs(withdrawQuery),
          getDocs(matchesQuery),
        ]);

        setRequests({
          topup: topupSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          withdraw: withdrawSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
        setMatches(matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Admin fetch error:", err);
      }
    })();
  }, [profile?.email, activeTab]);

  // helper to update local profile after coin change
  const updateLocalCoins = (newCoins, alsoShowLevelUp = true) => {
    if (!profile) return;
    const prevCoins = profile.coins || 0;
    const prevLvl = calculateLevel(prevCoins).index;
    const newLvl = calculateLevel(newCoins).index;
    setProfile((p) => ({ ...p, coins: newCoins }));
    if (alsoShowLevelUp && newLvl > prevLvl) {
      const lvlInfo = calculateLevel(newCoins);
      setLevelUpData({ prevLevelIndex: prevLvl, newLevelIndex: newLvl, lvlInfo });
      setShowLevelPopup(true);
      setTimeout(() => setShowLevelPopup(false), 4200);
    }
  };

  // add coins util (write to firestore + local)
  const addCoin = async (n = 1) => {
    if (!profile) return;
    try {
      const ref = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) + n;
      await updateDoc(ref, { coins: newCoins });
      updateLocalCoins(newCoins);
    } catch (err) {
      console.error("addCoin error:", err);
      setModalMessage("Failed to add coins.");
    }
  };

  // claim daily
  const claimDaily = async () => {
    if (!profile) return;
    // check lastDaily
    const last =
      profile.lastDaily && typeof profile.lastDaily.toDate === "function" ? profile.lastDaily.toDate() : null;
    const now = new Date();
    const isSameDay = last && last.toDateString() === now.toDateString();
    if (isSameDay) return setModalMessage("You already claimed today's coin.");
    try {
      const ref = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) + DAILY_REWARD;
      await updateDoc(ref, { coins: newCoins, lastDaily: serverTimestamp() });
      updateLocalCoins(newCoins);
      setModalMessage(`+${DAILY_REWARD} coin credited!`);
    } catch (err) {
      console.error("Daily claim error:", err);
      setModalMessage("Failed to claim daily. Try again.");
    }
  };

  // ad watch with limit per day using localStorage
  const watchAd = async () => {
    if (adLoading) return;
    if (!window.adsbygoogle && !window.adbreak) {
      // if ad SDK not available, gracefully inform
      setModalMessage("Ads are not currently available.");
      return;
    }

    // daily limit using localStorage keyed by date+uid
    const key = `ads_used_${user.uid}_${new Date().toISOString().slice(0, 10)}`;
    const used = parseInt(localStorage.getItem(key) || "0", 10);
    if (used >= AD_MAX_PER_DAY) return setModalMessage("Ad limit reached for today.");

    setAdLoading(true);
    try {
      // use ad provider if available. We keep the same callback pattern used earlier but simplified
      if (window.adbreak) {
        window.adbreak({
          type: "reward",
          name: "watch-ad-reward",
          adBreakDone: (placementInfo) => {
            // check placementInfo or assume success if reached here
            const succeeded =
              !placementInfo || placementInfo.breakStatus === "viewed" || placementInfo.breakStatus === "dismissed";
            if (succeeded) {
              addCoin(AD_REWARD);
              localStorage.setItem(key, `${used + 1}`);
              setModalMessage(`+${AD_REWARD} coins for watching the ad!`);
            } else {
              setModalMessage("Ad failed to deliver reward.");
            }
            setAdLoading(false);
          },
          beforeReward: (showAdFn) => {
            // we still grant only after adBreakDone
            showAdFn();
          },
        });
      } else {
        // fallback (maybe google adsense) - just grant but still increment (for dev/testing)
        // In prod you probably should require a real ad event before granting.
        addCoin(AD_REWARD);
        localStorage.setItem(key, `${used + 1}`);
        setModalMessage(`+${AD_REWARD} coins (demo)`);
        setAdLoading(false);
      }
    } catch (err) {
      console.error("Ad error:", err);
      setModalMessage("Ad error occurred.");
      setAdLoading(false);
    }
  };

  // Topup handlers (Pay flow shows QR and requires UPI id)
  const handleTopup = () => {
    const amt = parseInt(selectedAmount || topupAmount, 10);
    if (!amt || amt < 20) return setModalMessage("Minimum top-up is ₹20.");
    setTopupView("pay");
  };

  const handleConfirmPayment = async () => {
    const amt = parseInt(selectedAmount || topupAmount, 10);
    if (!amt) return setModalMessage("Invalid amount.");
    if (!paymentUpiId) return setModalMessage("Please enter your UPI ID to verify payment.");
    try {
      setLoading(true);
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: amt,
        coins: amt * 10,
        upiId: paymentUpiId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setModalMessage("Top-up request submitted! Admin will verify it soon.");
      setTopupAmount("");
      setSelectedAmount(null);
      setPaymentUpiId("");
      setTopupView("select");
      setActiveTab("home");
    } catch (err) {
      console.error("Topup submit error:", err);
      setModalMessage("Failed to submit top-up. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Withdraw
  const handleRedeemReward = async (reward) => {
    if (!profile) return;
    if ((profile.coins || 0) < reward.cost) return setModalMessage("You don't have enough coins.");
    if (reward.type === "UPI") {
      // require UPI set in profile or ask user to enter and save to profile
      if (!profile.upiId) {
        const upi = window.prompt(`Enter your UPI ID to receive ₹${reward.amount}:`);
        if (!upi) return setModalMessage("UPI is required for UPI withdrawals.");
        // save to profile
        try {
          setLoading(true);
          const userDoc = doc(db, "users", user.uid);
          await updateDoc(userDoc, { upiId: upi });
          setProfile((p) => ({ ...p, upiId: upi }));
        } catch (err) {
          console.error("Failed to save UPI:", err);
          setModalMessage("Failed to save UPI. Try again.");
          setLoading(false);
          return;
        }
      }
    } else {
      // gift card: ask optional email (default to profile email)
      const email = window.prompt("Enter email to receive the gift card (optional):", profile.email || "");
      // email is optional; we'll store it in the request if provided
      try {
        setLoading(true);
        await addDoc(collection(db, "withdrawRequests"), {
          userId: user.uid,
          email: profile.email,
          amount: reward.amount,
          coinsDeducted: reward.cost,
          status: "pending",
          type: reward.type,
          upiId: reward.type === "UPI" ? profile.upiId || "" : "",
          deliveryEmail: email || null,
          createdAt: serverTimestamp(),
        });

        // deduct coins
        const userRef = doc(db, "users", user.uid);
        const newCoins = (profile.coins || 0) - reward.cost;
        await updateDoc(userRef, { coins: newCoins });
        updateLocalCoins(newCoins, false); // don't show level-up for withdraw
        setModalMessage("Withdrawal request submitted! Admin will process it shortly.");
      } catch (err) {
        console.error("Withdraw request error:", err);
        setModalMessage("Failed to create withdrawal request.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Join match
  const handleJoinMatch = async (match) => {
    if (!profile) return;
    if (!profile.username) {
      setModalMessage("Please set your in-game username before joining a match.");
      setShowUsernameModal(true);
      return;
    }

    const { entryFee, id: matchId, playersJoined = [], maxPlayers } = match;

    if (playersJoined.includes(user.uid)) {
      setSelectedMatch(match);
      return;
    }
    if ((playersJoined?.length || 0) >= maxPlayers) return setModalMessage("Match is full.");
    if ((profile.coins || 0) < entryFee) return setModalMessage("Not enough coins to join.");
    if (!window.confirm(`Join for ${entryFee} coins?`)) return;

    try {
      setLoading(true);
      const userDocRef = doc(db, "users", user.uid);
      const matchDocRef = doc(db, "matches", matchId);
      await updateDoc(userDocRef, { coins: (profile.coins || 0) - entryFee });
      await updateDoc(matchDocRef, { playersJoined: arrayUnion(user.uid) });
      updateLocalCoins((profile.coins || 0) - entryFee, false);
      // update matches state
      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, playersJoined: [...(m.playersJoined || []), user.uid] } : m)));
      setModalMessage("Joined match successfully!");
      setSelectedMatch({ ...match, playersJoined: [...(playersJoined || []), user.uid] });
    } catch (err) {
      console.error("Error joining match:", err);
      setModalMessage("Failed to join match.");
    } finally {
      setLoading(false);
    }
  };

  // Admin approve/reject
  const approveRequest = async (type, req) => {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "approved" });
      if (type === "topup") {
        const userRef = doc(db, "users", req.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const nc = (userSnap.data().coins || 0) + (req.coins || 0);
          await updateDoc(userRef, { coins: nc });
        }
      }
      setRequests((prev) => ({ ...prev, [type]: prev[type].filter((r) => r.id !== req.id) }));
      setModalMessage(`${type} request approved.`);
    } catch (err) {
      console.error("approve error:", err);
      setModalMessage("Approve failed.");
    }
  };
  const rejectRequest = async (type, req) => {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "rejected" });
      setRequests((prev) => ({ ...prev, [type]: prev[type].filter((r) => r.id !== req.id) }));
      setModalMessage(`${type} request rejected.`);
    } catch (err) {
      console.error("reject error:", err);
      setModalMessage("Reject failed.");
    }
  };

  // create match (admin)
  const handleCreateMatch = async (e) => {
    e.preventDefault();
    if (!newMatch.title || !newMatch.imageUrl || !newMatch.startTime) return setModalMessage("Title, Image and Start Time required.");
    try {
      setLoading(true);
      const md = {
        ...newMatch,
        startTime: new Date(newMatch.startTime),
        status: "upcoming",
        playersJoined: [],
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "matches"), md);
      setModalMessage("Match created.");
      setNewMatch(initialMatchState);
      setMatches((prev) => [{ ...md, id: "new" }, ...prev]);
    } catch (err) {
      console.error("create match err:", err);
      setModalMessage("Failed to create match.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetUsername = async (e) => {
    e.preventDefault();
    if (!newUsername) return setModalMessage("Username cannot be blank.");
    try {
      setLoading(true);
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { username: newUsername });
      setProfile((p) => ({ ...p, username: newUsername }));
      setShowUsernameModal(false);
      setModalMessage("Username saved.");
    } catch (err) {
      console.error("username save err:", err);
      setModalMessage("Failed to save username.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDisplayName = async (e) => {
    e.preventDefault();
    if (!profile) return setModalMessage("No profile.");
    try {
      setLoading(true);
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: profile.displayName });
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { displayName: profile.displayName });
      setModalMessage("Display name updated.");
    } catch (err) {
      console.error("update display name err:", err);
      setModalMessage("Failed to update name.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return setModalMessage("No email.");
    const providerIds = (auth.currentUser.providerData || []).map((p) => p.providerId);
    if (!providerIds.includes("password")) return setModalMessage("Signed in with Google. Password reset not available.");
    try {
      await sendPasswordResetEmail(auth, user.email);
      setModalMessage("Password reset email sent!");
    } catch (err) {
      console.error("password reset err:", err);
      setModalMessage("Failed to send reset email.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("logout err:", err);
      setModalMessage("Logout failed.");
    }
  };

  // Referral redeem integrator - will call serverless endpoint if exists
  const handleRedeemReferral = async () => {
    if (!referralInput) return setModalMessage("Enter referral code.");
    if (!profile || profile.hasRedeemedReferral) return setModalMessage("Already redeemed.");
    if (referralInput.toUpperCase() === profile.referralCode) return setModalMessage("Cannot use your own code.");
    setLoading(true);
    try {
      let appCheckToken = null;
      // ONLY attempt to use appCheck if firebase exports appCheckInstance
      let appCheckInstance;
      try {
        // dynamic require - if your firebase.js exports appCheckInstance, it will be used
        const fb = await import("../firebase");
        appCheckInstance = fb.appCheckInstance;
      } catch (_) {
        appCheckInstance = null;
      }
      if (appCheckInstance) {
        try {
          const t = await getToken(appCheckInstance, false);
          appCheckToken = t?.token;
        } catch (err) {
          console.warn("AppCheck token failed:", err);
          setModalMessage("Security check failed. Refresh and try again.");
          setLoading(false);
          return;
        }
      }
      const idToken = await user.getIdToken();
      // call serverless function on /api/redeemReferralCode if you have it configured
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` };
      if (appCheckToken) headers["X-Firebase-AppCheck"] = appCheckToken;
      const res = await fetch("/api/redeemReferralCode", {
        method: "POST",
        headers,
        body: JSON.stringify({ code: referralInput.toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        // server should credit both accounts: we just update local profile view
        const ref = doc(db, "users", user.uid);
        const newCoins = (profile.coins || 0) + 50; // assume you give friend 50
        await updateDoc(ref, { coins: newCoins, hasRedeemedReferral: true });
        setProfile((p) => ({ ...p, coins: newCoins, hasRedeemedReferral: true }));
        setModalMessage(data.message || "Referral redeemed!");
      } else {
        setModalMessage(data.message || "Referral failed.");
      }
    } catch (err) {
      console.error("redeem referral err:", err);
      setModalMessage("Referral error.");
    } finally {
      setLoading(false);
    }
  };

  // settle match (admin) - uses server function for fairness & payouts
  const handleSettleMatch = async (payload) => {
    // payload should contain matchId, winnerUsername, kills
    try {
      setLoading(true);
      // similar appCheck handling as above
      let appCheckToken = null;
      try {
        const fb = await import("../firebase");
        const appCheckInstance = fb.appCheckInstance;
        if (appCheckInstance) {
          const t = await getToken(appCheckInstance, false);
          appCheckToken = t?.token;
        }
      } catch (_) {}
      const idToken = await user.getIdToken();
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` };
      if (appCheckToken) headers["X-Firebase-AppCheck"] = appCheckToken;
      const res = await fetch("/api/settleMatch", { method: "POST", headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        setModalMessage(data.message || "Match settled.");
        // remove from matches locally
        setMatches((prev) => prev.filter((m) => m.id !== payload.matchId));
      } else {
        setModalMessage(data.message || "Settle failed.");
      }
    } catch (err) {
      console.error("settle match err:", err);
      setModalMessage("Settle error.");
    } finally {
      setLoading(false);
    }
  };

  // music toggle
  const toggleMusic = () => {
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  // UI render guards
  if (loading || !profile) return <div className="center">Loading Dashboard...</div>;

  // derived values
  const coins = profile.coins || 0;
  const lvl = calculateLevel(coins);

  return (
    <div className="dash-root">
      {/* Background + overlays */}
      <audio ref={audioRef} src="/bgm.mp3" loop />
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      {/* Header */}
      <header className="dash-header">
        <div className="logo-row">
          <img src="/icon.jpg" alt="logo" className="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">{profile.email}</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn small ghost music-btn" onClick={toggleMusic}>
            {isPlaying ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>
          {profile.email === adminEmail && (
            <button className="btn small" onClick={() => setActiveTab("admin")}>Admin Panel</button>
          )}
          <button className="btn small ghost" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="dash-main">
        {/* HOME */}
        {activeTab === "home" && (
          <>
            <section className="panel">
              <div className="panel-row">
                <div>
                  <div className="muted">Coins</div>
                  <div className="big coin-row" style={{ alignItems: "center", display: "flex", gap: 12 }}>
                    <img src="/coin.jpg" alt="coin" style={{ width: 36, height: 36, borderRadius: "50%", boxShadow: "0 6px 18px rgba(0,0,0,0.6)" }} />
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800 }}>{coins}</div>
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>XP: {coins}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button className="btn glow" onClick={claimDaily}>Claim Daily (+{DAILY_REWARD})</button>
                    <button className="btn glow" onClick={watchAd} disabled={adLoading}>
                      {adLoading ? "Loading..." : `Watch Ad (+${AD_REWARD})`}
                    </button>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <img src={lvl.level.icon} alt="level" style={{ width: 56, height: 56, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }} />
                      <div>
                        <div style={{ color: "var(--accent)", fontWeight: 700 }}>{lvl.level.name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{Math.round(lvl.progress * 100)}% to next</div>
                        <div style={{ height: 8, background: "rgba(255,255,255,0.04)", marginTop: 6, borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(lvl.progress * 100)}%`, height: "100%", background: "linear-gradient(90deg,var(--accent),var(--accent2))" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Welcome!</h3>
              <p>Check the Matches tab to join games. Use Top-up to add coins or Withdraw to redeem rewards.</p>
            </section>
          </>
        )}

        {/* MATCHES */}
        {activeTab === "matches" && (
          <>
            {!selectedMatch ? (
              <section className="panel">
                <h3>Available Matches</h3>
                {loadingMatches && <p>Loading matches...</p>}
                {!loadingMatches && matches.length === 0 && <p>No upcoming matches right now.</p>}
                <div className="grid">
                  {matches.map((match) => {
                    const hasJoined = match.playersJoined?.includes(user.uid);
                    const isFull = (match.playersJoined?.length || 0) >= match.maxPlayers;
                    return (
                      <div key={match.id} className="match-card" onClick={() => setSelectedMatch(match)}>
                        <img src={match.imageUrl} alt={match.title} />
                        <div className="match-info">
                          <div className="match-title">{match.title}</div>
                          <div className="match-meta">Starts: {formatMatchTime(match.startTime)}</div>
                          <div className="match-meta">Entry: {match.entryFee} Coins | Joined: {match.playersJoined?.length || 0}/{match.maxPlayers}</div>
                          <button className="btn" onClick={(e) => { e.stopPropagation(); handleJoinMatch(match); }} disabled={hasJoined || isFull}>
                            {hasJoined ? "Joined" : isFull ? "Full" : "Join"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="panel match-details-view">
                <div className="match-details-header">
                  <button className="back-btn" onClick={() => setSelectedMatch(null)}><FaArrowLeft /> Back to Matches</button>
                  <button className="btn small" onClick={() => setShowUsernameModal(true)}><FaUserEdit /> Edit Username</button>
                </div>
                <img src={selectedMatch.imageUrl} alt="match" className="match-details-image" />
                <h3 className="modern-title">{selectedMatch.title}</h3>
                <p className="match-details-time">Starts: {formatMatchTime(selectedMatch.startTime)}</p>

                {selectedMatch.playersJoined?.includes(user.uid) ? (
                  <div className="room-details pending"><p>You have joined! Room ID and Password will be revealed later.</p></div>
                ) : null}

                <div className="match-rules"><h4>Match Rules</h4><p>{selectedMatch.rules || "No rules provided."}</p></div>
              </section>
            )}
          </>
        )}

        {/* TOPUP */}
        {activeTab === "topup" && (
          <>
            {topupView === "select" && (
              <section className="modern-card">
                <h3 className="modern-title">Top-up Coins</h3>
                <p className="modern-subtitle">1 ₹ = 10 Coins | Minimum ₹20</p>
                <div className="amount-options">
                  {[20, 50, 100, 200].map((amt) => (
                    <div key={amt} className={`amount-btn ${selectedAmount === amt ? "selected" : ""}`} onClick={() => { setSelectedAmount(amt); setTopupAmount(""); }}>
                      ₹{amt} = {amt * 10} Coins
                    </div>
                  ))}
                </div>
                <input type="number" className="modern-input" placeholder="Or enter custom amount ₹" value={topupAmount} onChange={(e) => { setSelectedAmount(null); setTopupAmount(e.target.value); }} />
                <button className="btn glow large" onClick={handleTopup}>Pay</button>
              </section>
            )}

            {topupView === "pay" && (
              <section className="modern-card payment-page">
                <button className="back-btn" onClick={() => setTopupView("select")}><FaArrowLeft /> Back</button>
                <h3 className="modern-title">Scan & Pay</h3>
                <p className="modern-subtitle">Scan the QR and then enter your UPI ID so we can verify your payment.</p>
                <img src="/qr.jpg" alt="QR" className="qr-code-image" />
                <div className="form-group" style={{ marginTop: 24 }}>
                  <label>Enter Your UPI ID</label>
                  <input type="text" className="modern-input" placeholder="Enter your UPI ID (e.g., name@ybl)" value={paymentUpiId} onChange={(e) => setPaymentUpiId(e.target.value)} />
                  <button className="btn glow large" onClick={handleConfirmPayment} disabled={loading}>{loading ? "Submitting..." : "I Have Paid"}</button>
                </div>
              </section>
            )}
          </>
        )}

        {/* WITHDRAW */}
        {activeTab === "withdraw" && (
          <div className="withdraw-container">
            <section className="panel">
              <h3 className="modern-title">Redeem Coins as UPI</h3>
              <p className="modern-subtitle">10% commission fee. Minimum ₹50.</p>
              <div className="reward-grid">
                {rewardOptions.filter((r) => r.type === "UPI").map((r) => (
                  <div key={r.amount} className="reward-card" onClick={() => handleRedeemReward(r)}>
                    <img src={r.icon} alt="UPI" className="reward-icon" />
                    <div className="reward-cost"><img src="/coin.jpg" alt="coin" /><span>{r.cost}</span></div>
                    <div className="reward-amount">₹ {r.amount}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h3 className="modern-title">Redeem as Google Play</h3>
              <div className="reward-grid">
                {rewardOptions.filter((r) => r.type === "Google Play").map((r) => (
                  <div key={r.amount} className="reward-card" onClick={() => handleRedeemReward(r)}>
                    <img src={r.icon} alt="Google Play" className="reward-icon" />
                    <div className="reward-cost"><img src="/coin.jpg" alt="coin" /><span>{r.cost}</span></div>
                    <div className="reward-amount">₹ {r.amount}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h3 className="modern-title">Redeem as Amazon Gift Card</h3>
              <div className="reward-grid">
                {rewardOptions.filter((r) => r.type === "Amazon").map((r) => (
                  <div key={r.amount} className="reward-card" onClick={() => handleRedeemReward(r)}>
                    <img src={r.icon} alt="Amazon" className="reward-icon" />
                    <div className="reward-cost"><img src="/coin.jpg" alt="coin" /><span>{r.cost}</span></div>
                    <div className="reward-amount">₹ {r.amount}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ADMIN */}
        {activeTab === "admin" && profile.email === adminEmail && (
          <section className="panel">
            <h3>Admin Panel</h3>
            <form onSubmit={handleCreateMatch} className="admin-form">
              <h4>Create New Match</h4>
              <input name="title" className="modern-input" placeholder="Match Title" value={newMatch.title} onChange={(e) => setNewMatch({ ...newMatch, title: e.target.value })} />
              <input name="imageUrl" className="modern-input" placeholder="Image URL" value={newMatch.imageUrl} onChange={(e) => setNewMatch({ ...newMatch, imageUrl: e.target.value })} />
              <label>Start Time</label>
              <input name="startTime" type="datetime-local" className="modern-input" value={newMatch.startTime} onChange={(e) => setNewMatch({ ...newMatch, startTime: e.target.value })} />
              <label>Prize Model</label>
              <select name="prizeModel" className="modern-input" value={newMatch.prizeModel} onChange={(e) => setNewMatch({ ...newMatch, prizeModel: e.target.value })}>
                <option value="Scalable">Scalable</option>
                <option value="Fixed">Fixed</option>
              </select>
              <label>Entry Fee (Coins)</label>
              <input name="entryFee" type="number" className="modern-input" value={newMatch.entryFee} onChange={(e) => setNewMatch({ ...newMatch, entryFee: parseInt(e.target.value || "0", 10) })} />
              <label>Max Players</label>
              <input name="maxPlayers" type="number" className="modern-input" value={newMatch.maxPlayers} onChange={(e) => setNewMatch({ ...newMatch, maxPlayers: parseInt(e.target.value || "0", 10) })} />
              {newMatch.prizeModel === "Scalable" ? (
                <>
                  <label>Per Kill Reward</label>
                  <input name="perKillReward" type="number" className="modern-input" value={newMatch.perKillReward} onChange={(e) => setNewMatch({ ...newMatch, perKillReward: parseInt(e.target.value || "0", 10) })} />
                  <label>Commission (%)</label>
                  <input name="commissionPercent" type="number" className="modern-input" value={newMatch.commissionPercent} onChange={(e) => setNewMatch({ ...newMatch, commissionPercent: parseInt(e.target.value || "0", 10) })} />
                </>
              ) : (
                <>
                  <label>Booyah Prize</label>
                  <input name="booyahPrize" type="number" className="modern-input" value={newMatch.booyahPrize} onChange={(e) => setNewMatch({ ...newMatch, booyahPrize: parseInt(e.target.value || "0", 10) })} />
                </>
              )}
              <label>Rules</label>
              <textarea name="rules" className="modern-input" placeholder="Enter match rules" value={newMatch.rules} onChange={(e) => setNewMatch({ ...newMatch, rules: e.target.value })} />
              <button type="submit" className="btn glow">Create Match</button>
            </form>

            <hr style={{ margin: "20px 0", borderColor: "var(--panel)" }} />

            <h4>Top-up Requests</h4>
            {requests.topup.length === 0 ? <p className="muted-small">No top-up requests.</p> : requests.topup.map((r) => (
              <div key={r.id} className="admin-row">
                <span>{r.email} | ₹{r.amount} | UPI: {r.upiId}</span>
                <div>
                  <button className="btn small" onClick={() => approveRequest("topup", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("topup", r)}>Reject</button>
                </div>
              </div>
            ))}

            <h4 style={{ marginTop: 16 }}>Withdraw Requests</h4>
            {requests.withdraw.length === 0 ? <p className="muted-small">No withdraw requests.</p> : requests.withdraw.map((r) => (
              <div key={r.id} className="admin-row">
                <span>{r.email} | ₹{r.amount} | {r.type === "UPI" ? `UPI: ${r.upiId}` : `Type: ${r.type}`}</span>
                <div>
                  <button className="btn small" onClick={() => approveRequest("withdraw", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("withdraw", r)}>Reject</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ACCOUNT */}
        {activeTab === "account" && (
          <div className="account-container">
            {accountView === "main" && (
              <>
                <section className="panel account-profile-card">
                  <h3 className="modern-title">{profile.username || "Set Your Username"}</h3>
                  <p className="modern-subtitle">{profile.email}</p>

                  {/* STATS + LEVEL CARD */}
                  <div className="level-card">
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <img src={lvl.level.icon} alt="badge" style={{ width: 96, height: 96, borderRadius: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.6)" }} />
                      <div>
                        <div style={{ color: "var(--accent)", fontWeight: 800 }}>{lvl.level.name}</div>
                        <div style={{ marginTop: 6, color: "var(--muted)" }}>XP: {coins}</div>
                        <div style={{ marginTop: 8 }}>{Math.round(lvl.progress * 100)}% to next level</div>
                        <div style={{ height: 8, background: "rgba(255,255,255,0.03)", marginTop: 6, borderRadius: 8, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(lvl.progress * 100)}%`, height: "100%", background: "linear-gradient(90deg,var(--accent),var(--accent2))" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="panel account-menu">
                  <button className="account-option" onClick={() => { setNewUsername(profile.username || ""); setAccountView("profile"); }}>
                    <FaUserCog size={20} /><span>Profile Settings</span><span className="arrow">&gt;</span>
                  </button>
                  <button className="account-option" onClick={() => setShowUsernameModal(true)}>
                    <FaUserEdit size={20} /><span>Edit In-Game Username</span><span className="arrow">&gt;</span>
                  </button>
                  <button className="account-option" onClick={() => setAccountView("refer")}>
                    <FaGift size={20} /><span>Refer a Friend</span><span className="arrow">&gt;</span>
                  </button>
                  <button className="account-option logout" onClick={handleLogout}>
                    <FaSignOutAlt size={20} /><span>Logout</span><span className="arrow">&gt;</span>
                  </button>
                </section>
              </>
            )}

            {accountView === "profile" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}><FaArrowLeft /> Back</button>
                <h3 className="modern-title">Profile Settings</h3>
                <div className="profile-settings-form">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="text" className="modern-input" value={profile.email} disabled />
                  </div>
                  <div className="form-group">
                    <label>User ID</label>
                    <input type="text" className="modern-input" value={user.uid} disabled />
                  </div>
                  <hr />
                  <form className="form-group" onSubmit={(e) => { e.preventDefault(); handleUpdateDisplayName(e); }}>
                    <label>Display Name</label>
                    <input type="text" className="modern-input" value={profile.displayName || ""} onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))} />
                    <button type="submit" className="btn" disabled={loading}>{loading ? "Saving..." : "Save Name"}</button>
                  </form>
                  <hr />
                  <div className="form-group">
                    <label>UPI ID (for withdrawals)</label>
                    <input type="text" className="modern-input" value={profile.upiId || ""} onChange={(e) => setProfile((p) => ({ ...p, upiId: e.target.value }))} onBlur={async () => {
                      // save UPI ID when blurred
                      try {
                        const ref = doc(db, "users", user.uid);
                        await updateDoc(ref, { upiId: profile.upiId || "" });
                        setModalMessage("UPI saved.");
                      } catch (err) {
                        console.error("save upi err:", err);
                        setModalMessage("Failed to save UPI.");
                      }
                    }} />
                  </div>
                  <hr />
                  <div className="form-group">
                    <label>Password</label>
                    <button className="btn ghost" onClick={handlePasswordReset}>Send Password Reset Email</button>
                  </div>
                </div>
              </section>
            )}

            {accountView === "refer" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}><FaArrowLeft /> Back</button>
                <h3 className="modern-title">Refer a Friend</h3>
                <div className="referral-card">
                  <p>Your Unique Referral Code:</p>
                  <div className="referral-code">{profile.referralCode || "Loading..."}</div>
                  <p className="modern-subtitle" style={{ textAlign: "center" }}>Share this code. When a friend uses it, they get 50 coins and you get 20 coins.</p>
                </div>
                {!profile.hasRedeemedReferral && (
                  <div className="referral-form">
                    <p>Have a friend's code?</p>
                    <input type="text" className="modern-input" placeholder="Enter referral code" value={referralInput} onChange={(e) => setReferralInput(e.target.value)} />
                    <button className="btn glow large" onClick={handleRedeemReferral}>Redeem Code</button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {/* footer nav */}
      <footer className="bottom-nav">
        {["home", "matches", "topup", "withdraw", "account"].map((tab) => (
          <button key={tab} className={`nav-btn ${activeTab === tab ? "active" : ""}`} onClick={() => { setActiveTab(tab); setAccountView("main"); setSelectedMatch(null); setTopupView("select"); }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>

      {/* Username Modal */}
      {showUsernameModal && (
        <div className="modal-overlay" onClick={() => setShowUsernameModal(false)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">{profile.username ? "Edit Your Username" : "Set Your In-Game Username"}</h3>
            <p className="modern-subtitle">You must set a username before joining matches.</p>
            <form onSubmit={handleSetUsername}>
              <input type="text" className="modern-input" placeholder="Enter username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              <button type="submit" className="btn glow large" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
              <button type="button" className="btn large ghost" style={{ marginTop: 10 }} onClick={() => setShowUsernameModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Notification modal */}
      {modalMessage && (
        <div className="modal-overlay" onClick={() => setModalMessage(null)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Notification</h3>
            <p className="modern-subtitle" style={{ textAlign: "center", marginBottom: 24 }}>{modalMessage}</p>
            <button className="btn glow large" onClick={() => setModalMessage(null)}>OK</button>
          </div>
        </div>
      )}

      {/* Level up animation popup */}
      {showLevelPopup && levelUpData && (
        <div className="level-up-overlay" onClick={() => setShowLevelPopup(false)}>
          <div className="level-up-popup modern-card" onClick={(e) => e.stopPropagation()}>
            <h2>Level Up!</h2>
            <img src={LEVELS[levelUpData.newLevelIndex].icon} alt="lvl" style={{ width: 120, height: 120, borderRadius: 12 }} />
            <h3>{LEVELS[levelUpData.newLevelIndex].name}</h3>
            <p className="modern-subtitle">Congrats — you reached a new level!</p>
            <button className="btn glow" onClick={() => setShowLevelPopup(false)}>Sweet!</button>
          </div>
        </div>
      )}

      {/* Inline small styles for the new UI elements */}
      <style>{`
        .level-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          padding: 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.03);
          margin-top: 12px;
        }
        .amount-options { display:flex; gap:10px; margin:12px 0; flex-wrap:wrap; }
        .amount-btn { padding:12px 14px; border-radius:10px; background:rgba(255,255,255,0.02); cursor:pointer; }
        .amount-btn.selected { box-shadow: 0 6px 18px rgba(0,0,0,0.6); background: linear-gradient(90deg,var(--accent),var(--accent2)); color: #fff; }
        .qr-code-image { width:220px; max-width:90%; display:block; margin: 12px auto; border-radius:12px; }
        .reward-grid { display:flex; gap:12px; flex-wrap:wrap; }
        .reward-card { background:var(--panel); border-radius:12px; padding:10px; width:140px; text-align:center; cursor:pointer; border:1px solid rgba(255,255,255,0.04); }
        .reward-icon { width:48px; height:48px; object-fit:contain; margin-bottom:8px; }
        .reward-cost { display:flex; justify-content:center; align-items:center; gap:6px; }
        .modern-card { background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); padding:20px; border-radius:16px; border:1px solid rgba(255,255,255,0.03); }
        .glow { box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 18px rgba(0,230,168,0.06); }
        .modal-overlay { position:fixed; left:0; top:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); z-index:9999; }
        .modal-content { width:92%; max-width:420px; padding:18px; border-radius:12px; }
        .level-up-overlay { position:fixed; left:0; top:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); z-index:10000; }
        .level-up-popup { text-align:center; padding:20px; width:92%; max-width:360px; border-radius:14px; animation: popin 420ms ease; }
        @keyframes popin { from { transform: scale(0.8); opacity:0 } to { transform: scale(1); opacity:1 } }
      `}</style>
    </div>
  );
}
