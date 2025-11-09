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

// Default match form state
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

// Rewards / redemption options
const rewardOptions = [
  { type: "UPI", amount: 25, cost: 275, icon: "/upi.png" },
  { type: "UPI", amount: 50, cost: 550, icon: "/upi.png" },
  { type: "Google Play", amount: 50, cost: 550, icon: "/google-play.png" },
  { type: "Google Play", amount: 100, cost: 1100, icon: "/google-play.png" },
  { type: "Amazon", amount: 50, cost: 550, icon: "/amazon.png" },
  { type: "Amazon", amount: 100, cost: 1100, icon: "/amazon.png" },
];

function formatMatchTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "Time TBD";
  return timestamp.toDate().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [topupAmount, setTopupAmount] = useState("");
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });
  const [selectedAmount, setSelectedAmount] = useState(null);
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
  const [newDisplayName, setNewDisplayName] = useState("");
  const [modalMessage, setModalMessage] = useState(null);
  const [topupView, setTopupView] = useState("select");
  const [paymentUpiId, setPaymentUpiId] = useState("");
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [matchToSettle, setMatchToSettle] = useState(null);
  const [winnerUsername, setWinnerUsername] = useState("");
  const [winnerKills, setWinnerKills] = useState(0);

  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";
  const adminPassword = "imperialx";

  // Load profile / ensure referral fields and ad counters exist
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          // Ensure referralCode exists
          if (!data.referralCode) {
            const newReferralCode = user.uid.substring(0, 8).toUpperCase();
            await updateDoc(ref, {
              referralCode: newReferralCode,
              hasRedeemedReferral: data.hasRedeemedReferral || false,
            });
            // refresh doc
            const refreshed = await getDoc(ref);
            if (mounted) {
              setProfile({ id: refreshed.id, ...refreshed.data() });
              setNewDisplayName(refreshed.data().displayName || "");
            }
          } else {
            if (mounted) {
              setProfile({ id: snap.id, ...data });
              setNewDisplayName(data.displayName || "");
            }
          }
        } else {
          // New user doc
          const newReferralCode = user.uid.substring(0, 8).toUpperCase();
          const initialData = {
            email: user.email,
            coins: 0,
            adsWatchedToday: 0,
            lastAdWatch: null,
            displayName: user.displayName || "",
            username: "",
            lastDaily: null,
            createdAt: serverTimestamp(),
            referralCode: newReferralCode,
            hasRedeemedReferral: false,
          };
          await setDoc(ref, initialData);
          if (mounted) {
            setProfile({ id: ref.id, ...initialData });
            setNewDisplayName(initialData.displayName);
          }
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

  // Load matches when matches tab opened
  useEffect(() => {
    async function loadMatches() {
      setLoadingMatches(true);
      try {
        const matchesRef = collection(db, "matches");
        const q = query(
          matchesRef,
          where("status", "==", "upcoming"),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const matchesData = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMatches(matchesData);
      } catch (err) {
        console.error("Error loading matches:", err);
      } finally {
        setLoadingMatches(false);
      }
    }
    if (activeTab === "matches") loadMatches();
  }, [activeTab]);

  // Pre-fill username
  useEffect(() => {
    if (profile?.username) setNewUsername(profile.username);
  }, [showUsernameModal, profile?.username]);

  // Toggle music
  const toggleMusic = () => {
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  // addCoin helper (keeps UI + firestore in sync)
  async function addCoin(n = 1) {
    if (!profile) return;
    try {
      const ref = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) + n;
      await updateDoc(ref, { coins: newCoins });
      setProfile((prev) => ({ ...prev, coins: newCoins }));
    } catch (err) {
      console.error("addCoin error:", err);
      setModalMessage("Failed to add coins.");
    }
  }

  // Claim daily (+10)
  async function claimDaily() {
    if (!profile) return;
    const last =
      profile.lastDaily && typeof profile.lastDaily.toDate === "function"
        ? profile.lastDaily.toDate()
        : profile.lastDaily || null;
    const now = new Date();
    const isSameDay = last && last.toDateString && last.toDateString() === now.toDateString();
    if (isSameDay) return setModalMessage("You already claimed today's coin.");

    try {
      const ref = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) + 10;
      await updateDoc(ref, { coins: newCoins, lastDaily: serverTimestamp() });
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
      setModalMessage("+10 coins credited!");
    } catch (err) {
      console.error("claimDaily error:", err);
      setModalMessage("Failed to claim daily.");
    }
  }

  // -----------------------------
  // WATCH AD: rewards 3 coins, limit 5/day
  // -----------------------------
  async function watchAd() {
    if (!profile) return;

    const ref = doc(db, "users", user.uid);
    // determine today's count
    const now = new Date();
    const todayStr = now.toDateString();

    const lastAdRaw = profile.lastAdWatch && typeof profile.lastAdWatch.toDate === "function"
      ? profile.lastAdWatch.toDate()
      : profile.lastAdWatch;
    const lastAdDateStr = lastAdRaw ? new Date(lastAdRaw).toDateString() : null;
    const adsToday = lastAdDateStr === todayStr ? (profile.adsWatchedToday || 0) : 0;

    if (adsToday >= 5) {
      return setModalMessage("You’ve reached today’s ad limit (5/day).");
    }

    if (adLoading) return;
    if (!window.adbreak && !window.adsbygoogle) {
      // If ad system absent, fail gracefully
      console.error("Ad system not available.");
      setModalMessage("Ads are not available right now. Please try again later.");
      return;
    }

    setAdLoading(true);
    try {
      // Use adbreak integration if available
      // Many ad SDKs accept callbacks; this matches your previous structure
      window.adbreak({
        type: "reward",
        name: "watch-ad-reward",
        adDismissed: () => {
          setAdLoading(false);
        },
        adBreakDone: async (placementInfo) => {
          // If provider returns placementInfo, ensure it was viewed
          if (placementInfo && placementInfo.breakStatus && placementInfo.breakStatus !== "viewed" && placementInfo.breakStatus !== "dismissed") {
            console.error("Ad failed:", placementInfo);
            if (placementInfo.breakStatus !== "unfilled") {
              setModalMessage("Ads failed to load. Please try again later.");
            }
            setAdLoading(false);
            return;
          }

          // award coins and increment count
          const newAdsCount = adsToday + 1;
          const newCoins = (profile.coins || 0) + 3;

          await updateDoc(ref, {
            coins: newCoins,
            adsWatchedToday: newAdsCount,
            lastAdWatch: serverTimestamp(),
          });

          setProfile((p) => ({
            ...p,
            coins: newCoins,
            adsWatchedToday: newAdsCount,
            lastAdWatch: now,
          }));

          setModalMessage("+3 coins credited for watching the ad!");
          setAdLoading(false);
        },
        beforeReward: (showAdFn) => {
          // Some ad SDKs expect showAdFn to be called in a callback — we call it directly.
          try {
            showAdFn();
          } catch (err) {
            // If showAdFn not provided, rely on adBreakDone callback for awarding
            console.warn("showAdFn not callable:", err);
          }
        },
      });
    } catch (err) {
      console.error("Ad error:", err);
      setModalMessage("An ad error occurred.");
      setAdLoading(false);
    }
  }

  // -----------------------------
  // TOP-UP flow
  // -----------------------------
  async function handleTopup() {
    const amt = parseInt(selectedAmount || topupAmount);
    if (!amt || amt < 20) return setModalMessage("Minimum top-up is ₹20.");
    setTopupView("pay");
  }

  async function handleConfirmPayment() {
    const amt = parseInt(selectedAmount || topupAmount);
    if (!paymentUpiId) return setModalMessage("Please enter your UPI ID so we can verify your payment.");
    try {
      setLoading(true);
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: amt,
        coins: amt * 10, // your chosen exchange
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
      console.error("Top-up error:", err);
      setModalMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // REDEEM / WITHDRAW (10% commission for UPI)
  // -----------------------------
  async function handleRedeemReward(reward) {
    if (!profile) return;
    if (profile.coins < reward.cost) return setModalMessage("You don't have enough coins for this reward.");

    let upiId = "";
    if (reward.type === "UPI") {
      upiId = window.prompt(`Enter your UPI ID to receive ₹${reward.amount}:`);
      if (!upiId) return setModalMessage("UPI ID is required. Redemption cancelled.");
    } else {
      if (!window.confirm(`Redeem ${reward.type} Gift Card (₹${reward.amount}) for ${reward.cost} coins?`)) {
        return;
      }
    }

    try {
      setLoading(true);
      const finalAmount = reward.type === "UPI" ? Math.floor(reward.amount * 0.9) : reward.amount;

      await addDoc(collection(db, "withdrawRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: finalAmount,
        originalAmount: reward.amount,
        coinsDeducted: reward.cost,
        status: "pending",
        type: reward.type,
        upiId,
        commissionApplied: reward.type === "UPI" ? "10%" : "0%",
        createdAt: serverTimestamp(),
      });

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { coins: profile.coins - reward.cost });

      setProfile((p) => ({ ...p, coins: p.coins - reward.cost }));

      if (reward.type === "UPI") {
        setModalMessage(`Withdrawal request submitted! ₹${finalAmount} will be sent after 10% fee.`);
      } else {
        setModalMessage("Redemption request submitted! Admin will email your code within 24 hours.");
      }
    } catch (err) {
      console.error("Withdraw error:", err);
      setModalMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // Join match
  // -----------------------------
  async function handleJoinMatch(match) {
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
    if (playersJoined.length >= maxPlayers) return setModalMessage("Sorry, this match is full.");
    if (profile.coins < entryFee) return setModalMessage("You don't have enough coins to join this match.");
    if (!window.confirm(`Join this match for ${entryFee} coins?`)) return;

    try {
      setLoading(true);
      const userDocRef = doc(db, "users", user.uid);
      const matchDocRef = doc(db, "matches", matchId);

      await updateDoc(userDocRef, { coins: profile.coins - entryFee });
      await updateDoc(matchDocRef, { playersJoined: arrayUnion(user.uid) });

      setProfile({ ...profile, coins: profile.coins - entryFee });

      const updatedPlayers = [...playersJoined, user.uid];
      const updatedMatch = { ...match, playersJoined: updatedPlayers };

      setMatches((prevMatches) => prevMatches.map((m) => (m.id === matchId ? updatedMatch : m)));

      setModalMessage("You have successfully joined the match!");
      setSelectedMatch(updatedMatch);
    } catch (err) {
      console.error("Error joining match:", err);
      setModalMessage("An error occurred while joining. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // Admin: load requests + upcoming matches
  // -----------------------------
  useEffect(() => {
    if (profile?.email !== adminEmail) return;
    (async () => {
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
    })();
  }, [profile?.email, activeTab]);

  // Approve / Reject handlers (admin)
  async function approveRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "approved" });

    if (type === "topup") {
      const userDocRef = doc(db, "users", req.userId);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const userCurrentCoins = userSnap.data().coins || 0;
        await updateDoc(userDocRef, { coins: userCurrentCoins + req.coins });
      } else {
        console.error("User not found for approval");
        setModalMessage("Error: User not found.");
      }
    }

    setModalMessage(`${type} approved.`);
    setRequests((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== req.id) }));
  }

  async function rejectRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "rejected" });
    setModalMessage(`${type} rejected.`);
    setRequests((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== req.id) }));
  }

  // New match form handlers
  const handleNewMatchChange = (e) => {
    const { name, value, type } = e.target;
    const val = type === "number" ? parseInt(value) || 0 : value;
    setNewMatch((prev) => ({ ...prev, [name]: val }));
  };

  async function handleCreateMatch(e) {
    e.preventDefault();
    if (!newMatch.title || !newMatch.imageUrl || !newMatch.startTime) return setModalMessage("Please fill in Title, Image URL, and Start Time.");

    try {
      setLoading(true);
      let matchData = {
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
      setModalMessage("Match created successfully!");
      setNewMatch(initialMatchState);
      setMatches((prev) => [{ ...matchData, id: "new" }, ...prev]);
    } catch (err) {
      console.error("Error creating match:", err);
      setModalMessage("Failed to create match. Check console for error.");
    } finally {
      setLoading(false);
    }
  }

  // Set username / display name / password reset / logout
  async function handleSetUsername(e) {
    e.preventDefault();
    if (!newUsername) return setModalMessage("Username cannot be blank.");
    try {
      setLoading(true);
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { username: newUsername });
      setProfile({ ...profile, username: newUsername });
      setModalMessage("Username updated successfully!");
      setShowUsernameModal(false);
    } catch (err) {
      console.error("Error setting username:", err);
      setModalMessage("Failed to set username.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateDisplayName(e) {
    e.preventDefault();
    if (!newDisplayName) return setModalMessage("Display name cannot be blank.");
    if (newDisplayName === profile.displayName) return setModalMessage("No changes made.");
    try {
      setLoading(true);
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: newDisplayName });
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { displayName: newDisplayName });
      setProfile({ ...profile, displayName: newDisplayName });
      setModalMessage("Display name updated successfully!");
    } catch (err) {
      console.error("Error updating display name:", err);
      setModalMessage("Failed to update display name.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return setModalMessage("Could not find user email.");
    const providerIds = auth.currentUser.providerData.map((p) => p.providerId);
    if (!providerIds.includes("password")) {
      console.log("Password reset blocked. User providers:", providerIds);
      return setModalMessage("Password reset is not available. You signed in using Google.");
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      setModalMessage("Password reset email sent! Please check your inbox to set a new password.");
    } catch (err) {
      console.error("Password reset error:", err);
      setModalMessage("Failed to send password reset email. Please try again later.");
    }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  // Admin settle modal open
  const openSettleModal = (match) => {
    setMatchToSettle(match);
    setWinnerKills(0);
    setWinnerUsername("");
    setShowSettleModal(true);
  };

  // Call settleMatch API (example uses app check token)
  async function handleSettleMatch(e) {
    e.preventDefault();
    if (!matchToSettle || !winnerUsername) return setModalMessage("Winner username is required.");

    setLoading(true);
    try {
      let appCheckToken;
      try {
        appCheckToken = await getToken(appCheckInstance, false);
      } catch (err) {
        throw new Error("Failed to get App Check token.");
      }

      const idToken = await user.getIdToken();

      const response = await fetch("/api/settleMatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-Firebase-AppCheck": appCheckToken.token,
        },
        body: JSON.stringify({
          matchId: matchToSettle.id,
          winnerUsername,
          kills: winnerKills,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setModalMessage(data.message);
        setMatches((prev) => prev.filter((m) => m.id !== matchToSettle.id));
        setShowSettleModal(false);
      } else {
        setModalMessage(data.message);
      }
    } catch (err) {
      console.error("Settle Match error:", err);
      setModalMessage("An error occurred: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !profile) return <div className="center-screen">Loading Dashboard...</div>;

  // -----------------------------
  // JSX — UI
  // -----------------------------
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
          <button className="btn small ghost music-btn" onClick={toggleMusic}>
            {isPlaying ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>
          {profile.email === adminEmail && <button className="btn small" onClick={() => setActiveTab("admin")}>Admin Panel</button>}
        </div>
      </header>

      <main className="dash-main">
        {activeTab === "home" && (
          <>
            <section className="panel">
              <div className="panel-row">
                <div>
                  <div className="muted">Coins</div>
                  <div className="big coin-row">
                    <img src="/coin.jpg" alt="coin" className="coin-icon" style={{ width: "28px", height: "28px", borderRadius: "50%", animation: "spinCoin 3s linear infinite" }} />
                    <span>{profile.coins ?? 0}</span>
                  </div>
                </div>
                <div className="home-actions">
                  <button className="btn" onClick={claimDaily}>Claim Daily (+10)</button>
                  <button className="btn ghost" onClick={watchAd} disabled={adLoading}>{adLoading ? "Loading Ad..." : "Watch Ad (+3)"}</button>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Welcome!</h3>
              <p>Check the matches tab to join a game.</p>
            </section>
          </>
        )}

        {activeTab === "matches" && (
          <>
            {!selectedMatch ? (
              <section className="panel">
                <h3>Available Matches</h3>
                {loadingMatches && <p>Loading matches...</p>}
                {!loadingMatches && matches.length === 0 && <p>No upcoming matches right now. Check back soon!</p>}
                <div className="grid">
                  {matches.map((match) => {
                    const hasJoined = match.playersJoined?.includes(user.uid);
                    const isFull = match.playersJoined?.length >= match.maxPlayers;
                    return (
                      <div key={match.id} className="match-card" onClick={() => setSelectedMatch(match)}>
                        <img src={match.imageUrl} alt={match.title} />
                        <div className="match-info">
                          <div className="match-title">{match.title}</div>
                          <div className="match-meta time">Starts: {formatMatchTime(match.startTime)}</div>
                          <div className="match-meta">Entry: {match.entryFee} Coins | Joined: {match.playersJoined?.length || 0} / {match.maxPlayers}</div>
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
                  <button className="btn small" onClick={() => setShowUsernameModal(true)}><FaUserEdit style={{ marginRight: 8 }} />Edit Username</button>
                </div>

                <img src={selectedMatch.imageUrl} alt="match" className="match-details-image" />
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
                        <div className="room-details pending">
                          <p>You have joined! Room ID and Password will be revealed here 15 minutes before the match starts.</p>
                        </div>
                      ) : null}
                      <div className="match-rules">
                        <h4>Match Rules</h4>
                        <p>{selectedMatch.rules || "No specific rules provided for this match."}</p>
                      </div>
                    </>
                  );
                })()}
              </section>
            )}
          </>
        )}

        {activeTab === "topup" && (
          <>
            {topupView === "select" && (
              <section className="modern-card">
                <h3 className="modern-title">Top-up Coins</h3>
                <p className="modern-subtitle">1 ₹ = 10 Coins | Choose an amount</p>
                <div className="amount-options">
                  {[20, 50, 100, 200].map((amt) => (
                    <div key={amt} className={`amount-btn ${selectedAmount === amt ? "selected" : ""}`} onClick={() => setSelectedAmount(amt)}>
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
                  <button className="btn glow large" onClick={handleConfirmPayment} disabled={loading}>{loading ? "Submitting..." : "I Have Paid"}</button>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === "withdraw" && (
          <div className="withdraw-container">
            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: 10 }}>Redeem Coins as UPI</h3>
              <p className="modern-subtitle" style={{ paddingLeft: 10 }}>10% commission fee</p>
              <div className="reward-grid">
                {rewardOptions.filter((opt) => opt.type === "UPI").map((reward) => (
                  <div key={`${reward.type}-${reward.amount}`} className="reward-card" onClick={() => handleRedeemReward(reward)}>
                    <img src={reward.icon} alt="UPI" className="reward-icon" />
                    <div className="reward-cost"><img src="/coin.jpg" alt="coin" /><span>{reward.cost}</span></div>
                    <div className="reward-amount">₹ {reward.amount}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: 10 }}>Redeem as Google Gift Card</h3>
              <div className="reward-grid">
                {rewardOptions.filter((opt) => opt.type === "Google Play").map((reward) => (
                  <div key={`${reward.type}-${reward.amount}`} className="reward-card" onClick={() => handleRedeemReward(reward)}>
                    <img src={reward.icon} alt="Google Play" className="reward-icon" />
                    <div className="reward-cost"><img src="/coin.jpg" alt="coin" /><span>{reward.cost}</span></div>
                    <div className="reward-amount">₹ {reward.amount}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: 10 }}>Redeem as Amazon Gift Card</h3>
              <div className="reward-grid">
                {rewardOptions.filter((opt) => opt.type === "Amazon").map((reward) => (
                  <div key={`${reward.type}-${reward.amount}`} className="reward-card" onClick={() => handleRedeemReward(reward)}>
                    <img src={reward.icon} alt="Amazon" className="reward-icon" />
                    <div className="reward-cost"><img src="/coin.jpg" alt="coin" /><span>{reward.cost}</span></div>
                    <div className="reward-amount">₹ {reward.amount}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === "admin" && profile.email === adminEmail && (
          <section className="panel">
            <h3>Admin Panel</h3>
            <form onSubmit={handleCreateMatch} className="admin-form">
              <h4>Create New Match</h4>
              <input name="title" className="modern-input" placeholder="Match Title (e.g., 1v1 Clash Squad)" value={newMatch.title} onChange={handleNewMatchChange} />
              <input name="imageUrl" className="modern-input" placeholder="Image URL (e.g., /cs.jpg)" value={newMatch.imageUrl} onChange={handleNewMatchChange} />
              <label>Start Time</label>
              <input name="startTime" type="datetime-local" className="modern-input" value={newMatch.startTime} onChange={handleNewMatchChange} />
              <label>Match Type</label>
              <select name="type" className="modern-input" value={newMatch.type} onChange={handleNewMatchChange}>
                <option value="BR">Battle Royale</option>
                <option value="CS">Clash Squad</option>
              </select>
              <label>Prize Model</label>
              <select name="prizeModel" className="modern-input" value={newMatch.prizeModel} onChange={handleNewMatchChange}>
                <option value="Scalable">Scalable (BR - % commission)</option>
                <option value="Fixed">Fixed (CS - fixed prize)</option>
              </select>
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
              <button type="submit" className="btn glow">Create Match</button>
            </form>

            <hr style={{ margin: "24px 0", borderColor: "var(--panel)" }} />

            <h4>Settle Upcoming Matches</h4>
            <div className="admin-match-list">
              {matches.filter((m) => m.status === "upcoming").length > 0 ? (
                matches.filter((m) => m.status === "upcoming").map((match) => (
                  <div key={match.id} className="admin-row">
                    <span>{match.title}</span>
                    <button className="btn small" onClick={() => openSettleModal(match)}>Settle</button>
                  </div>
                ))
              ) : (
                <p className="muted-small" style={{ textAlign: "center" }}>No matches to settle.</p>
              )}
            </div>

            <hr style={{ margin: "24px 0", borderColor: "var(--panel)" }} />

            <h4>Top-up Requests</h4>
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

                  <button className="account-option" onClick={() => setShowUsernameModal(true)}>
                    <FaUserEdit size={20} /><span>Edit In-Game Username</span><span className="arrow">&gt;</span>
                  </button>

                  <button className="account-option" onClick={() => setAccountView("refer")}>
                    <FaGift size={20} /><span>Refer a Friend</span><span className="arrow">&gt;</span>
                  </button>

                  <button className="account-option" onClick={() => setAccountView("match_history")}>
                    <FaHistory size={20} /><span>Match History</span><span className="arrow">&gt;</span>
                  </button>

                  <button className="account-option" onClick={() => setAccountView("withdraw_history")}>
                    <FaMoneyBillWave size={20} /><span>Withdrawal History</span><span className="arrow">&gt;</span>
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
                    <input type="text" className="modern-input" value={user.email} disabled />
                  </div>
                  <div className="form-group">
                    <label>User ID</label>
                    <input type="text" className="modern-input" value={user.uid} disabled />
                  </div>
                  <hr />
                  <form className="form-group" onSubmit={handleUpdateDisplayName}>
                    <label>Display Name</label>
                    <input type="text" className="modern-input" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Enter your display name" />
                    <button type="submit" className="btn" disabled={loading}>{loading ? "Saving..." : "Save Name"}</button>
                  </form>
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
                  <div className="referral-code">{profile.referralCode ? profile.referralCode : "Loading..."}</div>
                  <p className="modern-subtitle" style={{ textAlign: "center" }}>
                    Share this code with your friends. When they use it, they get 50 coins and you get 20 coins!
                  </p>
                </div>

                {!profile.hasRedeemedReferral && (
                  <div className="referral-form">
                    <p>Have a friend's code?</p>
                    <input type="text" className="modern-input" placeholder="Enter referral code" value={referralInput} onChange={(e) => setReferralInput(e.target.value)} />
                    <button className="btn glow large" onClick={async () => {
                      // Reuse your existing handleRedeemReferral flow (calls server function)
                      // Keep current implementation — it's in your code earlier; simply call it
                      // But to avoid duplication, call the existing function if present
                      // If you prefer I can inline it here — currently your code contains handleRedeemReferral earlier
                      if (typeof handleRedeemReferral === "function") {
                        handleRedeemReferral();
                      } else {
                        setModalMessage("Redeem function not available.");
                      }
                    }}>Redeem Code</button>
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
            onClick={() => {
              setActiveTab(tab);
              setAccountView("main");
              setSelectedMatch(null);
              setTopupView("select");
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>

      {showUsernameModal && (
        <div className="modal-overlay">
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">{profile.username ? "Edit Your Username" : "Set Your In-Game Username"}</h3>
            <p className="modern-subtitle">You must set a username before joining a match. This name will be used in tournaments.</p>
            <form onSubmit={handleSetUsername}>
              <input type="text" className="modern-input" placeholder="Enter your username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              <button type="submit" className="btn glow large" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
              <button type="button" className="btn large ghost" style={{ marginTop: 10 }} onClick={() => setShowUsernameModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {modalMessage && (
        <div className="modal-overlay" onClick={() => setModalMessage(null)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Notification</h3>
            <p className="modern-subtitle" style={{ textAlign: "center", marginBottom: 24 }}>{modalMessage}</p>
            <button className="btn glow large" onClick={() => setModalMessage(null)}>OK</button>
          </div>
        </div>
      )}

      {showSettleModal && matchToSettle && (
        <div className="modal-overlay">
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Settle Match</h3>
            <p className="modern-subtitle">Settle: {matchToSettle.title}</p>
            <form onSubmit={handleSettleMatch}>
              <div className="form-group">
                <label>Winner's Username</label>
                <input type="text" className="modern-input" placeholder="Enter winner's in-game username" value={winnerUsername} onChange={(e) => setWinnerUsername(e.target.value)} />
              </div>
              {matchToSettle.prizeModel === "Scalable" && (
                <div className="form-group">
                  <label>Winner's Kills</label>
                  <input type="number" className="modern-input" placeholder="Enter kill count" value={winnerKills} onChange={(e) => setWinnerKills(parseInt(e.target.value) || 0)} />
                </div>
              )}
              <button type="submit" className="btn glow large" disabled={loading}>{loading ? "Submitting..." : "Award Prize & End Match"}</button>
              <button type="button" className="btn large ghost" style={{ marginTop: 10 }} onClick={() => setShowSettleModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
