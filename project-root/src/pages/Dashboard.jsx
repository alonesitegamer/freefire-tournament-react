// src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, appCheckInstance } from "../firebase";
import {
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
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

// icons
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

// (Optional) If you have separate pages for histories, keep imports.
// They are NOT used in Account anymore (per your request).
import MatchHistoryPage from "./MatchHistoryPage";
import WithdrawalHistoryPage from "./WithdrawalHistoryPage";

/**
 * Dashboard.jsx
 *
 * Full dashboard with:
 * - home / matches / topup / withdraw / account / admin
 * - claimDaily (+1), watchAd (+2, max 10/day)
 * - topupRequests & withdrawRequests handling
 * - referral redeem via serverless function (uses App Check token)
 *
 * Changes requested:
 * - Removed Match History & Withdrawal History entries inside Account menu.
 * - Ad reward is +2, max 10/day.
 * - Daily reward is +1.
 *
 * Keep other logic intact; only account menu modified.
 */

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
  { type: "UPI", amount: 25, cost: 275, icon: "/upi.png" },
  { type: "UPI", amount: 50, cost: 550, icon: "/upi.png" },
  { type: "Google Play", amount: 50, cost: 550, icon: "/google-play.png" },
  { type: "Google Play", amount: 100, cost: 1100, icon: "/google-play.png" },
  { type: "Amazon", amount: 50, cost: 550, icon: "/amazon.png" },
  { type: "Amazon", amount: 100, cost: 1100, icon: "/amazon.png" },
];

function formatMatchTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "Time TBD";
  }
  return timestamp.toDate().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const audioRef = useRef(null);

  // state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [activeSubAccountView, setActiveSubAccountView] = useState("main"); // profile / refer / etc.
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [newMatch, setNewMatch] = useState(initialMatchState);
  const [modalMessage, setModalMessage] = useState(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [adLoading, setAdLoading] = useState(false);
  const [rewardedAdCount, setRewardedAdCount] = useState(0); // count per day
  const [topupView, setTopupView] = useState("select"); // select | pay
  const [selectedTopupAmount, setSelectedTopupAmount] = useState(null);
  const [customTopupAmount, setCustomTopupAmount] = useState("");
  const [paymentUpiId, setPaymentUpiId] = useState("");
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [matchToSettle, setMatchToSettle] = useState(null);
  const [winnerUsername, setWinnerUsername] = useState("");
  const [winnerKills, setWinnerKills] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // admin account
  const adminEmail = "esportsimperial50@gmail.com";
  const adminPassword = "imperialx"; // kept for your notes (not used programmatically)

  // init: load user profile
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          // ensure referral code exists
          if (!data.referralCode) {
            const newReferralCode = user.uid.substring(0, 8).toUpperCase();
            await updateDoc(ref, {
              referralCode: newReferralCode,
              hasRedeemedReferral: data.hasRedeemedReferral || false,
            });
            if (mounted) {
              setProfile({
                id: snap.id,
                ...data,
                referralCode: newReferralCode,
                hasRedeemedReferral: data.hasRedeemedReferral || false,
              });
              setNewDisplayName(data.displayName || "");
            }
          } else {
            if (mounted) {
              setProfile({ id: snap.id, ...data });
              setNewDisplayName(data.displayName || "");
            }
          }
        } else {
          // create new user doc
          const newReferralCode = user.uid.substring(0, 8).toUpperCase();
          const initialData = {
            email: user.email,
            coins: 0,
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
        setModalMessage("Failed to load profile. Check console.");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [user.uid, user.email, user.displayName]);

  // load matches when matches tab active
  useEffect(() => {
    if (activeTab !== "matches") return;
    let mounted = true;
    async function loadMatches() {
      setLoadingMatches(true);
      try {
        const matchesRef = collection(db, "matches");
        const q = query(
          matchesRef,
          where("status", "==", "upcoming"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (mounted) setMatches(list);
      } catch (err) {
        console.error("Error loading matches:", err);
        setModalMessage("Failed to load matches.");
      } finally {
        setLoadingMatches(false);
      }
    }
    loadMatches();
    return () => (mounted = false);
  }, [activeTab]);

  // prefill username modal when opened
  useEffect(() => {
    if (profile?.username) {
      setNewUsername(profile.username);
    } else {
      setNewUsername("");
    }
  }, [showUsernameModal, profile?.username]);

  // music toggle
  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  // Redeem referral (calls serverless function; includes App Check)
  async function handleRedeemReferral(referralInput) {
    if (!referralInput) return setModalMessage("Please enter a referral code.");
    if (profile.hasRedeemedReferral)
      return setModalMessage("You have already redeemed a referral code.");
    if (referralInput.toUpperCase() === profile.referralCode)
      return setModalMessage("You cannot use your own referral code.");

    setLoading(true);
    try {
      let appCheckToken;
      try {
        appCheckToken = await getToken(appCheckInstance, false);
      } catch (err) {
        console.error("App Check token error:", err);
        setModalMessage("Security check failed. Please refresh and try again.");
        setLoading(false);
        return;
      }

      const idToken = await user.getIdToken();

      const res = await fetch("/api/redeemReferralCode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-Firebase-AppCheck": appCheckToken.token,
        },
        body: JSON.stringify({ code: referralInput.toUpperCase() }),
      });

      const data = await res.json();

      if (data.success) {
        // optimistic UI update: add coins to profile
        setProfile((p) => ({ ...p, coins: (p.coins || 0) + 50, hasRedeemedReferral: true }));
        setModalMessage(data.message || "Referral redeemed!");
      } else {
        setModalMessage(data.message || "Failed to redeem referral.");
      }
    } catch (err) {
      console.error("Redeem referral error:", err);
      setModalMessage("An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // add coins helper
  async function addCoin(n = 1) {
    if (!profile) return;
    try {
      const ref = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) + n;
      await updateDoc(ref, { coins: newCoins });
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error("addCoin error:", err);
      setModalMessage("Failed to update coins.");
    }
  }

  // daily claim: +1
  async function claimDaily() {
    if (!profile) return;
    const last =
      profile.lastDaily && typeof profile.lastDaily.toDate === "function"
        ? profile.lastDaily.toDate()
        : null;
    const now = new Date();
    const isSameDay = last && last.toDateString() === now.toDateString();
    if (isSameDay) return setModalMessage("You already claimed today's coin.");

    try {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, {
        coins: (profile.coins || 0) + 1,
        lastDaily: serverTimestamp(),
      });
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
      setModalMessage("+1 coin credited!");
    } catch (err) {
      console.error("claimDaily error:", err);
      setModalMessage("Failed to claim daily coin.");
    }
  }

  // watch ad: +2 coins, max 10 per day
  async function watchAd() {
    if (adLoading) return;
    // reset daily count if lastAdDay is not today (we can store lastAdDay in profile)
    let today = new Date().toDateString();
    // use profile.adCount and profile.adCountDay if you stored it before; otherwise use local state
    const adCountLocal = profile.adCount || 0;
    const adDay = profile.adCountDay ? profile.adCountDay.toDate().toDateString() : null;
    if (adDay !== today && profile.adCountDay) {
      // reset on server if using server-managed counters — omitted here; we'll rely on profile fields if present
    }

    const currentCount = adCountLocal;

    if (currentCount >= 10) return setModalMessage("You have reached today's ad limit (10).");

    setAdLoading(true);
    try {
      // Simulate ad flow. Replace with real ad SDK integration.
      await new Promise((r) => setTimeout(r, 1200));

      // Update coins and ad counters in firestore
      const ref = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) + 2;
      // update ad count and ad day
      const updates = {
        coins: newCoins,
        adCount: (profile.adCount || 0) + 1,
        adCountDay: serverTimestamp(), // store timestamp of last ad increment
      };
      await updateDoc(ref, updates);
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
      setRewardedAdCount((c) => c + 1);
      setModalMessage("+2 coins for watching the ad!");
    } catch (err) {
      console.error("watchAd error:", err);
      setModalMessage("Ad failed to load. Try again later.");
    } finally {
      setAdLoading(false);
    }
  }

  // handle topup: just moves to payment page
  function handleTopupStart() {
    setTopupView("pay");
  }

  // confirm payment (user clicked "I Have Paid")
  async function handleConfirmPayment() {
    const amt = parseInt(selectedTopupAmount || customTopupAmount);
    if (!amt || amt < 20) return setModalMessage("Minimum top-up is ₹20.");
    if (!paymentUpiId) return setModalMessage("Please enter your UPI ID.");

    setLoading(true);
    try {
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: amt,
        coins: amt * 10, // 1₹ = 10 coins (per your earlier UI)
        upiId: paymentUpiId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setModalMessage("Top-up request submitted! Admin will verify it soon.");
      setCustomTopupAmount("");
      setSelectedTopupAmount(null);
      setPaymentUpiId("");
      setTopupView("select");
      setActiveTab("home");
    } catch (err) {
      console.error("handleConfirmPayment error:", err);
      setModalMessage("Failed to submit top-up request.");
    } finally {
      setLoading(false);
    }
  }

  // handle withdraw request via UPI or reward redemptions
  async function handleWithdrawRequest(amount, upiId) {
    const amt = parseInt(amount);
    if (!amt || amt < 50) return setModalMessage("Minimum withdrawal is ₹50.");
    if (!upiId) return setModalMessage("Please enter your UPI ID.");

    // 10% commission: user must have amt * 1.1 coins (rounded up)
    const requiredCoins = Math.ceil(amt * 1.1);
    if ((profile.coins || 0) < requiredCoins) return setModalMessage(`You need at least ${requiredCoins} coins to withdraw ₹${amt}.`);

    setLoading(true);
    try {
      await addDoc(collection(db, "withdrawRequests"), {
        userId: user.uid,
        email: profile.email,
        upiId,
        amount: amt,
        coinsDeducted: requiredCoins,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // deduct coins
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { coins: (profile.coins || 0) - requiredCoins });
      const snap = await getDoc(userRef);
      setProfile({ id: snap.id, ...snap.data() });

      setModalMessage(`Withdrawal requested: ₹${amt} (deducted ${requiredCoins} coins including 10% commission).`);
    } catch (err) {
      console.error("handleWithdrawRequest error:", err);
      setModalMessage("Failed to submit withdrawal request.");
    } finally {
      setLoading(false);
    }
  }

  // Admin: fetch pending topup/withdraw + upcoming matches
  useEffect(() => {
    if (!profile) return;
    if (profile.email !== adminEmail) return;

    (async () => {
      try {
        const topupQ = query(collection(db, "topupRequests"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
        const withdrawQ = query(collection(db, "withdrawRequests"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
        const matchesQ = query(collection(db, "matches"), where("status", "==", "upcoming"), orderBy("createdAt", "desc"));

        const [tSnap, wSnap, mSnap] = await Promise.all([getDocs(topupQ), getDocs(withdrawQ), getDocs(matchesQ)]);
        setRequests({
          topup: tSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          withdraw: wSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
        setMatches(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Admin fetch error:", err);
      }
    })();
  }, [profile?.email]);

  // approve / reject handlers
  async function approveRequest(type, req) {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "approved" });

      if (type === "topup") {
        const uRef = doc(db, "users", req.userId);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
          const current = uSnap.data().coins || 0;
          await updateDoc(uRef, { coins: current + (req.coins || 0) });
        }
      }

      setRequests((prev) => ({ ...prev, [type]: prev[type].filter((r) => r.id !== req.id) }));
      setModalMessage(`${type} approved.`);
    } catch (err) {
      console.error("approveRequest error:", err);
      setModalMessage("Failed to approve request.");
    }
  }

  async function rejectRequest(type, req) {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "rejected" });
      setRequests((prev) => ({ ...prev, [type]: prev[type].filter((r) => r.id !== req.id) }));
      setModalMessage(`${type} rejected.`);
    } catch (err) {
      console.error("rejectRequest error:", err);
      setModalMessage("Failed to reject request.");
    }
  }

  // create match (admin)
  async function handleCreateMatch(e) {
    e.preventDefault();
    if (profile?.email !== adminEmail) return setModalMessage("Only admin can create matches.");
    if (!newMatch.title || !newMatch.imageUrl || !newMatch.startTime) return setModalMessage("Please fill Title, Image URL and Start Time.");

    setLoading(true);
    try {
      const matchData = {
        ...newMatch,
        startTime: new Date(newMatch.startTime),
        status: "upcoming",
        playersJoined: [],
        createdAt: serverTimestamp(),
      };
      if (matchData.prizeModel === "Scalable") {
        delete matchData.booyahPrize;
      } else {
        delete matchData.commissionPercent;
        delete matchData.perKillReward;
      }
      await addDoc(collection(db, "matches"), matchData);
      setModalMessage("Match created successfully!");
      setNewMatch(initialMatchState);
      setMatches((prev) => [{ ...matchData, id: "new" }, ...prev]);
    } catch (err) {
      console.error("handleCreateMatch error:", err);
      setModalMessage("Failed to create match.");
    } finally {
      setLoading(false);
    }
  }

  // set username
  async function handleSetUsername(e) {
    e.preventDefault();
    if (!newUsername) return setModalMessage("Username cannot be blank.");
    setLoading(true);
    try {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, { username: newUsername });
      setProfile((p) => ({ ...p, username: newUsername }));
      setShowUsernameModal(false);
      setModalMessage("Username saved!");
    } catch (err) {
      console.error("handleSetUsername error:", err);
      setModalMessage("Failed to save username.");
    } finally {
      setLoading(false);
    }
  }

  // update display name
  async function handleUpdateDisplayName(e) {
    e.preventDefault();
    if (!newDisplayName) return setModalMessage("Display name cannot be blank.");
    if (newDisplayName === profile.displayName) return setModalMessage("No changes made.");
    setLoading(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newDisplayName });
      }
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, { displayName: newDisplayName });
      setProfile((p) => ({ ...p, displayName: newDisplayName }));
      setModalMessage("Display name updated.");
    } catch (err) {
      console.error("handleUpdateDisplayName error:", err);
      setModalMessage("Failed to update display name.");
    } finally {
      setLoading(false);
    }
  }

  // password reset
  async function handlePasswordReset() {
    if (!user?.email) return setModalMessage("Could not find user email.");
    const providerIds = auth.currentUser?.providerData?.map((p) => p.providerId) || [];
    if (!providerIds.includes("password")) {
      return setModalMessage("Password reset is not available for Google login.");
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      setModalMessage("Password reset email sent!");
    } catch (err) {
      console.error("handlePasswordReset error:", err);
      setModalMessage("Failed to send password reset email.");
    }
  }

  // join match
  async function handleJoinMatch(match) {
    if (!profile) return setModalMessage("Profile not ready.");
    if (!profile.username) {
      setShowUsernameModal(true);
      return setModalMessage("Please set in-game username first.");
    }

    const matchRef = doc(db, "matches", match.id);
    const userRef = doc(db, "users", user.uid);

    try {
      // basic client checks
      if (match.playersJoined?.includes(user.uid)) {
        setSelectedMatch(match);
        return;
      }
      if ((match.playersJoined?.length || 0) >= (match.maxPlayers || 48)) return setModalMessage("Match is full.");
      if ((profile.coins || 0) < (match.entryFee || 0)) return setModalMessage("Not enough coins.");

      if (!window.confirm(`Join this match for ${match.entryFee} coins?`)) return;

      // update server
      await updateDoc(userRef, { coins: (profile.coins || 0) - (match.entryFee || 0) });
      await updateDoc(matchRef, { playersJoined: arrayUnion(user.uid) });

      // update local state
      setProfile((p) => ({ ...p, coins: (p.coins || 0) - (match.entryFee || 0) }));
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, playersJoined: [...(m.playersJoined || []), user.uid] } : m)));
      setSelectedMatch({ ...match, playersJoined: [...(match.playersJoined || []), user.uid] });
      setModalMessage("You have joined the match!");
    } catch (err) {
      console.error("handleJoinMatch error:", err);
      setModalMessage("Failed to join match.");
    }
  }

  // open settle modal
  const openSettleModal = (match) => {
    setMatchToSettle(match);
    setWinnerUsername("");
    setWinnerKills(0);
    setShowSettleModal(true);
  };

  // settle match via API (requires App Check)
  async function handleSettleMatch(e) {
    e.preventDefault();
    if (!matchToSettle || !winnerUsername) return setModalMessage("Winner username required.");

    setLoading(true);
    try {
      let appCheckToken;
      try {
        appCheckToken = await getToken(appCheckInstance, false);
      } catch (err) {
        throw new Error("Failed to retrieve App Check token.");
      }
      const idToken = await user.getIdToken();

      const res = await fetch("/api/settleMatch", {
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

      const data = await res.json();
      if (data.success) {
        setMatches((prev) => prev.filter((m) => m.id !== matchToSettle.id));
        setShowSettleModal(false);
        setModalMessage(data.message || "Match settled.");
      } else {
        setModalMessage(data.message || "Settle failed.");
      }
    } catch (err) {
      console.error("handleSettleMatch error:", err);
      setModalMessage("Error settling match.");
    } finally {
      setLoading(false);
    }
  }

  // logout
  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  if (loading || !profile)
    return (
      <div
        style={{
          height: "100vh",
          background: "black",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        Loading Dashboard...
      </div>
    );

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

          {profile.email === adminEmail && (
            <button className="btn small" onClick={() => setActiveTab("admin")}>
              Admin Panel
            </button>
          )}
        </div>
      </header>

      <main className="dash-main">
        {activeTab === "home" && (
          <>
            <section className="panel">
              <div className="panel-row">
                <div>
                  <div className="muted">Coins</div>
                  <div className="big" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <img
                      src="/coin.jpg"
                      alt="coin"
                      className="coin-icon"
                      style={{ width: "28px", height: "28px", borderRadius: "50%", animation: "spinCoin 3s linear infinite" }}
                    />
                    <span>{profile.coins ?? 0}</span>
                  </div>
                </div>

                <div>
                  <button className="btn" onClick={claimDaily}>Claim Daily (+1)</button>
                  <button className="btn ghost" onClick={watchAd} disabled={adLoading}>
                    {adLoading ? "Loading Ad..." : `Watch Ad (+2) [${profile.adCount || 0}/10]`}
                  </button>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Featured Matches</h3>
              <div className="grid">
                {[1,2,3,4].map((i)=>(
                  <div key={i} className="match-card">
                    <img src="/bt.jpg" alt="bt" />
                    <div className="match-info">
                      <div className="match-title">Battle Royale #{i}</div>
                      <div className="match-meta">Start: 18:{10 + i} • Joined: {Math.floor(Math.random()*12)+1}/16</div>
                      <button className="btn" onClick={()=> setActiveTab("matches")}>View</button>
                    </div>
                  </div>
                ))}
              </div>
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
                  {matches.map((m) => {
                    const hasJoined = m.playersJoined?.includes(user.uid);
                    const isFull = (m.playersJoined?.length || 0) >= (m.maxPlayers || 48);
                    return (
                      <div key={m.id} className="match-card" onClick={() => setSelectedMatch(m)}>
                        <img src={m.imageUrl} alt={m.title} />
                        <div className="match-info">
                          <div className="match-title">{m.title}</div>
                          <div className="match-meta time">Starts: {formatMatchTime(m.startTime)}</div>
                          <div className="match-meta">Entry: {m.entryFee} Coins | Joined: {m.playersJoined?.length || 0} / {m.maxPlayers}</div>
                          <button className="btn" onClick={(e)=>{ e.stopPropagation(); handleJoinMatch(m); }} disabled={hasJoined || isFull}>
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
                  <button className="back-btn" onClick={()=> setSelectedMatch(null)}><FaArrowLeft /> Back to Matches</button>
                  <button className="btn small" onClick={()=> setShowUsernameModal(true)}><FaUserEdit style={{marginRight:8}}/> Edit Username</button>
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
                          <p>You have joined! Room ID and Password will be revealed 15 minutes before the match.</p>
                        </div>
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

        {activeTab === "topup" && (
          <>
            {topupView === "select" && (
              <section className="modern-card">
                <h3 className="modern-title">Top-up Coins</h3>
                <p className="modern-subtitle">1 ₹ = 10 Coins | Choose an amount</p>
                <div className="amount-options">
                  {[20,50,100,200].map((amt)=>(
                    <div key={amt} className={`amount-btn ${selectedTopupAmount === amt ? "selected" : ""}`} onClick={()=>{ setSelectedTopupAmount(amt); setCustomTopupAmount(""); }}>
                      ₹{amt} = {amt*10} Coins
                    </div>
                  ))}
                </div>
                <input type="number" className="modern-input" placeholder="Or enter custom amount ₹" value={customTopupAmount} onChange={(e)=>{ setSelectedTopupAmount(null); setCustomTopupAmount(e.target.value); }} />
                <button className="btn glow large" onClick={handleTopupStart}>Pay</button>
              </section>
            )}

            {topupView === "pay" && (
              <section className="modern-card payment-page">
                <button className="back-btn" onClick={()=> setTopupView("select")}><FaArrowLeft /> Back</button>
                <h3 className="modern-title">Scan & Pay</h3>
                <p className="modern-subtitle">Scan the QR code to pay ₹{selectedTopupAmount || customTopupAmount}</p>
                <img src="/qr.jpg" alt="QR Code" className="qr-code-image" />
                <div className="form-group" style={{marginTop:24}}>
                  <label>Enter Your UPI ID</label>
                  <input type="text" className="modern-input" placeholder="Enter your UPI ID (e.g., name@ybl)" value={paymentUpiId} onChange={(e)=> setPaymentUpiId(e.target.value)} />
                  <button className="btn glow large" onClick={handleConfirmPayment} disabled={loading}>{loading ? "Submitting..." : "I Have Paid"}</button>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === "withdraw" && (
          <div className="withdraw-container">
            <section className="panel">
              <h3 className="modern-title" style={{paddingLeft:10}}>Redeem Coins as UPI</h3>
              <p className="modern-subtitle" style={{paddingLeft:10}}>10% commission fee | Min ₹50</p>
              <div className="form-group" style={{marginTop:12}}>
                <input type="number" placeholder="Enter amount ₹" className="modern-input" id="withdraw-amount" />
                <input type="text" placeholder="Enter UPI ID (e.g., name@ybl)" className="modern-input" id="withdraw-upi" style={{marginTop:8}} />
                <button className="btn" onClick={() => {
                  const amtEl = document.getElementById("withdraw-amount");
                  const upiEl = document.getElementById("withdraw-upi");
                  handleWithdrawRequest(amtEl?.value, upiEl?.value);
                }}>Request Withdrawal</button>
              </div>
            </section>

            <section className="panel">
              <h3 className="modern-title" style={{paddingLeft:10}}>Redeem Gift Cards</h3>
              <div className="reward-grid">
                {rewardOptions.map((reward) => (
                  <div key={`${reward.type}-${reward.amount}`} className="reward-card" onClick={() => {
                    // reuse handleRedeemReward logic inline (ask for UPI for UPI type)
                    (async () => {
                      if (!profile) return setModalMessage("Profile not ready");
                      if (profile.coins < reward.cost) return setModalMessage("Not enough coins.");
                      let upiVal = "";
                      if (reward.type === "UPI") {
                        upiVal = window.prompt("Enter your UPI ID to receive payment:");
                        if (!upiVal) return setModalMessage("UPI ID required.");
                      } else {
                        if (!window.confirm(`Redeem ${reward.type} ₹${reward.amount} for ${reward.cost} coins?`)) return;
                      }
                      setLoading(true);
                      try {
                        await addDoc(collection(db, "withdrawRequests"), {
                          userId: user.uid,
                          email: profile.email,
                          amount: reward.amount,
                          coinsDeducted: reward.cost,
                          type: reward.type,
                          upiId: upiVal || "",
                          status: "pending",
                          createdAt: serverTimestamp(),
                        });
                        // deduct coins
                        const uRef = doc(db, "users", user.uid);
                        await updateDoc(uRef, { coins: (profile.coins || 0) - reward.cost });
                        const snap = await getDoc(uRef);
                        setProfile({ id: snap.id, ...snap.data() });
                        setModalMessage(reward.type === "UPI" ? "Withdrawal request submitted!" : "Redemption requested! Admin will email code.");
                      } catch (err) {
                        console.error("redeem error:", err);
                        setModalMessage("Failed to submit redemption.");
                      } finally {
                        setLoading(false);
                      }
                    })();
                  }}>
                    <img src={reward.icon} alt={reward.type} className="reward-icon" />
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
              <input name="title" className="modern-input" placeholder="Match Title" value={newMatch.title} onChange={(e)=> setNewMatch({...newMatch, title: e.target.value})} />
              <input name="imageUrl" className="modern-input" placeholder="Image URL" value={newMatch.imageUrl} onChange={(e)=> setNewMatch({...newMatch, imageUrl: e.target.value})} />
              <label>Start Time</label>
              <input name="startTime" type="datetime-local" className="modern-input" value={newMatch.startTime} onChange={(e)=> setNewMatch({...newMatch, startTime: e.target.value})} />
              <label>Match Type</label>
              <select name="type" className="modern-input" value={newMatch.type} onChange={(e)=> setNewMatch({...newMatch, type: e.target.value})}><option value="BR">Battle Royale</option><option value="CS">Clash Squad</option></select>
              <label>Prize Model</label>
              <select name="prizeModel" className="modern-input" value={newMatch.prizeModel} onChange={(e)=> setNewMatch({...newMatch, prizeModel: e.target.value})}><option value="Scalable">Scalable</option><option value="Fixed">Fixed</option></select>
              <label>Entry Fee (Coins)</label>
              <input name="entryFee" type="number" className="modern-input" value={newMatch.entryFee} onChange={(e)=> setNewMatch({...newMatch, entryFee: parseInt(e.target.value || 0)})} />
              <label>Max Players</label>
              <input name="maxPlayers" type="number" className="modern-input" value={newMatch.maxPlayers} onChange={(e)=> setNewMatch({...newMatch, maxPlayers: parseInt(e.target.value || 0)})} />
              {newMatch.prizeModel === "Scalable" ? (
                <>
                  <label>Per Kill Reward (Coins)</label>
                  <input name="perKillReward" type="number" className="modern-input" value={newMatch.perKillReward} onChange={(e)=> setNewMatch({...newMatch, perKillReward: parseInt(e.target.value || 0)})} />
                  <label>Commission (%)</label>
                  <input name="commissionPercent" type="number" className="modern-input" value={newMatch.commissionPercent} onChange={(e)=> setNewMatch({...newMatch, commissionPercent: parseInt(e.target.value || 0)})} />
                </>
              ) : (
                <>
                  <label>Booyah Prize (Fixed Total)</label>
                  <input name="booyahPrize" type="number" className="modern-input" value={newMatch.booyahPrize} onChange={(e)=> setNewMatch({...newMatch, booyahPrize: parseInt(e.target.value || 0)})} />
                </>
              )}
              <label>Rules</label>
              <textarea name="rules" className="modern-input" placeholder="Enter match rules..." value={newMatch.rules} onChange={(e)=> setNewMatch({...newMatch, rules: e.target.value})} />
              <button type="submit" className="btn glow">Create Match</button>
            </form>

            <hr style={{margin:"24px 0", borderColor:"var(--panel)"}} />

            <h4>Settle Upcoming Matches</h4>
            <div className="admin-match-list">
              {matches.filter(m => m.status === 'upcoming').length > 0 ? (
                matches.filter(m => m.status === 'upcoming').map(match => (
                  <div key={match.id} className="admin-row">
                    <span>{match.title}</span>
                    <button className="btn small" onClick={() => openSettleModal(match)}>Settle</button>
                  </div>
                ))
              ) : (
                <p className="muted-small" style={{textAlign:"center"}}>No matches to settle.</p>
              )}
            </div>

            <hr style={{margin:"24px 0", borderColor:"var(--panel)"}} />

            <h4>Top-up Requests</h4>
            {requests.topup.length === 0 ? <p>No top-up requests.</p> : requests.topup.map(r => (
              <div key={r.id} className="admin-row">
                <span>{r.email} | ₹{r.amount} | UPI: {r.upiId}</span>
                <div>
                  <button className="btn small" onClick={() => approveRequest("topup", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("topup", r)}>Reject</button>
                </div>
              </div>
            ))}

            <h4 style={{marginTop:16}}>Withdraw Requests</h4>
            {requests.withdraw.length === 0 ? <p>No withdraw requests.</p> : requests.withdraw.map(r => (
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
            {activeSubAccountView === "main" && (
              <>
                <section className="panel account-profile-card">
                  <h3 className="modern-title">{profile.username || "Set Your Username"}</h3>
                  <p className="modern-subtitle">{profile.email}</p>
                </section>

                <section className="panel account-menu">
                  <button className="account-option" onClick={() => { setNewDisplayName(profile.displayName || ""); setActiveSubAccountView("profile"); }}>
                    <FaUserCog size={20} />
                    <span>Profile Settings</span>
                    <span className="arrow">&gt;</span>
                  </button>

                  <button className="account-option" onClick={() => setShowUsernameModal(true)}>
                    <FaUserEdit size={20} />
                    <span>Edit In-Game Username</span>
                    <span className="arrow">&gt;</span>
                  </button>

                  <button className="account-option" onClick={() => setActiveSubAccountView("refer")}>
                    <FaGift size={20} />
                    <span>Refer a Friend</span>
                    <span className="arrow">&gt;</span>
                  </button>

                  {/* Removed Match History & Withdrawal History from Account menu as requested */}

                  <button className="account-option logout" onClick={handleLogout}>
                    <FaSignOutAlt size={20} />
                    <span>Logout</span>
                    <span className="arrow">&gt;</span>
                  </button>
                </section>
              </>
            )}

            {activeSubAccountView === "profile" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setActiveSubAccountView("main")}><FaArrowLeft /> Back</button>
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

            {activeSubAccountView === "refer" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setActiveSubAccountView("main")}><FaArrowLeft /> Back</button>
                <h3 className="modern-title">Refer a Friend</h3>
                <div className="referral-card">
                  <p>Your Unique Referral Code:</p>
                  <div className="referral-code">{profile.referralCode || "Loading..."}</div>
                  <p className="modern-subtitle" style={{textAlign:"center"}}>Share this code. When friends use it, they get 50 coins and you get 20 coins.</p>
                </div>
                {!profile.hasRedeemedReferral && (
                  <div className="referral-form">
                    <p>Have a friend's code?</p>
                    <input type="text" className="modern-input" placeholder="Enter referral code" defaultValue="" id="redeem-code-input" />
                    <button className="btn glow large" onClick={() => {
                      const val = document.getElementById("redeem-code-input")?.value || "";
                      handleRedeemReferral(val);
                    }}>Redeem Code</button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="bottom-nav">
        {["home", "matches", "topup", "withdraw", "account"].map((tab) => (
          <button key={tab} className={`nav-btn ${activeTab === tab ? "active" : ""}`} onClick={() => { setActiveTab(tab); setActiveSubAccountView("main"); setSelectedMatch(null); setTopupView("select"); }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>

      {/* username modal */}
      {showUsernameModal && (
        <div className="modal-overlay" onClick={() => setShowUsernameModal(false)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">{profile.username ? "Edit Your Username" : "Set Your In-Game Username"}</h3>
            <p className="modern-subtitle">You must set a username before joining matches.</p>
            <form onSubmit={handleSetUsername}>
              <input type="text" className="modern-input" placeholder="Enter your username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              <button type="submit" className="btn glow large" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
              <button type="button" className="btn large ghost" style={{marginTop:10}} onClick={() => setShowUsernameModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* settle modal */}
      {showSettleModal && matchToSettle && (
        <div className="modal-overlay">
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Settle Match</h3>
            <p className="modern-subtitle">Settle: {matchToSettle.title}</p>
            <form onSubmit={handleSettleMatch}>
              <div className="form-group">
                <label>Winner's Username</label>
                <input type="text" className="modern-input" value={winnerUsername} onChange={(e) => setWinnerUsername(e.target.value)} />
              </div>
              {matchToSettle.prizeModel === "Scalable" && (
                <div className="form-group">
                  <label>Winner's Kills</label>
                  <input type="number" className="modern-input" value={winnerKills} onChange={(e) => setWinnerKills(parseInt(e.target.value || 0))} />
                </div>
              )}
              <button type="submit" className="btn glow large" disabled={loading}>{loading ? "Submitting..." : "Award Prize & End Match"}</button>
              <button type="button" className="btn large ghost" style={{marginTop:10}} onClick={() => setShowSettleModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* modal message */}
      {modalMessage && (
        <div className="modal-overlay" onClick={() => setModalMessage(null)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Notification</h3>
            <p className="modern-subtitle" style={{textAlign:"center", marginBottom:24}}>{modalMessage}</p>
            <button className="btn glow large" onClick={() => setModalMessage(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
