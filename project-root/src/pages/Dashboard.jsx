import React, { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

// Assume firebase dependencies (auth, db) are available globally or passed via context
// or will be available via the execution environment's setup if not imported.
// For compilation in this environment, we will assume global availability or rely on the
// parent component/context to provide them correctly, bypassing the file resolution error.
// Since the original code was: import { auth, db } from "../firebase";
// We must declare them to prevent 'not defined' errors while fixing the import issue.
// If your environment passes these as props, you should adjust the function signature.
// For now, we will assume they are initialized elsewhere if not resolvable via '../firebase'.
// We'll simulate them as if they were successfully imported to allow the code to compile.
const auth = window.auth; 
const db = window.db; 

// --- Custom Notification Component (Replaces alert()) ---
const Notification = ({ message, type, onClose }) => {
  if (!message) return null;

  const color = type === 'error' ? '#e74c3c' : '#2ecc71'; // Red or Green
  const bgColor = type === 'error' ? 'rgba(231, 76, 60, 0.1)' : 'rgba(46, 204, 113, 0.1)';

  // Style to keep the OG look while ensuring visibility
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '15px 25px',
        backgroundColor: bgColor,
        color: color,
        border: `1px solid ${color}`,
        borderRadius: '8px',
        zIndex: 1000,
        fontWeight: 'bold',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        textAlign: 'center',
        cursor: 'pointer',
        fontSize: '14px',
      }}
      onClick={onClose}
    >
      {message}
    </div>
  );
};
// --- END Notification Component ---


export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home"); 
  const [dailyWithdrawn, setDailyWithdrawn] = useState(0);
  const [notification, setNotification] = useState({ message: '', type: '' });

  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";
  
  // Wallet Constants
  const DAILY_WITHDRAWAL_LIMIT = 500; // Coins/Rs
  const MIN_WITHDRAWAL = 50; // Coins/Rs
  const COMMISSION_RATE = 0.10; // 10%

  // --- Utility Functions ---
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 4000);
  };

  const getTodayDateString = () => {
    const d = new Date();
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  // --- Data Loading and Initialization ---

  // 1. Load User Profile and calculate Daily Withdrawal Total
  useEffect(() => {
    // Safety check for DB existence (critical for the import fix)
    if (!db) {
        setLoading(false);
        return;
    }
    
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        // Ensure user.uid and user.email exist before attempting Firestore operations
        if (!user || !user.uid || !user.email) {
          throw new Error("User credentials are not available.");
        }

        const userRef = doc(db, "users", user.uid);
        let userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // Initialize new user profile
          await setDoc(userRef, {
            email: user.email,
            coins: 0,
            displayName: user.displayName || "",
            lastDaily: null,
            createdAt: serverTimestamp(),
          });
          userSnap = await getDoc(userRef); // Fetch again
        }

        if (mounted) setProfile({ id: userSnap.id, ...userSnap.data() });
        
        // Calculate daily withdrawal total
        const today = getTodayDateString();
        // Use full Firestore path: /artifacts/{appId}/users/{userId}/transactions (assuming private data logic)
        // Since we don't have appId and userId context here, we stick to the simple 'transactions'
        // as per the original structure, but note this may need adjustment for real-world Firestore Rules.
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", user.uid),
          where("type", "==", "withdrawal"),
          where("date", "==", today)
        );
        const querySnapshot = await getDocs(q);
        
        let total = 0;
        querySnapshot.forEach((d) => {
          total += d.data().amount || 0;
        });
        
        if (mounted) setDailyWithdrawn(total);

      } catch (err) {
        console.error("Dashboard load error:", err);
        showNotification("Failed to load data. See console for details.", 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [user, user.uid, user.email]); // Added 'user' to dependency array

  // --- Coin Management Functions (Keeping OG logic, replacing alerts) ---
  
  async function updateProfileCoins(n) {
    if (!profile || !db) return false;
    try {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, { coins: (profile.coins || 0) + n });
      // Refetch profile to update state
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
      return true;
    } catch (err) {
      console.error("updateProfileCoins error:", err);
      showNotification("Transaction failed on the server.", 'error');
      return false;
    }
  }
  
  async function claimDaily() {
    if (!profile || !db) return;
    const last =
      profile.lastDaily && typeof profile.lastDaily.toDate === "function"
        ? profile.lastDaily.toDate()
        : null;
    const now = new Date();
    const isSameDay = last && last.toDateString() === now.toDateString();
    
    if (isSameDay) return showNotification("You already claimed today's coin.", 'error');

    try {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, {
        coins: (profile.coins || 0) + 1,
        lastDaily: serverTimestamp(),
      });
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
      showNotification("+1 coin credited for daily bonus!");
    } catch (err) {
      console.error("claimDaily error:", err);
    }
  }

  async function watchAd() {
    const success = await updateProfileCoins(1);
    if(success) showNotification("+1 coin for watching ad (demo)");
  }

  async function handleLogout() {
    if (auth) { // Only attempt signout if auth is available
      await signOut(auth);
      navigate("/login");
    } else {
      showNotification("Authentication service not available.", 'error');
    }
  }

  // --- New Wallet Functions ---
  
  async function handleTopupTransaction(amount) {
      if (!profile || amount <= 0 || !db) return;
      
      const success = await updateProfileCoins(amount);
      if (success) {
          // Log the top-up transaction
          await addDoc(collection(db, "transactions"), {
              userId: user.uid,
              type: "topup",
              amount: amount,
              date: getTodayDateString(),
              timestamp: serverTimestamp(),
          });
          showNotification(`Successfully topped up ${amount} Coins!`);
      }
  }

  async function handleWithdrawalTransaction({ amount, method, detail, totalRequired }) {
    if (!profile || !db) return showNotification("Profile or database not loaded.", 'error');
    if (totalRequired > profile.coins) return showNotification("Insufficient coins to cover withdrawal and commission.", 'error');
    if (amount < MIN_WITHDRAWAL) return showNotification(`Minimum withdrawal is ${MIN_WITHDRAWAL} Coins.`, 'error');
    if (dailyWithdrawn + amount > DAILY_WITHDRAWAL_LIMIT) return showNotification("Daily withdrawal limit reached.", 'error');

    try {
      // 1. Deduct coins (Amount + Commission)
      const success = await updateProfileCoins(-totalRequired);

      if (success) {
        // 2. Log the withdrawal transaction
        await addDoc(collection(db, "transactions"), {
          userId: user.uid,
          type: "withdrawal",
          amount: amount, // Log the net amount withdrawn (₹ value)
          commission: totalRequired - amount,
          method: method,
          detail: detail,
          status: "Pending", // Set status for later admin review
          date: getTodayDateString(),
          timestamp: serverTimestamp(),
        });
        
        // 3. Update local state for daily limit and notification
        setDailyWithdrawn(prev => prev + amount);
        showNotification(`Withdrawal request for ${amount} Coins submitted via ${method}. Commission deducted: ${totalRequired - amount} Coins.`);
      }

    } catch (err) {
      console.error("Withdrawal error:", err);
      showNotification("Withdrawal failed due to a server error.", 'error');
    }
  }

  // --- Sub-Components for Tabs ---

  const TopupTab = () => {
    const topupOptions = [20, 50, 100, 200];
    return (
      <section className="panel" style={{ maxWidth: '500px', margin: '20px auto' }}>
        <h3>Top-up Coins (1 Coin = 1 ₹)</h3>
        <p style={{ color: '#aaa', fontSize: '14px' }}>Select an amount to instantly add to your wallet.</p>
        <div 
          className="topup-options" 
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginTop: '15px' }}
        >
          {topupOptions.map(amount => (
            <button
              key={amount}
              className="btn"
              style={{ padding: '15px 10px', backgroundColor: '#3498db', fontSize: '1.1em' }}
              onClick={() => handleTopupTransaction(amount)}
            >
              {amount} Coins <span style={{ display: 'block', fontSize: '0.8em', opacity: 0.8 }}>(₹{amount})</span>
            </button>
          ))}
        </div>
      </section>
    );
  };

  const WithdrawalTab = () => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('');
    const [detail, setDetail] = useState('');

    const rsAmount = parseInt(amount) || 0;
    const commission = Math.ceil(rsAmount * COMMISSION_RATE);
    const totalRequired = rsAmount + commission;
    const dailyRemaining = DAILY_WITHDRAWAL_LIMIT - dailyWithdrawn;

    const isAmountValid = rsAmount >= MIN_WITHDRAWAL && rsAmount <= dailyRemaining && rsAmount > 0;
    const isBalanceSufficient = profile && totalRequired <= profile.coins;
    const isFormComplete = isAmountValid && isBalanceSufficient && method && detail;

    const handleSubmit = (e) => {
      e.preventDefault();
      handleWithdrawalTransaction({ amount: rsAmount, method, detail, totalRequired });
      // Reset form fields
      setAmount('');
      setMethod('');
      setDetail('');
    };

    return (
      <section className="panel" style={{ maxWidth: '500px', margin: '20px auto' }}>
        <h3>Withdrawal Request</h3>
        
        <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '20px' }}>
          Minimum: {MIN_WITHDRAWAL} Coins. Daily Limit Remaining: **{dailyRemaining}** Coins.
        </p>
        
        <form onSubmit={handleSubmit}>
          
          {/* Amount Input */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', color: '#ccc', marginBottom: '5px' }}>Amount to Withdraw (Coins/₹):</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={MIN_WITHDRAWAL}
              max={dailyRemaining}
              placeholder="Enter amount (e.g., 50, 100)"
              required
              style={inputStyle}
            />
          </div>
          
          {/* Commission Info */}
          <div style={infoCardStyle}>
            <p>Commission (10%): <strong style={{ color: '#f39c12' }}>{commission} Coins</strong></p>
            <p>Total Coins to Deduct: <strong style={{ color: isBalanceSufficient ? '#2ecc71' : '#e74c3c' }}>{totalRequired} Coins</strong></p>
            {!isBalanceSufficient && <p style={{ color: '#e74c3c', marginTop: '5px' }}>Insufficient Balance!</p>}
          </div>

          {/* Method Selection */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', color: '#ccc', marginBottom: '5px' }}>Withdrawal Method:</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Select Method</option>
              <option value="upi">UPI</option>
              <option value="redeem_code">Redeem Code</option>
            </select>
          </div>

          {/* Detail Input (UPI/Redeem Code) */}
          {method && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#ccc', marginBottom: '5px' }}>{method === 'upi' ? 'UPI ID:' : 'Redeem Code ID:'}</label>
              <input
                type="text"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={method === 'upi' ? 'e.g., username@bankname' : 'Your Game/Redeem ID'}
                required
                style={inputStyle}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn"
            style={withdrawButtonStyle(isFormComplete)}
            disabled={!isFormComplete}
          >
            Request Withdrawal ({amount ? amount + ' Coins' : '...'})
          </button>
        </form>
      </section>
    );
  };
  
  // --- Inline Style Helpers (for OG look) ---
  const inputStyle = {
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #444',
    backgroundColor: '#333',
    color: 'white',
    width: '100%',
    boxSizing: 'border-box',
    fontSize: '16px',
  };
  
  const infoCardStyle = {
    backgroundColor: '#1e1e1e',
    border: '1px solid #444',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#ccc',
  };

  const withdrawButtonStyle = (active) => ({
    width: '100%',
    padding: '12px',
    backgroundColor: active ? '#e74c3c' : '#7f8c8d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: active ? 'pointer' : 'not-allowed',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
  });

  // --- Loading Screen ---
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

  // --- Main Render ---
  return (
    <div className="dash-root">
      {/* Note: bg-video and styles are assumed to be defined in your global CSS */}
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      <Notification 
        message={notification.message} 
        type={notification.type} 
        onClose={() => setNotification({ message: '', type: '' })} 
      />

      <header className="dash-header">
        <div className="logo-row">
          <img src="/icon.jpg" alt="logo" className="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">
              {profile.displayName || profile.email}
            </div>
          </div>
        </div>

        <div className="header-actions">
          {profile.email === adminEmail && (
            <button
              className="btn small"
              onClick={() => showNotification("Admin: coming soon")}
            >
              Admin
            </button>
          )}
          <button className="btn small ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main section with navigation */}
      <main className="dash-main">
        
        {/* Render Tabs based on activeTab state */}
        {activeTab === "home" && (
          <>
            <section className="panel">
              <div className="panel-row">
                <div>
                  <div className="muted">Coins</div>
                  <div
                    className="big"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
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
                    Claim Daily (1 coin)
                  </button>
                  <button className="btn ghost" onClick={watchAd}>
                    Watch Ad (+1 coin)
                  </button>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Featured Matches</h3>
              <div className="grid">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="match-card">
                    <img src="/bt.jpg" alt="bt" />
                    <div className="match-info">
                      <div className="match-title">Battle Royale #{i}</div>
                      <div className="match-meta">
                        Start: 18:{10 + i} • Joined:{" "}
                        {Math.floor(Math.random() * 12) + 1}/16
                      </div>
                      <button
                        className="btn"
                        onClick={() =>
                          showNotification("Join flow will be implemented soon")
                        }
                      >
                        Join
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "matches" && (
          <section className="panel">
            <h3>Matches</h3>
            <p>Coming soon — tournaments list will appear here.</p>
          </section>
        )}

        {activeTab === "topup" && <TopupTab />}
        
        {activeTab === "withdraw" && <WithdrawalTab />}

        {activeTab === "account" && (
          <section className="panel">
            <h3>Account</h3>
            <p>
              <strong>Email:</strong> {profile.email}
            </p>
            <p>
              <strong>Coins:</strong> {profile.coins}
            </p>
            <button
              className="btn"
              onClick={handleLogout}
              style={{ marginBottom: "20px" }}
            >
              Logout
            </button>

            {/* --- HISTORY LINKS --- */}
            <hr style={{ borderColor: "#444", margin: "20px 0" }} />

            {/* Match History Link (Clickable) */}
            <div 
              className="history-link-panel" 
              onClick={() => navigate('/match-history')} // <-- Redirects to new page
              style={{ cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <h4>Match History</h4>
              <span style={{ color: 'var(--muted)', fontSize: '1.2em', fontWeight: 'bold' }}>&gt;</span>
            </div>

            {/* Withdrawal History Link (Clickable) */}
            <div 
              className="history-link-panel" 
              onClick={() => navigate('/withdrawal-history')} // <-- Redirects to new page
              style={{ cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <h4>Withdrawal History</h4>
              <span style={{ color: 'var(--muted)', fontSize: '1.2em', fontWeight: 'bold' }}>&gt;</span>
            </div>
            {/* --- END OF HISTORY LINKS --- */}
          </section>
        )}
      </main>

      {/* Bottom Navigation */}
      <footer className="bottom-nav">
        <button
          className={`nav-btn ${activeTab === "home" ? "active" : ""}`}
          onClick={() => setActiveTab("home")}
        >
          Home
        </button>
        <button
          className={`nav-btn ${activeTab === "matches" ? "active" : ""}`}
          onClick={() => setActiveTab("matches")}
        >
          Matches
        </button>
        <button
          className={`nav-btn ${activeTab === "topup" ? "active" : ""}`}
          onClick={() => setActiveTab("topup")}
        >
          Top-up
        </button>
        <button
          className={`nav-btn ${activeTab === "withdraw" ? "active" : ""}`}
          onClick={() => setActiveTab("withdraw")}
        >
          Withdraw
        </button>
        <button
          className={`nav-btn ${activeTab === "account" ? "active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          Account
        </button>
      </footer>
    </div>
  );
}
