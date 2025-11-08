import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const navigate = useNavigate();

  const adminEmail = "esportsimperial50@gmail.com";

  // Load user profile
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
          await setDoc(ref, {
            email: user.email,
            coins: 0,
            displayName: user.displayName || "",
            lastDaily: null,
            createdAt: serverTimestamp(),
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

  // Add coins utility
  async function addCoin(n = 1) {
    if (!profile) return;
    try {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, { coins: (profile.coins || 0) + n });
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error("addCoin error:", err);
      alert("Failed to add coin.");
    }
  }

  // Daily reward
  async function claimDaily() {
    if (!profile) return;
    const last =
      profile.lastDaily && typeof profile.lastDaily.toDate === "function"
        ? profile.lastDaily.toDate()
        : null;
    const now = new Date();
    const isSameDay = last && last.toDateString() === now.toDateString();
    if (isSameDay) return alert("You already claimed today's coin.");

    try {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, {
        coins: (profile.coins || 0) + 1,
        lastDaily: serverTimestamp(),
      });
      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
      alert("+1 coin credited!");
    } catch (err) {
      console.error("claimDaily error:", err);
    }
  }

  async function watchAd() {
    await addCoin(1);
    alert("+1 coin for watching ad (demo)");
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  // Withdraw request (10% commission)
  async function handleWithdraw() {
    if (!withdrawAmount || !upiId) return alert("Enter amount and UPI ID.");
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0)
      return alert("Enter a valid withdrawal amount.");

    const coinsRequired = Math.ceil(amount * 1.1); // 10% commission
    if (profile.coins < coinsRequired)
      return alert(
        `You need ${coinsRequired} coins to withdraw ₹${amount} (10% fee included).`
      );

    try {
      // Deduct from user's balance
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, { coins: profile.coins - coinsRequired });

      // Create a new withdrawal document
      await addDoc(collection(db, "withdrawals"), {
        userId: user.uid,
        email: profile.email,
        upiId,
        amount,
        coinsUsed: coinsRequired,
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      const snap = await getDoc(ref);
      setProfile({ id: snap.id, ...snap.data() });
      setWithdrawAmount("");
      setUpiId("");
      alert("Withdrawal requested! Admin will send manually.");
    } catch (err) {
      console.error("Withdrawal error:", err);
      alert("Failed to request withdrawal.");
    }
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
            <div className="subtitle">
              {profile.displayName || profile.email}
            </div>
          </div>
        </div>

        <div className="header-actions">
          {profile.email === adminEmail && (
            <button
              className="btn small"
              onClick={() => navigate("/admin-dashboard")}
            >
              Admin
            </button>
          )}
          <button className="btn small ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="dash-main">
        {/* 🏠 HOME TAB */}
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
                {[1, 2, 3, 4].map((i) => (
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
                        onClick={() => alert("Join feature coming soon!")}
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

        {/* 💸 WITHDRAW TAB */}
        {activeTab === "withdraw" && (
          <section className="panel withdraw-card">
            <h3>Withdraw Coins</h3>
            <p className="muted-small">
              10% commission applies — ₹50 = 55 coins
            </p>
            <input
              type="number"
              placeholder="Enter amount (₹)"
              className="field"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="Enter UPI ID"
              className="field"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />
            <button className="btn glow" onClick={handleWithdraw}>
              Request Withdraw
            </button>
          </section>
        )}

        {/* ⚙️ ACCOUNT TAB */}
        {activeTab === "account" && (
          <section className="panel">
            <h3>Account</h3>
            <p>
              <strong>Email:</strong> {profile.email}
            </p>
            <p>
              <strong>Coins:</strong> {profile.coins}
            </p>
            <button className="btn" onClick={handleLogout}>
              Logout
            </button>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bottom-nav">
        <button
          className={`nav-btn ${activeTab === "home" ? "active" : ""}`}
          onClick={() => setActiveTab("home")}
        >
          Home
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
