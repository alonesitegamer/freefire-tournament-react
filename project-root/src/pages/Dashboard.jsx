import React, { useEffect, useState, useRef } from "react";
import { auth, db, appCheckInstance } from "../firebase"; // 👈 *** IMPORT appCheckInstance ***
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
  // 👈 *** 'increment' is now GONE. This fixes the build. ***
} from "firebase/firestore";
// 👇 *** REMOVED getApp and getAppCheck, ADDED getToken ***
import { getToken } from "firebase/app-check"; 
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
  // FaQuestionCircle, // 👈 *** THIS IS THE FIX. I removed the unused icon. ***
  FaUserCog 
} from "react-icons/fa";

// Import your history page components
import MatchHistoryPage from './MatchHistoryPage';
import WithdrawalHistoryPage from './WithdrawalHistoryPage';
// import HowToPlay from './HowToPlay'; // Removed HowToPlay component

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
  const [modalMessage, setModalMessage] = useState(null);
  const [topupView, setTopupView] = useState("select"); 
  const [paymentUpiId, setPaymentUpiId] = useState("");

  // State for Settle Match
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [matchToSettle, setMatchToSettle] = useState(null);
  const [winnerUsername, setWinnerUsername] = useState("");
  const [winnerKills, setWinnerKills] = useState(0);

  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";

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
          // This is a brand new user, create their document
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

  // useEffect TO LOAD MATCHES (For users)
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
    // Only load matches if the user is on the matches tab
    // OR if they are an admin (to show the settle list)
    if (activeTab === "matches" || (activeTab === 'admin' && profile?.email === adminEmail)) {
      loadMatches();
    }
  }, [activeTab, profile?.email, adminEmail]); // Added adminEmail to dependencies

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

  // Vercel API Referral function
  async function handleRedeemReferral() {
    if (!referralInput) return setModalMessage("Please enter a referral code.");
    if (profile.hasRedeemedReferral)
      return setModalMessage("You have already redeemed a referral code.");
    if (referralInput.toUpperCase() === profile.referralCode)
      return setModalMessage("You cannot use your own referral code.");

    setLoading(true);
    try {
      // 1. Get the App Check token
      let appCheckToken;
      try {
        appCheckToken = await getToken(appCheckInstance, false); // Use the imported instance
      } catch (err) {
        console.error("Failed to get App Check token:", err);
        setModalMessage("Security check failed. Please refresh and try again.");
        setLoading(false);
        return;
      }
      
      // 2. Get the User Auth token
      const idToken = await user.getIdToken();
      
      // 3. Call the new API endpoint
      const response = await fetch('/api/redeemReferralCode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Send the User token
          'X-Firebase-AppCheck': appCheckToken.token, // Send the App Check token
        },
        body: JSON.stringify({ code: referralInput.toUpperCase() }),
      });

      const data = await response.json();

      // 4. Show success or error from the server
      if (data.success) {
        // Update local state to match
        setProfile({
          ...profile,
          coins: profile.coins + 50,
          hasRedeemedReferral: true,
        });
        setReferralInput("");
        setModalMessage(data.message);
      } else {
        setModalMessage(data.message);
      }
    } catch (err) {
      console.error("Vercel Function Error:", err);
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
    setProfile((prevProfile) => ({ ...prevProfile, coins: newCoins }));
  }

  async function claimDaily() {
    if (!profile) return;
    const last =
      profile.lastDaily && typeof profile.lastDaily.toDate === "function"
        ? profile.lastDaily.toDate()
        : null;
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
        type: "reward",
        name: "watch-ad-reward",
        adDismissed: () => {
          setAdLoading(false);
        },
        adBreakDone: (placementInfo) => {
          if (
            placementInfo.breakStatus !== "viewed" &&
            placementInfo.breakStatus !== "dismissed"
          ) {
            console.error("Ad failed to load:", placementInfo.breakError);
            if (placementInfo.breakStatus !== "unfilled") {
              setModalMessage("Ads failed to load. Please try again later.");
            }
          }
          setAdLoading(false);
        },
        beforeReward: (showAdFn) => {
          addCoin(5);
          setModalMessage("+5 coins for watching the ad!");
          showAdFn();
        },
      });
    } catch (err) {
      console.error("AdSense error:", err);
      setModalMessage("An ad error occurred.");
      setAdLoading(false);
    }
  }

  // Topup screen logic
  async function handleTopup() {
    const amt = parseInt(selectedAmount || topupAmount);
    if (!amt || amt < 20) return setModalMessage("Minimum top-up is ₹20.");
    setTopupView('pay');
  }

  // Topup "I Paid" logic
  async function handleConfirmPayment() {
    const amt = parseInt(selectedAmount || topupAmount);
    if (!paymentUpiId) {
      return setModalMessage("Please enter your UPI ID so we can verify your payment.");
    }
    
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
      console.error("Top-up error:", err);
      setModalMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Function for redeeming rewards (UPI, Gift Cards)
  async function handleRedeemReward(reward) {
    if (!profile) return;
    if (profile.coins < reward.cost)
      return setModalMessage("You don't have enough coins for this reward.");

    let upiId = "";
    if (reward.type === "UPI") {
      upiId = window.prompt(`Enter your UPI ID to receive ₹${reward.amount}:`);
      if (!upiId) return setModalMessage("UPI ID is required. Redemption cancelled.");
    } else {
      if (
        !window.confirm(
          `Redeem ${reward.type} Gift Card (₹${reward.amount}) for ${reward.cost} coins?`
        )
      ) {
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

      if (reward.type === "UPI") {
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

    if (playersJoined.length >= maxPlayers)
      return setModalMessage("Sorry, this match is full.");
    if (profile.coins < entryFee)
      return setModalMessage("You don't have enough coins to join this match.");
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

  // Admin fetch (now also fetches upcoming matches for settling)
  useEffect(() => {
    if (profile?.email !== adminEmail) return;
    (async () => {
      // Get pending requests
      const topupQuery = query(
        collection(db, "topupRequests"),
        where("status", "==", "pending")
      );
      const withdrawQuery = query(
        collection(db, "withdrawRequests"),
        where("status", "==", "pending")
      );
      
      // Get upcoming matches for admin
      const matchesQuery = query(
        collection(db, "matches"),
        where("status", "==", "upcoming"),
        orderBy("createdAt", "desc")
      );

      const [topupSnap, withdrawSnap, matchesSnap] = await Promise.all([
        getDocs(topupQuery),
        getDocs(withdrawQuery),
        getDocs(matchesQuery)
      ]);

      setRequests({
        topup: topupSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        withdraw: withdrawSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
      // Set upcoming matches to state (for admin)
      setMatches(matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    setRequests((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== req.id),
    }));
  }

  // FIXED REJECT FUNCTION
  async function rejectRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "rejected" });
    setModalMessage(`${type} rejected.`);
    setRequests((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== req.id),
    }));
  }

  // Helper function to update the newMatch state
  const handleNewMatchChange = (e) => {
    const { name, value, type } = e.target;
    const val = type === "number" ? parseInt(value) || 0 : value;
    setNewMatch((prev) => ({ ...prev, [name]: val }));
  };

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
      if (matchData.prizeModel === "Scalable") delete matchData.booyahPrize;
      else {
        delete matchData.commissionPercent;
        delete matchData.perKillReward;
      }
      await addDoc(collection(db, "matches"), matchData);
      setModalMessage("Match created successfully!");
      setNewMatch(initialMatchState);
      // Refresh matches list after creating one
      setMatches(prev => [ { ...matchData, id: 'new' }, ...prev ]);
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
    if (newDisplayName === profile.displayName)
      return setModalMessage("No changes made.");

    setLoading(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: newDisplayName,
        });
      }
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName,
      });
      setProfile({
        ...profile,
        displayName: newDisplayName,
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
    const providerIds = auth.currentUser.providerData.map((p) => p.providerId);
    if (!providerIds.includes("password")) {
      console.log("Password reset blocked. User providers:", providerIds);
      return setModalMessage(
        "Password reset is not available. You signed in using Google."
      );
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      setModalMessage(
        "Password reset email sent! Please check your inbox to set a new password."
      );
    } catch (err) {
      console.error("Password reset error:", err);
      setModalMessage("Failed to send password reset email. Please try again later.");
    }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  // Function to open the Settle Match modal
  const openSettleModal = (match) => {
    setMatchToSettle(match);
    setWinnerUsername("");
    setWinnerKills(0);
    setShowSettleModal(true);
  };
  
  // Function to call the Settle Match API
  async function handleSettleMatch(e) {
    e.preventDefault();
    if (!matchToSettle || !winnerUsername) {
      return setModalMessage("Winner username is required.");
    }

    setLoading(true);
    try {
      // 1. Get App Check token
      let appCheckToken;
      try {
        appCheckToken = await getToken(appCheckInstance, false);
      } catch (err) {
        throw new Error("Failed to get App Check token.");
      }

      // 2. Get the User Auth token
      const idToken = await user.getIdToken();

      // 3. Call the new API endpoint
      const response = await fetch('/api/settleMatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Firebase-AppCheck': appCheckToken.token,
        },
        body: JSON.stringify({
          matchId: matchToSettle.id,
          winnerUsername: winnerUsername,
          kills: winnerKills,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setModalMessage(data.message);
        // Remove the match from the local list
        setMatches(prev => prev.filter(m => m.id !== matchToSettle.id));
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


  if (loading || !profile)
    return <div className="center-screen">Loading Dashboard...</div>;

  // Pass all state and functions to the UI component
  return (
    <DashboardUI
      profile={profile}
      loading={loading}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      topupAmount={topupAmount}
      setTopupAmount={setTopupAmount}
      requests={requests}
      selectedAmount={selectedAmount}
      setSelectedAmount={setSelectedAmount}
      matches={matches}
      loadingMatches={loadingMatches}
      newMatch={newMatch}
      isPlaying={isPlaying}
      audioRef={audioRef}
      accountView={accountView}
      setAccountView={setAccountView}
      referralInput={referralInput}
      setReferralInput={setReferralInput}
      selectedMatch={selectedMatch}
      setSelectedMatch={setSelectedMatch}
      showUsernameModal={showUsernameModal}
      setShowUsernameModal={setShowUsernameModal}
      newUsername={newUsername}
      setNewUsername={setNewUsername}
      adLoading={adLoading}
      newDisplayName={newDisplayName}
      setNewDisplayName={setNewDisplayName}
      modalMessage={modalMessage}
      setModalMessage={setModalMessage}
      topupView={topupView}
      setTopupView={setTopupView}
      paymentUpiId={paymentUpiId}
      setPaymentUpiId={setPaymentUpiId}
      showSettleModal={showSettleModal}
      setShowSettleModal={setShowSettleModal}
      matchToSettle={matchToSettle}
      winnerUsername={winnerUsername}
      setWinnerUsername={setWinnerUsername}
      winnerKills={winnerKills}
      setWinnerKills={setWinnerKills}
      adminEmail={adminEmail}
      toggleMusic={toggleMusic}
      claimDaily={claimDaily}
      watchAd={watchAd}
      handleTopup={handleTopup}
      handleConfirmPayment={handleConfirmPayment}
      handleRedeemReward={handleRedeemReward}
      handleJoinMatch={handleJoinMatch}
      approveRequest={approveRequest}
      rejectRequest={rejectRequest}
      handleNewMatchChange={handleNewMatchChange}
      handleCreateMatch={handleCreateMatch}
      handleSetUsername={handleSetUsername}
      handleUpdateDisplayName={handleUpdateDisplayName}
      handlePasswordReset={handlePasswordReset}
      handleLogout={handleLogout}
      openSettleModal={openSettleModal}
      handleSettleMatch={handleSettleMatch}
      user={user}
      rewardOptions={rewardOptions}
    />
  );
}
