// src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { auth, db, appCheckInstance } from "../firebase";
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
import { getToken } from "firebase/app-check";
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

// small helpers
function formatMatchTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "Time TBD";
  return timestamp
    .toDate()
    .toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

// Reward options (cost measured in coins)
const rewardOptions = [
  { type: "UPI", amount: 25, cost: 275, icon: "/upi.png" },
  { type: "UPI", amount: 50, cost: 550, icon: "/upi.png" },
  { type: "Google Play", amount: 50, cost: 550, icon: "/google-play.png" },
  { type: "Google Play", amount: 100, cost: 1100, icon: "/google-play.png" },
  { type: "Amazon", amount: 50, cost: 550, icon: "/amazon.png" },
  { type: "Amazon", amount: 100, cost: 1100, icon: "/amazon.png" },
];

// initial match shape
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

export default function Dashboard({ user }) {
  // core state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [topupAmount, setTopupAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [paymentUpiId, setPaymentUpiId] = useState("");
  const [topupView, setTopupView] = useState("select");
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });
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
  const [newDisplayName, setNewDisplayName] = useState("");
  const [modalMessage, setModalMessage] = useState(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [matchToSettle, setMatchToSettle] = useState(null);
  const [winnerUsername, setWinnerUsername] = useState("");
  const [winnerKills, setWinnerKills] = useState(0);
  const [adLoading, setAdLoading] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiInput, setUpiInput] = useState("");
  const [pendingReward, setPendingReward] = useState(null); // reward object waiting for UPI
  const [loadingAction, setLoadingAction] = useState(false);

  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";
  const adminEmail2 = "priyankabairagi036@gmail.com"; // allowed admin

  // --------------- Load or create user doc ---------------
  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        setLoading(true);
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          // ensure referralCode exists
          if (!data.referralCode) {
            const newReferralCode = user.uid.substring(0, 8).toUpperCase();
            await updateDoc(ref, { referralCode: newReferralCode, hasRedeemedReferral: data.hasRedeemedReferral || false });
            if (mounted) setProfile({ id: snap.id, ...data, referralCode: newReferralCode });
          } else {
            if (mounted) setProfile({ id: snap.id, ...data });
          }
        } else {
          // create initial doc
          const newReferralCode = user.uid.substring(0, 8).toUpperCase();
          const initial = {
            email: user.email,
            coins: 0,
            displayName: user.displayName || "",
            username: "",
            lastDaily: null,
            createdAt: serverTimestamp(),
            referralCode: newReferralCode,
            hasRedeemedReferral: false,
            adCount: 0,
            adLastReset: null,
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
    loadProfile();
    return () => (mounted = false);
  }, [user.uid, user.email, user.displayName]);

  // --------------- Load matches when tab is matches ---------------
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

  // --------------- Admin load requests & upcoming matches ---------------
  useEffect(() => {
    if (profile?.email !== adminEmail && profile?.email !== adminEmail2) return;
    (async () => {
      try {
        const topupQuery = query(collection(db, "topupRequests"), where("status", "==", "pending"));
        const withdrawQuery = query(collection(db, "withdrawRequests"), where("status", "==", "pending"));
        const matchesQuery = query(collection(db, "matches"), where("status", "==", "upcoming"), orderBy("createdAt", "desc"));
        const [topupSnap, withdrawSnap, matchesSnap] = await Promise.all([getDocs(topupQuery), getDocs(withdrawQuery), getDocs(matchesQuery)]);
        setRequests({
          topup: topupSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          withdraw: withdrawSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
        setMatches(matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Admin load error:", err);
      }
    })();
  }, [profile?.email, activeTab]);

  // --------------- Helpers ---------------
  async function refreshProfile() {
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error("refreshProfile error:", err);
    }
  }

  // --------------- Coins utilities ---------------
  async function addCoin(n = 1) {
    if (!profile) return;
    const userRef = doc(db, "users", user.uid);
    const newCoins = (profile.coins || 0) + n;
    await updateDoc(userRef, { coins: newCoins });
    setProfile((p) => ({ ...p, coins: newCoins }));
  }

  // --------------- Daily claim (+1) ---------------
  async function claimDaily() {
    if (!profile) return;
    const last =
      profile.lastDaily && typeof profile.lastDaily.toDate === "function"
        ? profile.lastDaily.toDate()
        : profile.lastDaily
        ? new Date(profile.lastDaily)
        : null;
    const now = new Date();
    const isSameDay = last && last.toDateString() === now.toDateString();
    if (isSameDay) {
      setModalMessage("You already claimed today's coin.");
      return;
    }
    try {
      setLoadingAction(true);
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, { coins: (profile.coins || 0) + 1, lastDaily: serverTimestamp() });
      await refreshProfile();
      setModalMessage("+1 coin credited!");
    } catch (err) {
      console.error("claimDaily error:", err);
      setModalMessage("Failed to claim daily. Try again.");
    } finally {
      setLoadingAction(false);
    }
  }

  // --------------- Ad watcher: +2 coins, limit 10/day ---------------
  async function watchAd() {
    if (!profile) return;
    // check ad reset
    try {
      setAdLoading(true);
      // check reset time
      const adLastReset = profile.adLastReset && typeof profile.adLastReset.toDate === "function"
        ? profile.adLastReset.toDate()
        : profile.adLastReset
        ? new Date(profile.adLastReset)
        : null;
      const now = new Date();
      let adCount = profile.adCount || 0;
      let needsReset = false;
      if (!adLastReset) needsReset = true;
      else {
        const last = adLastReset;
        // if last reset not same day as now -> reset
        if (last.toDateString() !== now.toDateString()) needsReset = true;
      }
      if (needsReset) {
        adCount = 0;
      }

      if (adCount >= 10) {
        setModalMessage("Daily ad limit reached (10). Try again tomorrow.");
        setAdLoading(false);
        return;
      }

      // Simulate ad playing (you must integrate actual ad SDK)
      // For demo: directly reward after small delay
      // In real: call ad SDK, and on reward success run reward flow below
      await new Promise((res) => setTimeout(res, 800)); // simulate ad

      // Give reward: +2 coins
      const coinsReward = 2;
      const userRef = doc(db, "users", user.uid);
      const newAdCount = adCount + 1;
      const newCoins = (profile.coins || 0) + coinsReward;
      await updateDoc(userRef, { coins: newCoins, adCount: newAdCount, adLastReset: serverTimestamp() });
      setProfile((p) => ({ ...p, coins: newCoins, adCount: newAdCount, adLastReset: now }));
      setModalMessage(`+${coinsReward} coins for watching the ad! (${newAdCount}/10 today)`);
    } catch (err) {
      console.error("watchAd error:", err);
      setModalMessage("Ad failed. Try later.");
    } finally {
      setAdLoading(false);
    }
  }

  // --------------- Top-up flow ---------------
  function handleSelectTopupAmount(amt) {
    setSelectedAmount(amt);
    setTopupAmount("");
  }

  async function handleTopup() {
    const amt = parseInt(selectedAmount || topupAmount, 10);
    if (!amt || amt < 20) {
      setModalMessage("Minimum top-up is ₹20.");
      return;
    }
    // go to payment stage
    setTopupView("pay");
  }

  async function handleConfirmPayment() {
    const amt = parseInt(selectedAmount || topupAmount, 10);
    if (!amt || amt < 20) {
      setModalMessage("Invalid amount.");
      return;
    }
    if (!paymentUpiId) {
      setModalMessage("Enter your UPI ID so admin can verify.");
      return;
    }
    try {
      setLoadingAction(true);
      // coins: 1 ₹ = 10 coins
      const coins = amt * 10;
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: amt,
        coins,
        upiId: paymentUpiId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setModalMessage("Top-up request submitted! Admin will verify it.");
      setTopupAmount("");
      setSelectedAmount(null);
      setPaymentUpiId("");
      setTopupView("select");
      setActiveTab("home");
    } catch (err) {
      console.error("handleConfirmPayment error:", err);
      setModalMessage("Failed to submit top-up. Try again.");
    } finally {
      setLoadingAction(false);
    }
  }

  // --------------- Redeem reward (UPI & gift cards) - now with UPI modal ---------------
  function openUpiModalForReward(reward) {
    if (!profile) return;
    if (profile.coins < reward.cost) {
      setModalMessage("You don't have enough coins for this reward.");
      return;
    }
    if (reward.type === "UPI") {
      setPendingReward(reward);
      setUpiInput("");
      setShowUpiModal(true);
      return;
    }
    // non-UPI: confirm and create withdrawRequests
    handleRedeemReward(reward, null);
  }

  async function handleRedeemReward(reward, upiIdValue) {
    if (!profile || !reward) return;
    try {
      setLoadingAction(true);
      // consume coins and write withdrawRequests (admin will process)
      await addDoc(collection(db, "withdrawRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: reward.amount,
        coinsDeducted: reward.cost,
        status: "pending",
        type: reward.type,
        upiId: upiIdValue || "",
        createdAt: serverTimestamp(),
      });
      // deduct user's coins
      const userRef = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) - reward.cost;
      await updateDoc(userRef, { coins: newCoins });
      setProfile((p) => ({ ...p, coins: newCoins }));
      if (reward.type === "UPI") {
        setModalMessage("Withdrawal request submitted! Admin will process it shortly.");
      } else {
        setModalMessage("Redemption request submitted! Admin will email your code within 24 hours.");
      }
      setShowUpiModal(false);
      setPendingReward(null);
      setUpiInput("");
    } catch (err) {
      console.error("handleRedeemReward error:", err);
      setModalMessage("Failed to submit redemption. Try again.");
    } finally {
      setLoadingAction(false);
    }
  }

  // --------------- Join match ---------------
  async function handleJoinMatch(match) {
    if (!profile) return;
    if (!profile.username) {
      setModalMessage("Please set your in-game username before joining.");
      setShowUsernameModal(true);
      return;
    }
    if (match.playersJoined?.includes(user.uid)) {
      setSelectedMatch(match);
      return;
    }
    if ((match.playersJoined?.length || 0) >= match.maxPlayers) {
      setModalMessage("Match is full.");
      return;
    }
    if (profile.coins < match.entryFee) {
      setModalMessage("You don't have enough coins.");
      return;
    }
    if (!window.confirm(`Join this match for ${match.entryFee} coins?`)) return;
    try {
      setLoadingAction(true);
      const userRef = doc(db, "users", user.uid);
      const matchRef = doc(db, "matches", match.id);
      await updateDoc(userRef, { coins: profile.coins - match.entryFee });
      await updateDoc(matchRef, { playersJoined: arrayUnion(user.uid) });
      setProfile((p) => ({ ...p, coins: p.coins - match.entryFee }));
      // update local matches list
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, playersJoined: [...(m.playersJoined || []), user.uid] } : m)));
      setModalMessage("Joined successfully!");
    } catch (err) {
      console.error("handleJoinMatch error:", err);
      setModalMessage("Failed to join. Try again.");
    } finally {
      setLoadingAction(false);
    }
  }

  // --------------- Admin approve/reject ---------------
  async function approveRequest(type, req) {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "approved" });
      if (type === "topup") {
        const userRef = doc(db, "users", req.userId);
        const snap = await getDoc(userRef);
        const current = snap.exists() ? (snap.data().coins || 0) : 0;
        await updateDoc(userRef, { coins: current + (req.coins || 0) });
      }
      setRequests((r) => ({ ...r, [type]: r[type].filter((x) => x.id !== req.id) }));
      setModalMessage(`${type} approved.`);
    } catch (err) {
      console.error("approveRequest error:", err);
      setModalMessage("Approve failed.");
    }
  }

  async function rejectRequest(type, req) {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "rejected" });
      setRequests((r) => ({ ...r, [type]: r[type].filter((x) => x.id !== req.id) }));
      setModalMessage(`${type} rejected.`);
    } catch (err) {
      console.error("rejectRequest error:", err);
      setModalMessage("Reject failed.");
    }
  }

  // --------------- Creating matches (admin) ---------------
  const handleNewMatchChange = (e) => {
    const { name, value, type } = e.target;
    const val = type === "number" ? parseInt(value || 0, 10) : value;
    setNewMatch((p) => ({ ...p, [name]: val }));
  };

  async function handleCreateMatch(e) {
    e.preventDefault();
    try {
      setLoadingAction(true);
      const matchData = {
        ...newMatch,
        startTime: new Date(newMatch.startTime),
        status: "upcoming",
        playersJoined: [],
        createdAt: serverTimestamp(),
        roomID: "",
        roomPassword: "",
      };
      if (matchData.prizeModel === "Scalable") delete matchData.booyahPrize;
      else {
        delete matchData.commissionPercent;
        delete matchData.perKillReward;
      }
      await addDoc(collection(db, "matches"), matchData);
      setModalMessage("Match created!");
      setNewMatch(initialMatchState);
      setMatches((prev) => [{ id: "new", ...matchData }, ...prev]);
    } catch (err) {
      console.error("handleCreateMatch error:", err);
      setModalMessage("Failed to create match.");
    } finally {
      setLoadingAction(false);
    }
  }

  // --------------- Username & profile updates ---------------
  async function handleSetUsername(e) {
    e.preventDefault();
    if (!newUsername) return setModalMessage("Username cannot be blank.");
    try {
      setLoadingAction(true);
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { username: newUsername });
      setProfile((p) => ({ ...p, username: newUsername }));
      setShowUsernameModal(false);
      setModalMessage("Username saved!");
    } catch (err) {
      console.error("handleSetUsername error:", err);
      setModalMessage("Failed to save username.");
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleUpdateDisplayName(e) {
    e.preventDefault();
    if (!newDisplayName) return setModalMessage("Display name cannot be blank.");
    if (newDisplayName === profile.displayName) return setModalMessage("No changes made.");
    try {
      setLoadingAction(true);
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: newDisplayName });
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { displayName: newDisplayName });
      setProfile((p) => ({ ...p, displayName: newDisplayName }));
      setModalMessage("Display name updated!");
    } catch (err) {
      console.error("handleUpdateDisplayName error:", err);
      setModalMessage("Failed to update display name.");
    } finally {
      setLoadingAction(false);
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return setModalMessage("Could not find user email.");
    const providerIds = auth.currentUser.providerData.map((p) => p.providerId);
    if (!providerIds.includes("password")) {
      return setModalMessage("Password reset not available (signed in with Google).");
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      setModalMessage("Password reset email sent!");
    } catch (err) {
      console.error("handlePasswordReset error:", err);
      setModalMessage("Failed to send password reset.");
    }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  // --------------- Settle match (admin) using App Check token and server API ---------------
  async function handleSettleMatch(e) {
    e.preventDefault();
    if (!matchToSettle || !winnerUsername) return setModalMessage("Winner required.");
    try {
      setLoadingAction(true);
      // App Check token
      let appCheckToken;
      try {
        appCheckToken = await getToken(appCheckInstance, false);
      } catch (err) {
        console.error("AppCheck token error:", err);
        setModalMessage("Security check failed. Please refresh and try again.");
        setLoadingAction(false);
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch("/api/settleMatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, "X-Firebase-AppCheck": appCheckToken.token },
        body: JSON.stringify({ matchId: matchToSettle.id, winnerUsername, kills: winnerKills }),
      });
      const data = await res.json();
      if (data.success) {
        setModalMessage(data.message);
        setMatches((prev) => prev.filter((m) => m.id !== matchToSettle.id));
        setShowSettleModal(false);
      } else setModalMessage(data.message || "Settle failed.");
    } catch (err) {
      console.error("handleSettleMatch error:", err);
      setModalMessage("Failed to settle match.");
    } finally {
      setLoadingAction(false);
    }
  }

  // --------------- Redeem referral code (via server) ---------------
  async function handleRedeemReferral() {
    if (!referralInput) return setModalMessage("Enter a referral code.");
    if (!profile || profile.hasRedeemedReferral) return setModalMessage("Already redeemed.");
    if (referralInput.toUpperCase() === profile.referralCode) return setModalMessage("You can't use your own code.");
    try {
      setLoadingAction(true);
      let appCheckToken;
      try {
        appCheckToken = await getToken(appCheckInstance, false);
      } catch (err) {
        console.error("AppCheck token error:", err);
        setModalMessage("Security check failed. Please refresh and try again.");
        setLoadingAction(false);
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch("/api/redeemReferralCode", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, "X-Firebase-AppCheck": appCheckToken.token },
        body: JSON.stringify({ code: referralInput.toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        // local update: give 50 coins, mark redeemed
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { coins: (profile.coins || 0) + 50, hasRedeemedReferral: true });
        await refreshProfile();
        setModalMessage(data.message || "Referral redeemed.");
        setReferralInput("");
      } else {
        setModalMessage(data.message || "Redeem failed.");
      }
    } catch (err) {
      console.error("handleRedeemReferral error:", err);
      setModalMessage("Redeem error.");
    } finally {
      setLoadingAction(false);
    }
  }

  // --------------- UI early return ---------------
  if (loading || !profile) return <div className="center-screen">Loading Dashboard...</div>;

  // --------------- Render ---------------
  return (
    <div className="dash-root">
      <audio ref={audioRef} src="/bgm.mp3" loop />
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
          <button className="btn small ghost music-btn" onClick={() => { if (isPlaying) audioRef.current.pause(); else audioRef.current.play(); setIsPlaying(!isPlaying); }}>
            {isPlaying ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>
          {(profile.email === adminEmail || profile.email === adminEmail2) && (
            <button className="btn small" onClick={() => setActiveTab("admin")}>Admin Panel</button>
          )}
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
                  <div className="big" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <img src="/coin.jpg" alt="coin" className="coin-icon" style={{ width: 28, height: 28, borderRadius: "50%", animation: "spinCoin 3s linear infinite" }} />
                    <span>{profile.coins ?? 0}</span>
                  </div>
                </div>

                <div className="home-actions">
                  <button className="btn" onClick={claimDaily} disabled={loadingAction}>Claim Daily (+1)</button>
                  <button className="btn ghost" onClick={watchAd} disabled={adLoading}>{adLoading ? "Loading..." : "Watch Ad (+2)"}</button>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Welcome!</h3>
              <p>Check the matches tab to join a game.</p>
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
                {!loadingMatches && matches.length === 0 && <p>No upcoming matches right now. Check back soon!</p>}
                <div className="grid">
                  {matches.map((m) => {
                    const hasJoined = m.playersJoined?.includes(user.uid);
                    const isFull = (m.playersJoined?.length || 0) >= m.maxPlayers;
                    return (
                      <div key={m.id} className="match-card" onClick={() => setSelectedMatch(m)}>
                        <img src={m.imageUrl || "/bt.jpg"} alt={m.title} />
                        <div className="match-info">
                          <div className="match-title">{m.title}</div>
                          <div className="match-meta time">Starts: {formatMatchTime(m.startTime)}</div>
                          <div className="match-meta">Entry: {m.entryFee} Coins | Joined: {(m.playersJoined?.length || 0)}/{m.maxPlayers}</div>
                          <button className="btn" onClick={(e) => { e.stopPropagation(); handleJoinMatch(m); }} disabled={hasJoined || isFull}>
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
                  <button className="btn small" onClick={() => setShowUsernameModal(true)}><FaUserEdit style={{ marginRight: 8 }} />Edit Username</button>
                </div>
                <img src={selectedMatch.imageUrl || "/bt.jpg"} alt="match" className="match-details-image" />
                <h3 className="modern-title">{selectedMatch.title}</h3>
                <p className="match-details-time">Starts: {formatMatchTime(selectedMatch.startTime)}</p>

                {(() => {
                  const hasJoined = selectedMatch.playersJoined?.includes(user.uid);
                  return (
                    <>
                      {hasJoined && selectedMatch.roomID ? (
                        <div className="room-details">
                          <h4>Room Details</h4>
                          <p><span>Room ID:</span> {selectedMatch.roomID}</p>
                          <p><span>Password:</span> {selectedMatch.roomPassword}</p>
                        </div>
                      ) : hasJoined ? (
                        <div className="room-details pending"><p>You have joined! Room ID and Password will be revealed 15 minutes before the match.</p></div>
                      ) : null}
                      <div className="match-rules">
                        <h4>Match Rules</h4>
                        <p>{selectedMatch.rules || "No specific rules provided."}</p>
                      </div>
                    </>
                  );
                })()}
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
                <p className="modern-subtitle">1 ₹ = 10 Coins | Choose an amount</p>
                <div className="amount-options">
                  {[20, 50, 100, 200].map((amt) => (
                    <div key={amt} className={`amount-btn ${selectedAmount === amt ? "selected" : ""}`} onClick={() => handleSelectTopupAmount(amt)}>
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
                <p className="modern-subtitle">Scan the QR code to pay ₹{selectedAmount || topupAmount}</p>
                <img src="/qr.jpg" alt="QR Code" className="qr-code-image" />
                <div className="form-group" style={{ marginTop: 24 }}>
                  <label>Enter Your UPI ID</label>
                  <input type="text" className="modern-input" placeholder="Enter your UPI ID (e.g., name@ybl)" value={paymentUpiId} onChange={(e) => setPaymentUpiId(e.target.value)} />
                  <button className="btn glow large" onClick={handleConfirmPayment} disabled={loadingAction}>{loadingAction ? "Submitting..." : "I Have Paid"}</button>
                </div>
              </section>
            )}
          </>
        )}

        {/* WITHDRAW */}
        {activeTab === "withdraw" && (
          <div className="withdraw-container">
            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: 10 }}>Redeem Coins as UPI</h3>
              <p className="modern-subtitle" style={{ paddingLeft: 10 }}>10% commission fee</p>
              <div className="reward-grid">
                {rewardOptions.filter((r) => r.type === "UPI").map((r) => (
                  <div key={`${r.type}-${r.amount}`} className="reward-card" onClick={() => openUpiModalForReward(r)}>
                    <img src={r.icon} alt="UPI" className="reward-icon" />
                    <div className="reward-cost"><img src="/coin.jpg" alt="coin" /><span>{r.cost}</span></div>
                    <div className="reward-amount">₹ {r.amount}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: 10 }}>Redeem as Google Gift Card</h3>
              <div className="reward-grid">
                {rewardOptions.filter((r) => r.type === "Google Play").map((r) => (
                  <div key={`${r.type}-${r.amount}`} className="reward-card" onClick={() => openUpiModalForReward(r)}>
                    <img src={r.icon} alt="Google Play" className="reward-icon" />
                    <div className="reward-cost"><img src="/coin.jpg" alt="coin" /><span>{r.cost}</span></div>
                    <div className="reward-amount">₹ {r.amount}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: 10 }}>Redeem as Amazon Gift Card</h3>
              <div className="reward-grid">
                {rewardOptions.filter((r) => r.type === "Amazon").map((r) => (
                  <div key={`${r.type}-${r.amount}`} className="reward-card" onClick={() => openUpiModalForReward(r)}>
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
        {activeTab === "admin" && (profile.email === adminEmail || profile.email === adminEmail2) && (
          <section className="panel">
            <h3>Admin Panel</h3>
            <form onSubmit={handleCreateMatch} className="admin-form">
              <h4>Create New Match</h4>
              <input name="title" className="modern-input" placeholder="Match Title" value={newMatch.title} onChange={handleNewMatchChange} />
              <input name="imageUrl" className="modern-input" placeholder="Image URL" value={newMatch.imageUrl} onChange={handleNewMatchChange} />
              <label>Start Time</label>
              <input name="startTime" type="datetime-local" className="modern-input" value={newMatch.startTime} onChange={handleNewMatchChange} />
              <label>Match Type</label>
              <select name="type" className="modern-input" value={newMatch.type} onChange={handleNewMatchChange}><option value="BR">Battle Royale</option><option value="CS">Clash Squad</option></select>
              <label>Prize Model</label>
              <select name="prizeModel" className="modern-input" value={newMatch.prizeModel} onChange={handleNewMatchChange}><option value="Scalable">Scalable (BR)</option><option value="Fixed">Fixed (CS)</option></select>
              <label>Entry Fee (Coins)</label>
              <input name="entryFee" type="number" className="modern-input" value={newMatch.entryFee} onChange={handleNewMatchChange} />
              <label>Max Players</label>
              <input name="maxPlayers" type="number" className="modern-input" value={newMatch.maxPlayers} onChange={handleNewMatchChange} />

              {newMatch.prizeModel === "Scalable" ? (
                <>
                  <label>Per Kill Reward (Coins)</label>
                  <input name="perKillReward" type="number" className="modern-input" value={newMatch.perKillReward} onChange={handleNewMatchChange} />
                  <label>Commission (%)</label>
                  <input name="commissionPercent" type="number" className="modern-input" value={newMatch.commissionPercent} onChange={handleNewMatchChange} />
                </>
              ) : (
                <>
                  <label>Booyah Prize (Fixed Total)</label>
                  <input name="booyahPrize" type="number" className="modern-input" value={newMatch.booyahPrize} onChange={handleNewMatchChange} />
                </>
              )}

              <label>Rules</label>
              <textarea name="rules" className="modern-input" placeholder="Enter match rules..." value={newMatch.rules} onChange={handleNewMatchChange} />
              <button type="submit" className="btn glow">{loadingAction ? "Creating..." : "Create Match"}</button>
            </form>

            <hr style={{ margin: "24px 0", borderColor: "var(--panel)" }} />

            <h4>Top-up Requests</h4>
            {requests.topup.length === 0 && <p className="muted-small">No top-up requests.</p>}
            {requests.topup.map((r) => (
              <div key={r.id} className="admin-row">
                <span>{r.email} | ₹{r.amount} | UPI: {r.upiId}</span>
                <div>
                  <button className="btn small" onClick={() => approveRequest("topup", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("topup", r)}>Reject</button>
                </div>
              </div>
            ))}

            <h4>Withdraw Requests</h4>
            {requests.withdraw.length === 0 && <p className="muted-small">No withdraw requests.</p>}
            {requests.withdraw.map((r) => (
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
                </section>

                <section className="panel account-menu">
                  <button className="account-option" onClick={() => { setNewDisplayName(profile.displayName || ""); setAccountView("profile"); }}>
                    <FaUserCog size={20} /><span>Profile Settings</span><span className="arrow">&gt;</span>
                  </button>
                  <button className="account-option" onClick={() => setShowUsernameModal(true)}><FaUserEdit size={20} /><span>Edit In-Game Username</span><span className="arrow">&gt;</span></button>
                  <button className="account-option" onClick={() => setAccountView("refer")}><FaGift size={20} /><span>Refer a Friend</span><span className="arrow">&gt;</span></button>
                  <button className="account-option" onClick={() => setAccountView("match_history")}><FaHistory size={20} /><span>Match History</span><span className="arrow">&gt;</span></button>
                  <button className="account-option" onClick={() => setAccountView("withdraw_history")}><FaMoneyBillWave size={20} /><span>Withdrawal History</span><span className="arrow">&gt;</span></button>
                  <button className="account-option logout" onClick={handleLogout}><FaSignOutAlt size={20} /><span>Logout</span><span className="arrow">&gt;</span></button>
                </section>
              </>
            )}

            {accountView === "profile" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}><FaArrowLeft /> Back</button>
                <h3 className="modern-title">Profile Settings</h3>
                <div className="profile-settings-form">
                  <div className="form-group"><label>Email</label><input type="text" className="modern-input" value={user.email} disabled /></div>
                  <div className="form-group"><label>User ID</label><input type="text" className="modern-input" value={user.uid} disabled /></div>
                  <hr />
                  <form className="form-group" onSubmit={handleUpdateDisplayName}>
                    <label>Display Name</label><input type="text" className="modern-input" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Enter display name" />
                    <button type="submit" className="btn" disabled={loadingAction}>{loadingAction ? "Saving..." : "Save Name"}</button>
                  </form>
                  <hr />
                  <div className="form-group"><label>Password</label><button className="btn ghost" onClick={handlePasswordReset}>Send Password Reset Email</button></div>
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
                  <p className="modern-subtitle" style={{ textAlign: "center" }}>Share this code with your friends. When they use it, they get 50 coins and you get 20 coins!</p>
                </div>

                {!profile.hasRedeemedReferral && (
                  <div className="referral-form">
                    <p>Have a friend's code?</p>
                    <input type="text" className="modern-input" placeholder="Enter referral code" value={referralInput} onChange={(e) => setReferralInput(e.target.value)} />
                    <button className="btn glow large" onClick={handleRedeemReferral}>{loadingAction ? "Processing..." : "Redeem Code"}</button>
                  </div>
                )}
              </section>
            )}

            {accountView === "match_history" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}><FaArrowLeft /> Back</button>
                <MatchHistoryPage user={user} />
              </section>
            )}

            {accountView === "withdraw_history" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}><FaArrowLeft /> Back</button>
                <WithdrawalHistoryPage user={user} />
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="bottom-nav">
        {["home", "matches", "topup", "withdraw", "account"].map((tab) => (
          <button
            key={tab}
            className={`nav-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => { setActiveTab(tab); setAccountView("main"); setSelectedMatch(null); setTopupView("select"); }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>

      {/* Username modal */}
      {showUsernameModal && (
        <div className="modal-overlay" onClick={() => setShowUsernameModal(false)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">{profile.username ? "Edit Your Username" : "Set Your In-Game Username"}</h3>
            <p className="modern-subtitle">You must set a username before joining a match.</p>
            <form onSubmit={handleSetUsername}>
              <input type="text" className="modern-input" placeholder="Enter username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              <button type="submit" className="btn glow large" disabled={loadingAction}>{loadingAction ? "Saving..." : "Save"}</button>
              <button type="button" className="btn large ghost" onClick={() => setShowUsernameModal(false)} style={{ marginTop: 10 }}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* UPI modal for rewards */}
      {showUpiModal && pendingReward && (
        <div className="modal-overlay" onClick={() => setShowUpiModal(false)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Enter your UPI ID to receive ₹{pendingReward.amount}</h3>
            <p className="modern-subtitle">10% commission already included in coin cost.</p>
            <input type="text" className="modern-input" placeholder="yourupi@bank" value={upiInput} onChange={(e) => setUpiInput(e.target.value)} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn glow large" onClick={() => handleRedeemReward(pendingReward, upiInput)} disabled={loadingAction}>{loadingAction ? "Submitting..." : "OK"}</button>
              <button className="btn large ghost" onClick={() => { setShowUpiModal(false); setPendingReward(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Generic modal message */}
      {modalMessage && (
        <div className="modal-overlay" onClick={() => setModalMessage(null)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Notification</h3>
            <p className="modern-subtitle" style={{ textAlign: "center", marginBottom: 24 }}>{modalMessage}</p>
            <button className="btn glow large" onClick={() => setModalMessage(null)}>OK</button>
          </div>
        </div>
      )}

      {/* Settle modal */}
      {showSettleModal && matchToSettle && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Settle Match</h3>
            <p className="modern-subtitle">Settle: {matchToSettle.title}</p>
            <form onSubmit={handleSettleMatch}>
              <div className="form-group"><label>Winner's Username</label><input type="text" className="modern-input" value={winnerUsername} onChange={(e) => setWinnerUsername(e.target.value)} /></div>
              {matchToSettle.prizeModel === "Scalable" && <div className="form-group"><label>Winner's Kills</label><input type="number" className="modern-input" value={winnerKills} onChange={(e) => setWinnerKills(parseInt(e.target.value || 0, 10))} /></div>}
              <button type="submit" className="btn glow large" disabled={loadingAction}>{loadingAction ? "Submitting..." : "Award Prize & End Match"}</button>
              <button type="button" className="btn large ghost" style={{ marginTop: 10 }} onClick={() => setShowSettleModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
