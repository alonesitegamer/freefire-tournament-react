import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
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
import { useNavigate } from "react-router-dom";
// Icons for Account menu and Music
import {
  FaVolumeUp,
  FaVolumeMute,
  FaHistory,
  FaMoneyBillWave,
  FaGift,
  FaSignOutAlt,
  FaArrowLeft,
} from "react-icons/fa";

// Import your history page components
import MatchHistoryPage from './MatchHistoryPage';
import WithdrawalHistoryPage from './WithdrawalHistoryPage';

// Define the default state for your match form
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
};

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [topupAmount, setTopupAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });
  const [selectedAmount, setSelectedAmount] = useState(null);

  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // State to manage the "Create Match" form
  const [newMatch, setNewMatch] = useState(initialMatchState);

  // State for the music
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // State for the Account page's internal menu
  const [accountView, setAccountView] = useState("main");
  const [referralInput, setReferralInput] = useState("");

  const navigate = useNavigate();

  const adminEmail = "esportsimperial50@gmail.com";
  const adminPassword = "imperialx";

  // Load profile
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          if (mounted) setProfile({ id: snap.id, ...snap.data() });
        } else {
          // Added referralCode and hasRedeemedReferral for new users
          const newReferralCode = user.uid.substring(0, 8).toUpperCase();
          await setDoc(ref, {
            email: user.email,
            coins: 0,
            displayName: user.displayName || "",
            lastDaily: null,
            createdAt: serverTimestamp(),
            referralCode: newReferralCode, // Unique code for every user
            hasRedeemedReferral: false, // Flag to prevent multiple redeems
          });
          const s2 = await getDoc(ref);
          if (mounted) setProfile({ id: s2.id, ...s2.data() });
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [user.uid, user.email]);

  // useEffect TO LOAD MATCHES
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
        const matchesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setMatches(matchesData);
      } catch (err) {
        console.error("Error loading matches:", err);
      } finally {
        setLoadingMatches(false);
      }
    }
    if (activeTab === "matches") {
      loadMatches();
    }
  }, [activeTab]);

  // Function to toggle music on/off
  const toggleMusic = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Function to handle redeeming a referral code
  async function handleRedeemReferral() {
    if (!referralInput) return alert("Please enter a referral code.");

    if (profile.hasRedeemedReferral) {
      return alert("You have already redeemed a referral code.");
    }

    if (referralInput.toUpperCase() === profile.referralCode) {
      return alert("You cannot use your own referral code.");
    }

    try {
      setLoading(true);
      // 1. Find the user who owns the code
      const q = query(
        collection(db, "users"),
        where("referralCode", "==", referralInput.toUpperCase())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return alert("Invalid referral code.");
      }

      // 2. Get the referrer (the person who gave the code)
      const referrerDoc = querySnapshot.docs[0];
      const referrerRef = doc(db, "users", referrerDoc.id);
      const referrerCurrentCoins = referrerDoc.data().coins || 0;

      // 3. Pay the referrer 100 coins
      await updateDoc(referrerRef, {
        coins: referrerCurrentCoins + 100,
      });

      // 4. Pay the current user (referee) 30 coins and mark as redeemed
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        coins: profile.coins + 30,
        hasRedeemedReferral: true,
      });

      // 5. Update local state
      setProfile({
        ...profile,
        coins: profile.coins + 30,
        hasRedeemedReferral: true,
      });

      alert(
        "Success! You received 30 coins, and your friend received 100 coins."
      );
      setReferralInput("");
    } catch (err) {
      console.error("Referral Error:", err);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  
  async function addCoin(n = 1) { if (!profile) return; const ref = doc(db, "users", user.uid); await updateDoc(ref, { coins: (profile.coins || 0) + n }); const snap = await getDoc(ref); setProfile({ id: snap.id, ...snap.data() }); }
  async function claimDaily() { if (!profile) return; const last = profile.lastDaily && typeof profile.lastDaily.toDate === "function" ? profile.lastDaily.toDate() : null; const now = new Date(); const isSameDay = last && last.toDateString() === now.toDateString(); if (isSameDay) return alert("You already claimed today's coin."); const ref = doc(db, "users", user.uid); await updateDoc(ref, { coins: (profile.coins || 0) + 1, lastDaily: serverTimestamp(), }); const snap = await getDoc(ref); setProfile({ id: snap.id, ...snap.data() }); alert("+1 coin credited!"); }
  async function watchAd() { await addCoin(1); alert("+1 coin for watching ad (demo)"); }
  async function handleTopup() { const amt = parseInt(selectedAmount || topupAmount); if (!amt || amt < 20) return alert("Minimum top-up is ₹20."); try { await addDoc(collection(db, "topupRequests"), { userId: user.uid, email: profile.email, amount: amt, coins: amt, status: "pending", createdAt: serverTimestamp(), }); alert("Top-up request submitted! Admin will verify it soon."); setTopupAmount(""); setSelectedAmount(null); } catch (err) { console.error("Top-up error:", err); } }
  async function handleWithdraw() { const amt = parseInt(withdrawAmount); if (!amt || amt < 50) return alert("Minimum withdrawal is ₹50."); if (!upiId) return alert("Please enter your UPI ID."); const totalCoins = Math.ceil(amt * 1.1); if (profile.coins < totalCoins) return alert(`You need at least ${totalCoins} coins to withdraw ₹${amt}.`); try { await addDoc(collection(db, "withdrawRequests"), { userId: user.uid, email: profile.email, upiId, amount: amt, coinsDeducted: totalCoins, status: "pending", createdAt: serverTimestamp(), }); await updateDoc(doc(db, "users", user.uid), { coins: profile.coins - totalCoins, }); alert( `Withdrawal request submitted! ₹${amt} (-${totalCoins} coins including 10% commission).` ); setWithdrawAmount(""); setUpiId(""); const snap = await getDoc(doc(db, "users", user.uid)); setProfile({ id: snap.id, ...snap.data() }); } catch (err) { console.error("Withdraw error:", err); } }
  async function handleJoinMatch(match) { if (!profile) return; const { entryFee, id: matchId, playersJoined = [], maxPlayers } = match; if (playersJoined.includes(user.uid)) { alert("You have already joined this match."); return; } if (playersJoined.length >= maxPlayers) { alert("Sorry, this match is full."); return; } if (profile.coins < entryFee) { alert("You don't have enough coins to join this match."); return; } if (!window.confirm(`Join this match for ${entryFee} coins?`)) { return; } try { setLoading(true); const userDocRef = doc(db, "users", user.uid); const matchDocRef = doc(db, "matches", matchId); await updateDoc(userDocRef, { coins: profile.coins - entryFee, }); await updateDoc(matchDocRef, { playersJoined: arrayUnion(user.uid), }); setProfile({ ...profile, coins: profile.coins - entryFee, }); setMatches((prevMatches) => prevMatches.map((m) => m.id === matchId ? { ...m, playersJoined: [...m.playersJoined, user.uid] } : m ) ); alert("You have successfully joined the match!"); } catch (err) { console.error("Error joining match:", err); alert("An error occurred while joining. Please try again."); } finally { setLoading(false); } }
  async function approveRequest(type, req) { const ref = doc(db, `${type}Requests`, req.id); await updateDoc(ref, { status: "approved" }); if (type === "topup") { const userDocRef = doc(db, "users", req.userId); const userSnap = await getDoc(userDocRef); if (userSnap.exists()) { const userCurrentCoins = userSnap.data().coins || 0; await updateDoc(userDocRef, { coins: userCurrentCoins + req.coins, }); } else { console.error("User document not found for approval!"); alert("Error: User not found."); } } alert(`${type} approved.`); setRequests((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== req.id), })); }
  async function rejectRequest(type, req) { const ref = doc(db, `${type}Requests`, req.id); await updateDoc(ref, { status: "rejected" }); alert(`${type} rejected.`); setRequests((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== req.id), })); }
  const handleNewMatchChange = (e) => { const { name, value, type } = e.target; const val = type === "number" ? parseInt(value) || 0 : value; setNewMatch((prev) => ({ ...prev, [name]: val, })); };
  async function handleCreateMatch(e) { e.preventDefault(); if (!newMatch.title || !newMatch.imageUrl) { return alert("Please fill in at least the Title and Image URL."); } try { setLoading(true); let matchData = { ...newMatch, status: "upcoming", playersJoined: [], createdAt: serverTimestamp(), }; if (matchData.prizeModel === "Scalable") { delete matchData.booyahPrize; } else { delete matchData.commissionPercent; delete matchData.perKillReward; } await addDoc(collection(db, "matches"), matchData); alert("Match created successfully!"); setNewMatch(initialMatchState); } catch (err) { console.error("Error creating match:", err); alert("Failed to create match. Check console for error."); } finally { setLoading(false); } }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  if (loading || !profile)
    return <div className="center-screen">Loading Dashboard...</div>;

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
            <div className="subtitle">{profile.displayName || profile.email}</div>
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
          {/* This logout button is now hidden, as it's inside the Account tab */}
          {/* <button className="btn small ghost" onClick={handleLogout}>Logout</button> */}
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
                    <img
                      src="/coin.jpg"
                      alt="coin"
                      className="coin-icon"
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        animation: "spinCoin 3s linear infinite",
                      }}
                    />
                    <span>{profile.coins ?? 0}</span>
                  </div>
                </div>
                <div>
                  <button className="btn" onClick={claimDaily}>
                    Claim Daily (+1)
                  </button>
                  <button className="btn ghost" onClick={watchAd}>
                    Watch Ad (+1)
                  </button>
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
          <section className="panel">
            <h3>Available Matches</h3>
            {loadingMatches && <p>Loading matches...</p>}

            {!loadingMatches && matches.length === 0 && (
              <p>No upcoming matches right now. Check back soon!</p>
            )}

            <div className="grid">
              {matches.map((match) => {
                const hasJoined = match.playersJoined?.includes(user.uid);
                const isFull = match.playersJoined?.length >= match.maxPlayers;

                return (
                  <div key={match.id} className="match-card">
                    <img src={match.imageUrl} alt={match.title} />
                    <div className="match-info">
                      <div className="match-title">{match.title}</div>
                      <div className="match-meta">
                        Entry: {match.entryFee} Coins | Joined:{" "}
                        {match.playersJoined?.length || 0} / {match.maxPlayers}
                      </div>

                      <button
                        className="btn"
                        onClick={() => handleJoinMatch(match)}
                        disabled={hasJoined || isFull}
                      >
                        {hasJoined ? "Joined" : isFull ? "Full" : "Join"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "topup" && (
          <section className="modern-card">
            <h3 className="modern-title">Top-up Coins</h3>
            <p className="modern-subtitle">1 ₹ = 1 Coin | Choose an amount</p>
            <div className="amount-options">
              {[20, 50, 100, 200].map((amt) => (
                <div
                  key={amt}
                  className={`amount-btn ${
                    selectedAmount === amt ? "selected" : ""
                  }`}
                  onClick={() => setSelectedAmount(amt)}
                >
                  ₹{amt} = {amt} Coins
                </div>
              ))}
            </div>
            <input
              type="number"
              className="modern-input"
              placeholder="Or enter custom amount ₹"
              value={topupAmount}
              onChange={(e) => {
                setSelectedAmount(null);
                setTopupAmount(e.target.value);
              }}
            />
            <button className="btn glow large" onClick={handleTopup}>
              Submit Top-up Request
            </button>
          </section>
        )}

        {activeTab === "withdraw" && (
          <section className="modern-card">
            <h3 className="modern-title">Withdraw Coins</h3>
            <p className="modern-subtitle">10% commission | Minimum ₹50</p>
            <div className="withdraw-form">
              <input
                type="number"
                className="modern-input"
                placeholder="Enter amount ₹"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <input
                type="text"
                className="modern-input"
                placeholder="Enter your UPI ID"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
              <button className="btn glow large" onClick={handleWithdraw}>
                Request Withdrawal
              </button>
            </div>
          </section>
        )}

        {activeTab === "admin" && profile.email === adminEmail && (
          <section className="panel">
            <h3>Admin Panel</h3>

            {/* The "Create Match" Form */}
            <form onSubmit={handleCreateMatch} className="admin-form">
              <h4>Create New Match</h4>

              <input
                name="title"
                className="modern-input"
                placeholder="Match Title (e.g., 1v1 Clash Squad)"
                value={newMatch.title}
                onChange={handleNewMatchChange}
              />
              <input
                name="imageUrl"
                className="modern-input"
                placeholder="Image URL (e.g., /cs.jpg)"
                value={newMatch.imageUrl}
                onChange={handleNewMatchChange}
              />

              <label>Match Type</label>
              <select
                name="type"
                className="modern-input"
                value={newMatch.type}
                onChange={handleNewMatchChange}
              >
                <option value="BR">Battle Royale</option>
                <option value="CS">Clash Squad</option>
              </select>

              <label>Prize Model</label>
              <select
                name="prizeModel"
                className="modern-input"
                value={newMatch.prizeModel}
                onChange={handleNewMatchChange}
              >
                <option value="Scalable">Scalable (BR - % commission)</option>
                <option value="Fixed">Fixed (CS - fixed prize)</option>
              </select>

              <label>Entry Fee (Coins)</label>
              <input
                name="entryFee"
                type="number"
                className="modern-input"
                value={newMatch.entryFee}
                onChange={handleNewMatchChange}
              />

              <label>Max Players</label>
              <input
                name="maxPlayers"
                type="number"
                className="modern-input"
                value={newMatch.maxPlayers}
                onChange={handleNewMatchChange}
              />

              {/* These fields only show when needed */}
              {newMatch.prizeModel === "Scalable" ? (
                <>
                  <label>Per Kill Reward (Coins)</label>
                  <input
                    name="perKillReward"
                    type="number"
                    className="modern-input"
                    value={newMatch.perKillReward}
                    onChange={handleNewMatchChange}
                  />
                  <label>Commission (%)</label>
                  <input
                    name="commissionPercent"
                    type="number"
                    className="modern-input"
                    value={newMatch.commissionPercent}
                    onChange={handleNewMatchChange}
                  />
                </>
              ) : (
                <>
                  <label>Booyah Prize (Fixed Total)</label>
                  <input
                    name="booyahPrize"
                    type="number"
                    className="modern-input"
                    value={newMatch.booyahPrize}
                    onChange={handleNewMatchChange}
                  />
                </>
              )}

              <button type="submit" className="btn glow">
                Create Match
              </button>
            </form>

            <hr style={{ margin: "24px 0", borderColor: "var(--panel)" }} />

            {/* Your existing admin panel code */}
            <h4>Top-up Requests</h4>
            {requests.topup.map((r) => (
              <div key={r.id} className="admin-row">
                <span>
                  {r.email} | ₹{r.amount}
                </span>
                <div>
                  <button
                    className="btn small"
                    onClick={() => approveRequest("topup", r)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn small ghost"
                    onClick={() => rejectRequest("topup", r)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            <h4>Withdraw Requests</h4>
            {requests.withdraw.map((r) => (
              <div key={r.id} className="admin-row">
                <span>
                  {r.email} | ₹{r.amount} | UPI: {r.upiId}
                </span>
                <div>
                  <button
                    className="btn small"
                    onClick={() => approveRequest("withdraw", r)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn small ghost"
                    onClick={() => rejectRequest("withdraw", r)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 👇 This is the entire 'Account' tab section */}
        {activeTab === "account" && (
          <div className="account-container">
            {/* Main Menu View */}
            {accountView === "main" && (
              <section className="panel account-menu">
                <button
                  className="account-option"
                  onClick={() => setAccountView("refer")}
                >
                  <FaGift size={20} />
                  <span>Refer a Friend</span>
                  <span className="arrow">&gt;</span>
                </button>
                <button
                  className="account-option"
                  onClick={() => setAccountView("match_history")}
                >
                  <FaHistory size={20} />
                  <span>Match History</span>
                  <span className="arrow">&gt;</span>
                </button>
                <button
                  className="account-option"
                  onClick={() => setAccountView("withdraw_history")}
                >
                  <FaMoneyBillWave size={20} />
                  <span>Withdrawal History</span>
                  <span className="arrow">&gt;</span>
                </button>
                <button className="account-option logout" onClick={handleLogout}>
                  <FaSignOutAlt size={20} />
                  <span>Logout</span>
                  <span className="arrow">&gt;</span>
                </button>
              </section>
            )}

            {/* Refer a Friend View */}
            {accountView === "refer" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}>
                  <FaArrowLeft /> Back
                </button>
                <h3 className="modern-title">Refer a Friend</h3>
                <div className="referral-card">
                  <p>Your Unique Referral Code:</p>
                  <div className="referral-code">{profile.referralCode}</div>
                  <p className="modern-subtitle" style={{ textAlign: "center" }}>
                    Share this code with your friends. When they use it, they get
                    30 coins and you get 100 coins!
                  </p>
                </div>
                {!profile.hasRedeemedReferral && (
                  <div className="referral-form">
                    <p>Have a friend's code?</p>
                    <input
                      type="text"
                      className="modern-input"
                      placeholder="Enter referral code"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value)}
                    />
                    <button
                      className="btn glow large"
                      onClick={handleRedeemReferral}
                    >
                      Redeem Code
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Match History View */}
            {accountView === "match_history" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}>
                  <FaArrowLeft /> Back
                </button>
                <MatchHistoryPage user={user} />
              </section>
            )}

            {/* Withdrawal History View */}
            {accountView === "withdraw_history" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}>
                  <FaArrowLeft /> Back
                </button>
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
              setAccountView("main"); // Always reset account view when changing tabs
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>
    </div>
  );
}
