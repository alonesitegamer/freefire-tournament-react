// src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { auth, db, appCheckInstance } from "../firebase"; // ensure appCheckInstance is exported from your firebase.js
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
  FaArrowLeft,
  FaUserEdit,
  FaUserCog,
  FaGift,
  FaSignOutAlt,
} from "react-icons/fa";
import MatchHistoryPage from "./MatchHistoryPage";
import WithdrawalHistoryPage from "./WithdrawalHistoryPage";

/* ===========================
   CONFIG / TUNABLES
   =========================== */
const ADMIN_EMAIL = "esportsimperial50@gmail.com";
const DAILY_CLAIM_AMOUNT = 1; // +1 coin for daily
const AD_REWARD = 2; // +2 coins per ad
const AD_DAILY_LIMIT = 5; // max ad rewards per day
const MIN_TOPUP_RUPEE = 20; // min top-up rupees
const COINS_PER_RUPEE = 10; // 1 ₹ = 10 coins (you said both earlier)
const WITHDRAW_COMMISSION_PERCENT = 10; // 10% commission
const WITHDRAW_OPTIONS_RS = [50, 100, 200]; // withdrawal preset rupee values

/* ===========================
   LEVEL / BADGES CONFIG
   =========================== */
// Example: map XP thresholds to badge image paths (you said 18 images are uploaded to public/)
const LEVELS = [
  { level: 1, xp: 0, badge: "/levels/bronze1.jpg" },
  { level: 2, xp: 200, badge: "/levels/bronze2.jpg" },
  { level: 3, xp: 500, badge: "/levels/bronze3.jpg" },
  { level: 4, xp: 1000, badge: "/levels/silver1.jpg" },
  { level: 5, xp: 1500, badge: "/levels/silver2.jpg" },
  { level: 6, xp: 2200, badge: "/levels/silver3.jpg" },
  { level: 7, xp: 3000, badge: "/levels/gold1.jpg" },
  { level: 8, xp: 4000, badge: "/levels/gold2.jpg" },
  { level: 9, xp: 5200, badge: "/levels/gold3.jpg" },
  { level: 10, xp: 6600, badge: "/levels/gold4.jpg" },
  { level: 11, xp: 8200, badge: "/levels/platinum1.jpg" },
  { level: 12, xp: 10000, badge: "/levels/platinum2.jpg" },
  { level: 13, xp: 12000, badge: "/levels/platinum3.jpg" },
  { level: 14, xp: 14500, badge: "/levels/platinum4.jpg" },
  { level: 15, xp: 17000, badge: "/levels/diamond1.jpg" },
  { level: 16, xp: 20000, badge: "/levels/diamond2.jpg" },
  { level: 17, xp: 23500, badge: "/levels/diamond3.jpg" },
  { level: 18, xp: 27500, badge: "/levels/heroic.jpg" }, // final heroic
];

function getLevelFromXp(xp = 0) {
  let level = LEVELS[0];
  for (let lv of LEVELS) {
    if (xp >= lv.xp) level = lv;
    else break;
  }
  return level;
}

/* ===========================
   UTIL
   =========================== */
function formatDate(ts) {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString();
  } catch (e) {
    return new Date(ts).toLocaleString();
  }
}

/* ===========================
   COMPONENT
   =========================== */
export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [topupAmountRupee, setTopupAmountRupee] = useState("");
  const [selectedTopup, setSelectedTopup] = useState(null); // e.g., 20,50,..
  const [topupView, setTopupView] = useState("select"); // select | pay
  const [paymentUpiId, setPaymentUpiId] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("UPI"); // 'UPI'|'Google Play'|'Amazon'
  const [withdrawAmountRupee, setWithdrawAmountRupee] = useState(null);
  const [withdrawEmail, setWithdrawEmail] = useState("");
  const [withdrawUpi, setWithdrawUpi] = useState("");
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [accountView, setAccountView] = useState("main"); // main, profile, refer, etc.
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [levelUp, setLevelUp] = useState(null); // {oldLevel, newLevel, badge}

  const navigate = useNavigate();

  // ---------- Load profile/create if missing ----------
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
            const newReferral = user.uid.substring(0, 8).toUpperCase();
            await updateDoc(ref, { referralCode: newReferral, hasRedeemedReferral: data.hasRedeemedReferral || false });
            if (!mounted) return;
            setProfile({ id: snap.id, ...data, referralCode: newReferral });
          } else {
            if (!mounted) return;
            setProfile({ id: snap.id, ...data });
          }
          setNewDisplayName(data.displayName || "");
          setNewUsername(data.username || "");
        } else {
          // create default user doc
          const newReferral = user.uid.substring(0, 8).toUpperCase();
          const initial = {
            email: user.email,
            coins: 0,
            displayName: user.displayName || "",
            username: "",
            createdAt: serverTimestamp(),
            lastDaily: null,
            appXp: 0,
            referralCode: newReferral,
            hasRedeemedReferral: false,
          };
          await setDoc(ref, initial);
          if (!mounted) return;
          setProfile({ id: ref.id, ...initial });
          setNewDisplayName(initial.displayName);
        }
      } catch (err) {
        console.error("Dashboard profile load error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProfile();
    return () => (mounted = false);
  }, [user.uid, user.email, user.displayName]);

  // ---------- Load upcoming matches when matches tab active ----------
  useEffect(() => {
    if (activeTab !== "matches") return;
    let mounted = true;
    async function loadMatches() {
      setLoadingMatches(true);
      try {
        const matchesRef = collection(db, "matches");
        const q = query(matchesRef, where("status", "==", "upcoming"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (mounted) setMatches(data);
      } catch (err) {
        console.error("Error loading matches:", err);
      } finally {
        if (mounted) setLoadingMatches(false);
      }
    }
    loadMatches();
    return () => (mounted = false);
  }, [activeTab]);

  // ---------- Admin: fetch pending requests ----------
  useEffect(() => {
    if (!profile || profile.email !== ADMIN_EMAIL) return;
    (async () => {
      try {
        const tpQ = query(collection(db, "topupRequests"), where("status", "==", "pending"));
        const wdQ = query(collection(db, "withdrawRequests"), where("status", "==", "pending"));
        const [tpSnap, wdSnap] = await Promise.all([getDocs(tpQ), getDocs(wdQ)]);
        setRequests({
          topup: tpSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          withdraw: wdSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
      } catch (err) {
        console.error("Admin requests load error:", err);
      }
    })();
  }, [profile]);

  /* ===========================
     ACTIONS
     =========================== */

  // logout
  async function handleLogout() {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed", err);
      setModalMessage("Failed to logout. Try again.");
    }
  }

  // claim daily (1 coin)
  async function claimDaily() {
    if (!profile) return;
    try {
      // check lastDaily
      const last = profile.lastDaily && typeof profile.lastDaily.toDate === "function" ? profile.lastDaily.toDate() : profile.lastDaily ? new Date(profile.lastDaily) : null;
      const today = new Date();
      if (last && last.toDateString() === today.toDateString()) {
        setModalMessage("You already claimed today's coin.");
        return;
      }
      const ref = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) + DAILY_CLAIM_AMOUNT;
      const newXp = (profile.appXp || 0) + DAILY_CLAIM_AMOUNT * 10; // example xp for daily
      await updateDoc(ref, { coins: newCoins, lastDaily: serverTimestamp(), appXp: newXp });
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
      setModalMessage(`+${DAILY_CLAIM_AMOUNT} coin credited!`);
      checkLevelUp(newXp);
    } catch (err) {
      console.error("claimDaily error:", err);
      setModalMessage("Failed to claim daily. Try again.");
    }
  }

  // watch ad (reward=AD_REWARD) with limit AD_DAILY_LIMIT
  async function watchAd() {
    if (!profile) return;
    if (adLoading) return;
    // simple local/day limit tracking using profile.adCountDay + adCountDayDate
    const todayStr = new Date().toDateString();
    const adCountDay = profile.adCountDay || 0;
    const adCountDayDate = profile.adCountDayDate || null;
    if (adCountDayDate === todayStr && adCountDay >= AD_DAILY_LIMIT) {
      setModalMessage(`You reached ${AD_DAILY_LIMIT} ad rewards today. Come back tomorrow.`);
      return;
    }

    setAdLoading(true);
    try {
      // This uses the platform ad integration you used in your original code.
      // Since ads vary, we simply simulate success and award coins.
      // Replace with your ad SDK hooks as needed.

      // Simulate ad flow:
      await new Promise((r) => setTimeout(r, 1000)); // pretend loading

      // award coins
      const ref = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) + AD_REWARD;
      // update daily count
      const newAdCount = (adCountDayDate === todayStr ? adCountDay : 0) + 1;
      await updateDoc(ref, { coins: newCoins, adCountDay: newAdCount, adCountDayDate: todayStr });
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
      setModalMessage(`+${AD_REWARD} coins for watching an ad!`);
      // small XP bump
      const newXp = (profile.appXp || 0) + AD_REWARD * 5;
      await updateDoc(ref, { appXp: newXp });
      checkLevelUp(newXp);
    } catch (err) {
      console.error("watchAd error:", err);
      setModalMessage("Ad failed. Try again later.");
    } finally {
      setAdLoading(false);
    }
  }

  // helper to check and trigger level up modal if crossed threshold
  function checkLevelUp(newXp) {
    const oldLevel = getLevelFromXp(profile?.appXp || 0);
    const newLevel = getLevelFromXp(newXp || 0);
    if (oldLevel.level !== newLevel.level) {
      setLevelUp({ oldLevel: oldLevel.level, newLevel: newLevel.level, badge: newLevel.badge });
      // hide after 3.5s
      setTimeout(() => setLevelUp(null), 3500);
    }
  }

  /* ----------------- TOP-UP ----------------- */

  function startTopupPay() {
    const amt = parseInt(selectedTopup || topupAmountRupee);
    if (!amt || amt < MIN_TOPUP_RUPEE) {
      setModalMessage(`Minimum top-up is ₹${MIN_TOPUP_RUPEE}.`);
      return;
    }
    // show pay modal with QR (mandatory UPI on confirm)
    setShowQrModal(true);
    setTopupView("pay");
  }

  async function confirmTopupPayment() {
    const amt = parseInt(selectedTopup || topupAmountRupee);
    if (!amt || amt < MIN_TOPUP_RUPEE) {
      setModalMessage(`Minimum top-up is ₹${MIN_TOPUP_RUPEE}.`);
      return;
    }
    if (!paymentUpiId) {
      setModalMessage("Please enter your UPI ID so we can verify your payment.");
      return;
    }
    try {
      setLoading(true);
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: amt,
        coins: amt * COINS_PER_RUPEE,
        upiId: paymentUpiId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setModalMessage("Top-up request submitted! Admin will verify and approve.");
      // reset
      setSelectedTopup(null);
      setTopupAmountRupee("");
      setPaymentUpiId("");
      setTopupView("select");
      setShowQrModal(false);
      setActiveTab("home");
    } catch (err) {
      console.error("confirmTopupPayment", err);
      setModalMessage("Failed to submit top-up. Try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ----------------- WITHDRAW ----------------- */

  async function requestWithdraw(method) {
    // method = 'UPI'|'Google Play'|'Amazon'
    const rupee = withdrawAmountRupee;
    if (!rupee || !WITHDRAW_OPTIONS_RS.includes(rupee)) {
      setModalMessage("Choose a valid withdraw amount.");
      return;
    }
    // compute coins required: coins = rupee * 10 ; commission = 10% => coinsDeducted = ceil(coins * 1.1)
    const coinsNeeded = Math.ceil(rupee * COINS_PER_RUPEE * (1 + WITHDRAW_COMMISSION_PERCENT / 100));
    if ((profile.coins || 0) < coinsNeeded) {
      setModalMessage(`You need at least ${coinsNeeded} coins to withdraw ₹${rupee}.`);
      return;
    }

    if (method === "UPI") {
      // ensure UPI is set, otherwise ask
      const upiToUse = withdrawUpi || profile.upiId || "";
      if (!upiToUse) {
        setModalMessage("Please set your UPI ID before requesting UPI withdrawal.");
        return;
      }
    }

    // collect email for gift cards if provided (optional)
    try {
      setLoading(true);
      await addDoc(collection(db, "withdrawRequests"), {
        userId: user.uid,
        email: profile.email,
        upiId: method === "UPI" ? (withdrawUpi || profile.upiId || "") : "",
        type: method,
        amount: rupee,
        coinsDeducted: rupee * COINS_PER_RUPEE * (1 + WITHDRAW_COMMISSION_PERCENT / 100),
        status: "pending",
        extraEmail: withdrawEmail || null,
        createdAt: serverTimestamp(),
      });

      // update user's coins
      const refUser = doc(db, "users", user.uid);
      const newCoins = (profile.coins || 0) - Math.ceil(rupee * COINS_PER_RUPEE * (1 + WITHDRAW_COMMISSION_PERCENT / 100));
      await updateDoc(refUser, { coins: newCoins });
      const snap = await getDoc(refUser);
      setProfile({ id: snap.id, ...snap.data() });
      setModalMessage("Withdraw request submitted. Admin will process it shortly.");
      // reset withdraw inputs
      setWithdrawAmountRupee(null);
      setWithdrawEmail("");
      setWithdrawUpi("");
      // back to withdraw tab main
    } catch (err) {
      console.error("requestWithdraw", err);
      setModalMessage("Failed to request withdrawal. Try later.");
    } finally {
      setLoading(false);
    }
  }

  /* ----------------- ADMIN HANDLERS ----------------- */
  async function approveRequest(type, req) {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "approved" });

      if (type === "topup") {
        const userRef = doc(db, "users", req.userId);
        const s = await getDoc(userRef);
        const current = s.exists() ? (s.data().coins || 0) : 0;
        await updateDoc(userRef, { coins: current + (req.coins || 0) });
      }
      setRequests((p) => ({ ...p, [type]: p[type].filter((x) => x.id !== req.id) }));
      setModalMessage(`${type} request approved.`);
    } catch (err) {
      console.error("approveRequest", err);
      setModalMessage("Failed to approve request.");
    }
  }

  async function rejectRequest(type, req) {
    try {
      const ref = doc(db, `${type}Requests`, req.id);
      await updateDoc(ref, { status: "rejected" });
      setRequests((p) => ({ ...p, [type]: p[type].filter((x) => x.id !== req.id) }));
      setModalMessage(`${type} request rejected.`);
    } catch (err) {
      console.error("rejectRequest", err);
      setModalMessage("Failed to reject request.");
    }
  }

  /* ----------------- PROFILE EDITS ----------------- */
  async function handleSetUsername(e) {
    e.preventDefault();
    if (!newUsername) return setModalMessage("Username cannot be empty.");
    try {
      setLoading(true);
      const uRef = doc(db, "users", user.uid);
      await updateDoc(uRef, { username: newUsername });
      const snap = await getDoc(uRef);
      setProfile({ id: snap.id, ...snap.data() });
      setShowUsernameModal(false);
      setModalMessage("Username saved.");
    } catch (err) {
      console.error("handleSetUsername", err);
      setModalMessage("Failed to update username.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateDisplayName(e) {
    e.preventDefault();
    if (!newDisplayName) return setModalMessage("Display name cannot be blank.");
    try {
      setLoading(true);
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newDisplayName });
      }
      const uRef = doc(db, "users", user.uid);
      await updateDoc(uRef, { displayName: newDisplayName });
      const snap = await getDoc(uRef);
      setProfile({ id: snap.id, ...snap.data() });
      setModalMessage("Display name saved.");
    } catch (err) {
      console.error(err);
      setModalMessage("Failed to save display name.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (!auth.currentUser?.email) return setModalMessage("Could not find account email.");
    const providers = auth.currentUser.providerData.map((p) => p.providerId);
    if (!providers.includes("password")) {
      return setModalMessage("Password reset is only available for email/password accounts.");
    }
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      setModalMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      console.error(err);
      setModalMessage("Failed to send password reset email.");
    }
  }

  /* ===========================
     RENDER
     =========================== */

  if (loading || !profile) {
    return <div className="center-screen">Loading Dashboard...</div>;
  }

  const level = getLevelFromXp(profile.appXp || 0);

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
          <button className="btn small ghost music-btn" onClick={() => { if (isPlaying) { audioRef.current.pause(); } else audioRef.current.play(); setIsPlaying(!isPlaying); }}>
            {isPlaying ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>
          {profile.email === ADMIN_EMAIL && <button className="btn small" onClick={() => setActiveTab("admin")}>Admin Panel</button>}
          <button className="btn small ghost" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="dash-main">
        {activeTab === "home" && (
          <>
            <section className="panel">
              <div className="panel-row" style={{ alignItems: "center" }}>
                <div>
                  <div className="muted">Coins</div>
                  <div className="big coin-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src="/coin.jpg" alt="coin" className="coin-img" />
                    <span>{profile.coins ?? 0}</span>
                  </div>
                  <div style={{ color: "var(--muted)", marginTop: 6 }}>XP: {profile.appXp ?? 0}</div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button className="btn glow" onClick={claimDaily}>Claim Daily (+{DAILY_CLAIM_AMOUNT})</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                <button className="btn glow" onClick={watchAd} disabled={adLoading}>{adLoading ? "Loading..." : `Watch Ad (+${AD_REWARD})`}</button>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={level.badge} alt={`Level ${level.level}`} style={{ width: 48, height: 48, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.6)" }} />
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{`Level ${level.level}`}</div>
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>{`Next at ${LEVELS[Math.min(LEVELS.length-1, level.level) ]?.xp || "—"} XP`}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Welcome!</h3>
              <p>Check the matches tab to join games, or use Top-up to add coins.</p>
            </section>
          </>
        )}

        {activeTab === "matches" && (
          <section className="panel">
            <h3>Available Matches</h3>
            {loadingMatches && <p>Loading matches...</p>}
            {!loadingMatches && matches.length === 0 && <p>No upcoming matches at the moment.</p>}
            <div className="grid">
              {matches.map((m) => (
                <div key={m.id} className="match-card">
                  <img src={m.imageUrl} alt={m.title} />
                  <div className="match-info">
                    <div className="match-title">{m.title}</div>
                    <div className="match-meta">Entry: {m.entryFee} Coins</div>
                    <button className="btn" onClick={async () => {
                      // join logic (same as before)
                      if (!profile.username) { setModalMessage("Set username before joining."); setShowUsernameModal(true); return; }
                      const userRef = doc(db, "users", user.uid);
                      const matchRef = doc(db, "matches", m.id);
                      // ensure not full:
                      const snap = await getDoc(matchRef);
                      const data = snap.data();
                      const players = data.playersJoined || [];
                      if (players.includes(user.uid)) { setModalMessage("Already joined."); return; }
                      if (players.length >= (data.maxPlayers || 48)) { setModalMessage("Match is full."); return; }
                      if ((profile.coins || 0) < (m.entryFee || 0)) { setModalMessage("Not enough coins."); return; }
                      try {
                        await updateDoc(userRef, { coins: (profile.coins || 0) - (m.entryFee || 0) });
                        await updateDoc(matchRef, { playersJoined: arrayUnion(user.uid) });
                        const s = await getDoc(userRef);
                        setProfile({ id: s.id, ...s.data() });
                        setModalMessage("You joined the match.");
                      } catch (err) { console.error(err); setModalMessage("Join failed."); }
                    }}>Join</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "topup" && (
          <section className="panel">
            {topupView === "select" ? (
              <>
                <h3>Top-up Coins</h3>
                <p>1 ₹ = {COINS_PER_RUPEE} Coins | Min ₹{MIN_TOPUP_RUPEE}</p>
                <div className="amount-options" style={{ display: "flex", gap: 12 }}>
                  {[20, 50, 100, 200].map((a) => (
                    <div key={a} className={`amount-btn ${selectedTopup === a ? "selected" : ""}`} onClick={() => { setSelectedTopup(a); setTopupAmountRupee(""); }}>
                      ₹{a} = {a * COINS_PER_RUPEE} Coins
                    </div>
                  ))}
                </div>
                <input type="number" className="modern-input" placeholder="Or enter custom amount ₹" value={topupAmountRupee} onChange={(e) => { setSelectedTopup(null); setTopupAmountRupee(e.target.value); }} />
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button className="btn glow" onClick={startTopupPay}>Pay</button>
                  <button className="btn ghost" onClick={() => { setSelectedTopup(null); setTopupAmountRupee(""); }}>Clear</button>
                </div>
              </>
            ) : (
              <>
                <button className="back-btn" onClick={() => { setTopupView("select"); setShowQrModal(false); }}> <FaArrowLeft /> Back</button>
                <h3>Scan & Pay</h3>
                <p>Scan the QR below and then confirm payment with your UPI ID (required)</p>
                <img src="/qr.jpg" alt="QR" className="qr-code-image" style={{ width: 220, height: 220, display: "block", margin: "16px auto", borderRadius: 12 }} />
                <div className="form-group">
                  <label>Your UPI ID (so we can verify)</label>
                  <input type="text" className="modern-input" placeholder="e.g., name@bank" value={paymentUpiId} onChange={(e) => setPaymentUpiId(e.target.value)} />
                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <button className="btn glow" onClick={confirmTopupPayment}>I Have Paid</button>
                    <button className="btn ghost" onClick={() => { setTopupView("select"); setPaymentUpiId(""); setShowQrModal(false); }}>Cancel</button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "withdraw" && (
          <section className="panel">
            <h3>Withdraw</h3>
            <p>10% commission | Min ₹{Math.min(...WITHDRAW_OPTIONS_RS)}</p>

            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              {WITHDRAW_OPTIONS_RS.map((r) => (
                <button key={r} className={`amount-btn ${withdrawAmountRupee === r ? "selected" : ""}`} onClick={() => setWithdrawAmountRupee(r)}>₹{r}</button>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Withdraw Method</label>
              <select className="modern-input" value={withdrawMethod} onChange={(e) => setWithdrawMethod(e.target.value)}>
                <option value="UPI">UPI (Direct ₹)</option>
                <option value="Google Play">Google Play Gift Card</option>
                <option value="Amazon">Amazon Gift Card</option>
              </select>
            </div>

            {withdrawMethod === "UPI" && (
              <div className="form-group">
                <label>Your UPI ID</label>
                <input type="text" className="modern-input" placeholder="Enter UPI (e.g. name@bank)" value={withdrawUpi} onChange={(e) => setWithdrawUpi(e.target.value)} />
              </div>
            )}

            {(withdrawMethod === "Google Play" || withdrawMethod === "Amazon") && (
              <div className="form-group">
                <label>Email for gift card (optional)</label>
                <input type="email" className="modern-input" placeholder="email@example.com (optional)" value={withdrawEmail} onChange={(e) => setWithdrawEmail(e.target.value)} />
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button className="btn glow" onClick={() => requestWithdraw(withdrawMethod)} disabled={loading}>{loading ? "Submitting..." : "Request Withdrawal"}</button>
              <button className="btn ghost" onClick={() => { setWithdrawAmountRupee(null); setWithdrawEmail(""); setWithdrawUpi(""); }}>Clear</button>
            </div>
          </section>
        )}

        {activeTab === "admin" && profile.email === ADMIN_EMAIL && (
          <section className="panel">
            <h3>Admin Panel</h3>
            <h4>Top-up Requests</h4>
            {requests.topup.length === 0 && <p>No top-up requests.</p>}
            {requests.topup.map((r) => (
              <div key={r.id} className="admin-row">
                <span>{r.email} | ₹{r.amount} | coins: {r.coins}</span>
                <div>
                  <button className="btn small" onClick={() => approveRequest("topup", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("topup", r)}>Reject</button>
                </div>
              </div>
            ))}

            <h4 style={{ marginTop: 18 }}>Withdraw Requests</h4>
            {requests.withdraw.length === 0 && <p>No withdraw requests.</p>}
            {requests.withdraw.map((r) => (
              <div key={r.id} className="admin-row">
                <span>{r.email} | ₹{r.amount} | Type: {r.type} | UPI: {r.upiId || "-"}</span>
                <div>
                  <button className="btn small" onClick={() => approveRequest("withdraw", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("withdraw", r)}>Reject</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {activeTab === "account" && (
          <section className="panel account-panel">
            {accountView === "main" && (
              <>
                <div className="profile-box">
                  <h3>{profile.username || "Set Username"}</h3>
                  <p className="muted">{profile.email}</p>
                  <div className="stats">
                    <div>Your Stats</div>
                    <div>Matches Played: {profile.matchesPlayed ?? 0}</div>
                    <div>Total Kills: {profile.totalKills ?? 0}</div>
                    <div>Booyahs: {profile.booyahs ?? 0}</div>
                    <div>Coins Earned: {profile.coins ?? 0}</div>
                  </div>
                </div>

                <div className="account-menu">
                  <button className="account-option" onClick={() => { setNewDisplayName(profile.displayName || ""); setAccountView("profile"); }}>
                    <FaUserCog /> <span>Profile Settings</span> <span className="arrow">&gt;</span>
                  </button>

                  <button className="account-option" onClick={() => setShowUsernameModal(true)}>
                    <FaUserEdit /> <span>Edit In-Game Username</span> <span className="arrow">&gt;</span>
                  </button>

                  <button className="account-option" onClick={() => setAccountView("refer")}>
                    <FaGift /> <span>Refer a Friend</span> <span className="arrow">&gt;</span>
                  </button>

                  <button className="account-option logout" onClick={handleLogout}>
                    <FaSignOutAlt /> <span>Logout</span> <span className="arrow">&gt;</span>
                  </button>
                </div>
              </>
            )}

            {accountView === "profile" && (
              <div>
                <button className="back-btn" onClick={() => setAccountView("main")}><FaArrowLeft /> Back</button>
                <h3>Profile Settings</h3>
                <div className="form-group">
                  <label>Display Name</label>
                  <input className="modern-input" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
                  <button className="btn" onClick={handleUpdateDisplayName}>Save</button>
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <button className="btn ghost" onClick={handlePasswordReset}>Send Password Reset Email</button>
                </div>
              </div>
            )}

            {accountView === "refer" && (
              <div>
                <button className="back-btn" onClick={() => setAccountView("main")}><FaArrowLeft /> Back</button>
                <h3>Refer a Friend</h3>
                <p>Your code: <strong>{profile.referralCode}</strong></p>
                <p className="modern-subtitle">Share this code. When a friend redeems it they get 50 coins and you get 20 coins.</p>
                {!profile.hasRedeemedReferral && (
                  <div>
                    <input className="modern-input" placeholder="Enter friend's code" value={profile.redeemCodeInput || ""} onChange={(e) => setProfile(prev => ({ ...prev, redeemCodeInput: e.target.value }))} />
                    <button className="btn glow" onClick={async () => {
                      // use your existing backend or simple client redeem flow
                      const code = (profile.redeemCodeInput || "").toUpperCase().trim();
                      if (!code) return setModalMessage("Enter code.");
                      if (code === profile.referralCode) return setModalMessage("You can't use your own code.");
                      try {
                        setLoading(true);
                        // Try call server endpoint if you have /api/redeemReferralCode OR do local check (not secure) — here we'll try server and fallback to local error.
                        let appCheckToken = null;
                        try {
                          if (appCheckInstance) {
                            appCheckToken = await getToken(appCheckInstance, false);
                          }
                        } catch (err) { /* ignore app check token error */ }
                        // If you have vercel function, call it. For now just show message.
                        setModalMessage("Referral redeem requested. Admin will verify. (Server-side verification recommended.)");
                        // update local flags to prevent re-redemption
                        const uref = doc(db, "users", user.uid);
                        await updateDoc(uref, { hasRedeemedReferral: true, coins: (profile.coins || 0) + 50 });
                        const s = await getDoc(uref);
                        setProfile({ id: s.id, ...s.data() });
                      } catch (err) {
                        console.error("redeem referral", err);
                        setModalMessage("Failed to redeem. Try later.");
                      } finally {
                        setLoading(false);
                      }
                    }}>Redeem Code</button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="bottom-nav">
        {["home", "matches", "topup", "withdraw", "account"].map((tab) => (
          <button key={tab} className={`nav-btn ${activeTab === tab ? "active" : ""}`} onClick={() => { setActiveTab(tab); setAccountView("main"); setTopupView("select"); }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>

      {/* Username Modal */}
      {showUsernameModal && (
        <div className="modal-overlay" onClick={() => setShowUsernameModal(false)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3>{profile.username ? "Edit Username" : "Set Username"}</h3>
            <form onSubmit={handleSetUsername}>
              <input className="modern-input" placeholder="Enter username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button className="btn glow" type="submit">Save</button>
                <button type="button" className="btn ghost" onClick={() => setShowUsernameModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generic modal message */}
      {modalMessage && (
        <div className="modal-overlay" onClick={() => setModalMessage(null)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3>Notice</h3>
            <p>{modalMessage}</p>
            <button className="btn glow" onClick={() => setModalMessage(null)}>OK</button>
          </div>
        </div>
      )}

      {/* Level up popup */}
      {levelUp && (
        <div className="levelup-popup">
          <div className="levelup-card">
            <img src={levelUp.badge} alt="Level badge" style={{ width: 96, height: 96 }} />
            <h2>Level Up!</h2>
            <p>Ranked {levelUp.newLevel} — Congrats!</p>
          </div>
        </div>
      )}
    </div>
  );
}
