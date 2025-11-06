import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase";
import { 
  signOut, 
  updateProfile, 
  sendPasswordResetEmail 
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
  FaUserEdit,
  FaQuestionCircle, 
  FaUserCog 
} from "react-icons/fa";

// Import your history page components
import MatchHistoryPage from './MatchHistoryPage';
import WithdrawalHistoryPage from './WithdrawalHistoryPage';
// Removed HowToPlay import to fix build
// import HowToPlay from './HowToPlay'; 

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
  startTime: "", 
  rules: "", 
};

// List of available gift cards
const rewardOptions = [
  { type: 'UPI', amount: 25, cost: 275, icon: '/upi.png' },
  { type: 'UPI', amount: 50, cost: 550, icon: '/upi.png' },
  { type: 'Google Play', amount: 50, cost: 550, icon: '/google-play.png' },
  { type: 'Google Play', amount: 100, cost: 1100, icon: '/google-play.png' },
  { type: 'Amazon', amount: 50, cost: 550, icon: '/amazon.png' },
  { type: 'Amazon', amount: 100, cost: 1100, icon: '/amazon.png' },
];

// Helper function to format timestamps nicely
function formatMatchTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return "Time TBD";
  }
  return timestamp.toDate().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
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

  // 👇 NEW: State for the message modal
  const [modalMessage, setModalMessage] = useState(null);

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
          const data = snap.data();
          
          if (!data.referralCode) {
            const newReferralCode = user.uid.substring(0, 8).toUpperCase();
            await updateDoc(ref, {
              referralCode: newReferralCode,
              hasRedeemedReferral: data.hasRedeemedReferral || false
            });
            
            if (mounted) {
              setProfile({ 
                id: snap.id, 
                ...data, 
                referralCode: newReferralCode, 
                hasRedeemedReferral: data.hasRedeemedReferral || false 
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
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [user.uid, user.email, user.displayName]);

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
        const matchesData = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

  // Pre-fill username modal when it opens
  useEffect(() => {
    if (profile?.username) {
      setNewUsername(profile.username);
    }
  }, [showUsernameModal, profile?.username]);

  // Function to toggle music on/off
  const toggleMusic = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Referral function with 20/50 coins
  async function handleRedeemReferral() {
    if (!referralInput) return setModalMessage("Please enter a referral code.");
    if (profile.hasRedeemedReferral) return setModalMessage("You have already redeemed a referral code.");
    if (referralInput.toUpperCase() === profile.referralCode) return setModalMessage("You cannot use your own referral code.");

    try {
      setLoading(true);
      const q = query(collection(db, "users"), where("referralCode", "==", referralInput.toUpperCase()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) { 
        setLoading(false); 
        return setModalMessage("Invalid referral code."); 
      }

      const referrerDoc = querySnapshot.docs[0];
      const referrerRef = doc(db, "users", referrerDoc.id);
      const referrerCurrentCoins = referrerDoc.data().coins || 0;

      await updateDoc(referrerRef, { coins: referrerCurrentCoins + 20 });
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { coins: profile.coins + 50, hasRedeemedReferral: true });

      setProfile({ ...profile, coins: profile.coins + 50, hasRedeemedReferral: true });
      setModalMessage("Success! You received 50 coins, and your friend received 20 coins.");
      setReferralInput("");
    } catch (err) {
      console.error("Referral Error:", err);
      setModalMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  
  async function addCoin(n = 1) {
    if (!profile) return;
    const ref = doc(db, "users", user.uid);
    const newCoins = (profile.coins || 0) + n;
    await updateDoc(ref, { coins: newCoins });
    setProfile(prevProfile => ({ ...prevProfile, coins: newCoins }));
  }
  
  async function claimDaily() {
    if (!profile) return;
    const last = profile.lastDaily && typeof profile.lastDaily.toDate === "function" ? profile.lastDaily.toDate() : null;
    const now = new Date();
    const isSameDay = last && last.toDateString() === now.toDateString();
    if (isSameDay) return setModalMessage("You already claimed today's coin.");

    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, {
      coins: (profile.coins || 0) + 10, 
      lastDaily: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
    setModalMessage("+10 coins credited!"); 
  }

  // FIXED AD FUNCTION
  async function watchAd() {
    if (adLoading) return; 
    if (!window.adsbygoogle || !window.adbreak) {
      console.error("AdSense script not loaded.");
      setModalMessage("Ads are not available right now. Please try again later.");
      return;
    }
    setAdLoading(true);
    try {
      window.adbreak({
        type: 'reward',
        name: 'watch-ad-reward',
        adDismissed: () => {
          setAdLoading(false);
        },
        adBreakDone: (placementInfo) => {
          if (placementInfo.breakStatus !== 'viewed' && placementInfo.breakStatus !== 'dismissed') {
            console.error("Ad failed to load:", placementInfo.breakError);
            if(placementInfo.breakStatus !== 'unfilled') {
              setModalMessage("Ads failed to load. Please try again later.");
            }
          }
          setAdLoading(false);
        },
        beforeReward: (showAdFn) => {
          addCoin(5);
          setModalMessage("+5 coins for watching the ad!");
          showAdFn(); 
        }
      });
    } catch (err) {
      console.error("AdSense error:", err);
      setModalMessage("An ad error occurred.");
      setAdLoading(false);
    }
  }
  
  async function handleTopup() {
    const amt = parseInt(selectedAmount || topupAmount);
    if (!amt || amt < 20) return setModalMessage("Minimum top-up is ₹20.");
    try {
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: amt,
        coins: amt * 10, 
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setModalMessage("Top-up request submitted! Admin will verify it soon.");
      setTopupAmount("");
      setSelectedAmount(null);
    } catch (err) {
      console.error("Top-up error:", err);
    }
  }

  // Function for redeeming rewards (UPI, Gift Cards)
  async function handleRedeemReward(reward) {
    if (!profile) return;
    if (profile.coins < reward.cost) return setModalMessage("You don't have enough coins for this reward.");

    let upiId = ''; 
    if (reward.type === 'UPI') {
      upiId = window.prompt(`Enter your UPI ID to receive ₹${reward.amount}:`);
      if (!upiId) return setModalMessage("UPI ID is required. Redemption cancelled.");
    } else {
      if (!window.confirm(`Redeem ${reward.type} Gift Card (₹${reward.amount}) for ${reward.cost} coins?`)) {
        return;
      }
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "withdrawRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: reward.amount,
        coinsDeducted: reward.cost,
        status: "pending",
        type: reward.type,
        upiId: upiId, 
        createdAt: serverTimestamp(),
      });

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        coins: profile.coins - reward.cost,
      });

      setProfile({
        ...profile,
        coins: profile.coins - reward.cost,
      });

      if (reward.type === 'UPI') {
        setModalMessage("Withdrawal request submitted! Admin will process it shortly.");
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
      const userDocRef = doc(db, 'users', user.uid);
      const matchDocRef = doc(db, 'matches', matchId);

      await updateDoc(userDocRef, { coins: profile.coins - entryFee });
      await updateDoc(matchDocRef, { playersJoined: arrayUnion(user.uid) });

      setProfile({ ...profile, coins: profile.coins - entryFee });
      
      const updatedPlayers = [...playersJoined, user.uid];
      const updatedMatch = { ...match, playersJoined: updatedPlayers };

      setMatches((prevMatches) =>
        prevMatches.map((m) => (m.id === matchId ? updatedMatch : m))
      );
      
      setModalMessage("You have successfully joined the match!");
      setSelectedMatch(updatedMatch); 
    } catch (err) {
      console.error("Error joining match:", err);
      setModalMessage("An error occurred while joining. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  
  // Admin fetch
  useEffect(() => {
    if (profile?.email !== adminEmail) return;
    (async () => {
      const topupQuery = query(collection(db, "topupRequests"), where("status", "==", "pending"));
      const topupSnap = await getDocs(topupQuery);
      const withdrawQuery = query(collection(db, "withdrawRequests"), where("status", "==", "pending"));
      const withdrawSnap = await getDocs(withdrawQuery);
      setRequests({
        topup: topupSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        withdraw: withdrawSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
    })();
  }, [profile?.email, activeTab]);

  // FIXED APPROVE FUNCTION
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
        console.error("User document not found for approval!");
        setModalMessage("Error: User not found.");
      }
    }
    setModalMessage(`${type} approved.`);
    setRequests((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== req.id) }));
  }

  // FIXED REJECT FUNCTION
  async function rejectRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "rejected" });
    setModalMessage(`${type} rejected.`);
    setRequests((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== req.id) }));
  }

  // Helper function to update the newMatch state
  const handleNewMatchChange = (e) => { const { name, value, type } = e.target; const val = type === "number" ? parseInt(value) || 0 : value; setNewMatch((prev) => ({ ...prev, [name]: val, })); };
  
  // Function to handle creating the match
  async function handleCreateMatch(e) {
    e.preventDefault(); 
    if (!newMatch.title || !newMatch.imageUrl || !newMatch.startTime) { 
      return setModalMessage("Please fill in Title, Image URL, and Start Time.");
    }

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

      if (matchData.prizeModel === "Scalable") {
        delete matchData.booyahPrize; 
      } else {
        delete matchData.commissionPercent;
        delete matchData.perKillReward;
      }

      await addDoc(collection(db, "matches"), matchData);
      setModalMessage("Match created successfully!");
      setNewMatch(initialMatchState); 
    } catch (err) {
      console.error("Error creating match:", err);
      setModalMessage("Failed to create match. Check console for error.");
    } finally {
      setLoading(false);
    }
  }

  // Function to save the new username
  async function handleSetUsername(e) {
    e.preventDefault();
    if (!newUsername) return setModalMessage("Username cannot be blank.");

    try {
      setLoading(true);
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        username: newUsername,
      });

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

  // Function to update display name
  async function handleUpdateDisplayName(e) {
    e.preventDefault(); 
    if (!newDisplayName) return setModalMessage("Display name cannot be blank.");
    if (newDisplayName === profile.displayName) return setModalMessage("No changes made.");

    setLoading(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: newDisplayName
        });
      }
      
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName
      });

      setProfile({
        ...profile,
        displayName: newDisplayName
      });

      setModalMessage("Display name updated successfully!");
    } catch (err) {
      console.error("Error updating display name:", err);
      setModalMessage("Failed to update display name.");
    } finally {
      setLoading(false);
    }
  }

  // FIXED PASSWORD RESET FUNCTION
  async function handlePasswordReset() {
    if (!user?.email) return setModalMessage("Could not find user email.");
    
    const providerIds = auth.currentUser.providerData.map(p => p.providerId);
    
    if (!providerIds.includes('password')) {
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
                  <div className="big coin-row">
                    <img src="/coin.jpg" alt="coin" className="coin-icon" style={{ width: "28px", height: "28px", borderRadius: "50%", animation: "spinCoin 3s linear infinite", }} />
                    <span>{profile.coins ?? 0}</span>
                  </div>
                </div>
                <div className="home-actions">
                  <button className="btn" onClick={claimDaily}>
                    Claim Daily (+10)
                  </button>
                  <button className="btn ghost" onClick={watchAd} disabled={adLoading}>
                    {adLoading ? "Loading Ad..." : "Watch Ad (+5)"}
                  </button>
                </div>
              </div>
            </section>
            <section className="panel"> <h3>Welcome!</h3> <p>Check the matches tab to join a game.</p> </section>
          </>
        )}

        {activeTab === "matches" && (
          <>
            {!selectedMatch ? (
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
                      <div key={match.id} className="match-card" onClick={() => setSelectedMatch(match)}>
                        <img src={match.imageUrl} alt={match.title} />
                        <div className="match-info">
                          <div className="match-title">{match.title}</div>
                          <div className="match-meta time">
                            Starts: {formatMatchTime(match.startTime)}
                          </div>
                          <div className="match-meta">
                            Entry: {match.entryFee} Coins | Joined:{" "}
                            {match.playersJoined?.length || 0} / {match.maxPlayers}
                          </div>
                          <button className="btn" onClick={(e) => { e.stopPropagation(); handleJoinMatch(match); }} disabled={hasJoined || isFull} >
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
                <button className="back-btn" onClick={() => setSelectedMatch(null)}>
                  <FaArrowLeft /> Back to Matches
                </button>
                <img src={selectedMatch.imageUrl} alt="match" className="match-details-image" />
                <h3 className="modern-title">{selectedMatch.title}</h3>
                <p className="match-details-time">
                  Starts: {formatMatchTime(selectedMatch.startTime)}
                </p>
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
          <section className="modern-card">
            <h3 className="modern-title">Top-up Coins</h3> <p className="modern-subtitle">1 ₹ = 10 Coins | Choose an amount</p> 
            <div className="amount-options"> 
              {[20, 50, 100, 200].map((amt) => ( 
                <div key={amt} className={`amount-btn ${ selectedAmount === amt ? "selected" : "" }`} onClick={() => setSelectedAmount(amt)} > 
                  ₹{amt} = {amt * 10} Coins 
                </div> 
              ))} 
            </div> 
            <input type="number" className="modern-input" placeholder="Or enter custom amount ₹" value={topupAmount} onChange={(e) => { setSelectedAmount(null); setTopupAmount(e.target.value); }} /> <button className="btn glow large" onClick={handleTopup}> Submit Top-up Request </button>
          </section>
        )}

        {activeTab === "withdraw" && (
          <div className="withdraw-container">
            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: '10px' }}>Redeem Coins as UPI</h3>
              <p className="modern-subtitle" style={{ paddingLeft: '10px' }}>10% commission fee</p>
              <div className="reward-grid">
                {rewardOptions
                  .filter((opt) => opt.type === 'UPI')
                  .map((reward) => (
                    <div
                      key={`${reward.type}-${reward.amount}`}
                      className="reward-card"
                      onClick={() => handleRedeemReward(reward)}
                    >
                      <img src={reward.icon} alt="UPI" className="reward-icon" />
                      <div className="reward-cost">
                        <img src="/coin.jpg" alt="coin" />
                        <span>{reward.cost}</span>
                      </div>
                      <div className="reward-amount">₹ {reward.amount}</div>
                    </div>
                  ))}
              </div>
            </section>
            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: '10px' }}>Redeem as Google Gift Card</h3>
              <div className="reward-grid">
                {rewardOptions
                  .filter((opt) => opt.type === 'Google Play')
                  .map((reward) => (
                    <div
                      key={`${reward.type}-${reward.amount}`}
                      className="reward-card"
                      onClick={() => handleRedeemReward(reward)}
                    >
                      <img src={reward.icon} alt="Google Play" className="reward-icon" />
                      <div className="reward-cost">
                        <img src="/coin.jpg" alt="coin" />
                        <span>{reward.cost}</span>
                      </div>
                      <div className="reward-amount">₹ {reward.amount}</div>
                    </div>
                  ))}
              </div>
            </section>
            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: '10px' }}>Redeem as Amazon Gift Card</h3>
              <div className="reward-grid">
                {rewardOptions
                  .filter((opt) => opt.type === 'Amazon')
                  .map((reward) => (
                    <div
                      key={`${reward.type}-${reward.amount}`}
                      className="reward-card"
                      onClick={() => handleRedeemReward(reward)}
                    >
                      <img src={reward.icon} alt="Amazon" className="reward-icon" />
                      <div className="reward-cost">
                        <img src="/coin.jpg" alt="coin" />
                        <span>{reward.cost}</span>
                      </div>
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
              <select name="type" className="modern-input" value={newMatch.type} onChange={handleNewMatchChange} > <option value="BR">Battle Royale</option> <option value="CS">Clash Squad</option> </select>
              <label>Prize Model</label>
              <select name="prizeModel" className="modern-input" value={newMatch.prizeModel} onChange={handleNewMatchChange} > <option value="Scalable">Scalable (BR - % commission)</option> <option value="Fixed">Fixed (CS - fixed prize)</option> </select>
              <label>Entry Fee (Coins)</label>
              <input name="entryFee" type="number" className="modern-input" value={newMatch.entryFee} onChange={handleNewMatchChange} />
              <label>Max Players</label>
              <input name="maxPlayers" type="number" className="modern-input" value={newMatch.maxPlayers} onChange={handleNewMatchChange} />
              {newMatch.prizeModel === "Scalable" ? ( <> <label>Per Kill Reward (Coins)</label> <input name="perKillReward" type="number" className="modern-input" value={newMatch.perKillReward} onChange={handleNewMatchChange} /> <label>Commission (%)</label> <input name="commissionPercent" type="number" className="modern-input" value={newMatch.commissionPercent} onChange={handleNewMatchChange} /> </> ) : ( <> <label>Booyah Prize (Fixed Total)</label> <input name="booyahPrize" type="number" className="modern-input" value={newMatch.booyahPrize} onChange={handleNewMatchChange} /> </> )}
              <label>Rules</label>
              <textarea name="rules" className="modern-input" placeholder="Enter match rules..." value={newMatch.rules} onChange={handleNewMatchChange} />
              <button type="submit" className="btn glow"> Create Match </button>
            </form>
            <hr style={{ margin: "24px 0", borderColor: "var(--panel)" }} />
            <h4>Top-up Requests</h4>
            {requests.topup.map((r) => ( <div key={r.id} className="admin-row"> <span> {r.email} | ₹{r.amount} </span> <div> <button className="btn small" onClick={() => approveRequest("topup", r)} > Approve </button> <button className="btn small ghost" onClick={() => rejectRequest("topup", r)} > Reject </button> </div> </div> ))}
            <h4>Withdraw Requests</h4>
            {requests.withdraw.map((r) => ( <div key={r.id} className="admin-row"> <span> {r.email} | ₹{r.amount} | {r.type === 'UPI' ? `UPI: ${r.upiId}` : `Type: ${r.type}`} </span> <div> <button className="btn small" onClick={() => approveRequest("withdraw", r)} > Approve </button> <button className="btn small ghost" onClick={() => rejectRequest("withdraw", r)} > Reject </button> </div> </div> ))}
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
                  {/* (Removed How to Play button) */}
                  <button
                    className="account-option"
                    onClick={() => {
                      setNewDisplayName(profile.displayName || ""); 
                      setAccountView("profile");
                    }}
                  >
                    <FaUserCog size={20} />
                    <span>Profile Settings</span>
                    <span className="arrow">&gt;</span>
                  </button>
                  <button className="account-option" onClick={() => setShowUsernameModal(true)} > <FaUserEdit size={20} /> <span>Edit In-Game Username</span> <span className="arrow">&gt;</span> </button>
                  <button className="account-option" onClick={() => setAccountView("refer")} > <FaGift size={20} /> <span>Refer a Friend</span> <span className="arrow">&gt;</span> </button>
                  <button className="account-option" onClick={() => setAccountView("match_history")} > <FaHistory size={20} /> <span>Match History</span> <span className="arrow">&gt;</span> </button>
                  <button className="account-option" onClick={() => setAccountView("withdraw_history")} > <FaMoneyBillWave size={20} /> <span>Withdrawal History</span> <span className="arrow">&gt;</span> </button>
                  <button className="account-option logout" onClick={handleLogout}> <FaSignOutAlt size={20} /> <span>Logout</span> <span className="arrow">&gt;</span> </button>
                </section>
              </>
            )}

            {accountView === "profile" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}>
                  <FaArrowLeft /> Back
                </button>
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
                    <input
                      type="text"
                      className="modern-input"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="Enter your display name"
                    />
                    <button type="submit" className="btn" disabled={loading}>
                      {loading ? "Saving..." : "Save Name"}
                    </button>
                  </form>
                  <hr />
                  <div className="form-group">
                    <label>Password</label>
                    <button className="btn ghost" onClick={handlePasswordReset}>
                      Send Password Reset Email
                    </button>
                  </div>
                </div>
              </section>
            )}

            {accountView === "refer" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}> <FaArrowLeft /> Back </button>
                <h3 className="modern-title">Refer a Friend</h3>
                <div className="referral-card">
                  <p>Your Unique Referral Code:</p>
                  <div className="referral-code">
                    {profile.referralCode ? profile.referralCode : "Loading..."}
                  </div>
                  <p className="modern-subtitle" style={{ textAlign: "center" }}>
                    Share this code with your friends. When they use it, they get
                    50 coins and you get 20 coins!
                  </p>
                </div>
                {!profile.hasRedeemedReferral && (
                  <div className="referral-form">
                    <p>Have a friend's code?</p>
                    <input type="text" className="modern-input" placeholder="Enter referral code" value={referralInput} onChange={(e) => setReferralInput(e.target.value)} />
                    <button className="btn glow large" onClick={handleRedeemReferral} > Redeem Code </button>
                  </div>
                )}
              </section>
            )}
            {accountView === "match_history" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}> <FaArrowLeft /> Back </button>
                <MatchHistoryPage user={user} />
              </section>
            )}
            {accountView === "withdraw_history" && (
              <section className="panel">
                <button className="back-btn" onClick={() => setAccountView("main")}> <FaArrowLeft /> Back </button>
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
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>

      {showUsernameModal && (
        <div className="modal-overlay">
          <div className="modal-content modern-card">
            <h3 className="modern-title">
              {profile.username ? "Edit Your Username" : "Set Your In-Game Username"}
            </h3>
            <p className="modern-subtitle">
              You must set a username before joining a match. This name will be
              used in tournaments.
            </p>
            <form onSubmit={handleSetUsername}>
              <input
                type="text"
                className="modern-input"
                placeholder="Enter your username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
              <button type="submit" className="btn glow large" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="btn large ghost"
                style={{marginTop: '10px'}}
                onClick={() => setShowUsernameModal(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 👇 NEW: Custom Message Modal */}
      {modalMessage && (
        <div className="modal-overlay" onClick={() => setModalMessage(null)}>
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Notification</h3>
            <p className="modern-subtitle" style={{textAlign: 'center', marginBottom: '24px'}}>
              {modalMessage}
            </p>
            <button
              className="btn glow large"
              onClick={() => setModalMessage(null)}
            >
              OK
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
