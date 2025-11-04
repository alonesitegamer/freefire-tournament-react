import React, { useEffect, useState } from "react";
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
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [topupAmount, setTopupAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [requests, setRequests] = useState({ topup: [], withdraw: [] });
  const navigate = useNavigate();

  const adminEmail = "esportsimperial50@gmail.com";
  const adminPassword = "imperialx"; // for manual admin login

  // ------------------------------
  // Load user profile
  // ------------------------------
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

  // ------------------------------
  // Add coins
  // ------------------------------
  async function addCoin(n = 1) {
    if (!profile) return;
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, { coins: (profile.coins || 0) + n });
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
  }

  // ------------------------------
  // Claim daily
  // ------------------------------
  async function claimDaily() {
    if (!profile) return;
    const last =
      profile.lastDaily && typeof profile.lastDaily.toDate === "function"
        ? profile.lastDaily.toDate()
        : null;
    const now = new Date();
    const isSameDay = last && last.toDateString() === now.toDateString();
    if (isSameDay) return alert("You already claimed today's coin.");

    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, {
      coins: (profile.coins || 0) + 1,
      lastDaily: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    setProfile({ id: snap.id, ...snap.data() });
    alert("+1 coin credited!");
  }

  // ------------------------------
  // Watch Ad
  // ------------------------------
  async function watchAd() {
    await addCoin(1);
    alert("+1 coin for watching ad (demo)");
  }

  // ------------------------------
  // Top-up request
  // ------------------------------
  async function handleTopup() {
    const amt = parseInt(topupAmount);
    if (!amt || amt < 20) return alert("Minimum top-up is ₹20.");
    try {
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: amt,
        coins: amt,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      alert("Top-up request submitted! Admin will verify it soon.");
      setTopupAmount("");
    } catch (err) {
      console.error("Top-up error:", err);
    }
  }

  // ------------------------------
  // Withdraw request (10% commission)
  // ------------------------------
  async function handleWithdraw() {
    const amt = parseInt(withdrawAmount);
    if (!amt || amt < 50) return alert("Minimum withdrawal is ₹50.");
    if (!upiId) return alert("Please enter your UPI ID.");

    const totalCoins = Math.ceil(amt * 1.1);
    if (profile.coins < totalCoins)
      return alert(`You need ${totalCoins} coins to withdraw ₹${amt} (10% fee).`);

    try {
      await addDoc(collection(db, "withdrawRequests"), {
        userId: user.uid,
        email: profile.email,
        upiId,
        amount: amt,
        coinsDeducted: totalCoins,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "users", user.uid), {
        coins: profile.coins - totalCoins,
      });

      alert(`Withdrawal request submitted! ₹${amt} (-${totalCoins} coins inc. 10%).`);
      setWithdrawAmount("");
      setUpiId("");
      const snap = await getDoc(doc(db, "users", user.uid));
      setProfile({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error("Withdraw error:", err);
    }
  }

  // ------------------------------
  // Admin Data
  // ------------------------------
  useEffect(() => {
    if (profile?.email !== adminEmail) return;
    (async () => {
      const topupSnap = await getDocs(collection(db, "topupRequests"));
      const withdrawSnap = await getDocs(collection(db, "withdrawRequests"));
      setRequests({
        topup: topupSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        withdraw: withdrawSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
    })();
  }, [profile?.email]);

  async function approveRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "approved" });
    if (type === "topup") {
      await updateDoc(doc(db, "users", req.userId), {
        coins: (profile.coins || 0) + req.coins,
      });
    }
    alert(`${type} approved.`);
  }

  async function rejectRequest(type, req) {
    const ref = doc(db, `${type}Requests`, req.id);
    await updateDoc(ref, { status: "rejected" });
    alert(`${type} rejected.`);
  }

  // ------------------------------
  // Logout
  // ------------------------------
  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  if (loading || !profile)
    return <div className="center-screen">Loading Dashboard...</div>;

  return (
    <div className="dash-root">
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
          {profile.email === adminEmail && (
            <button className="btn small" onClick={() => setActiveTab("admin")}>
              Admin Panel
            </button>
          )}
          <button className="btn small ghost" onClick={handleLogout}>
            Logout
          </button>
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
              <h3>Featured Matches</h3>
              <div className="grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="match-card">
                    <img src="/bt.jpg" alt="bt" />
                    <div className="match-info">
                      <div className="match-title">Battle Royale #{i}</div>
                      <button className="btn">Join</button>
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
            <p>Coming soon — tournament list will appear here.</p>
          </section>
        )}

        {activeTab === "account" && (
          <section className="panel">
            <h3>Account</h3>
            <p><strong>Email:</strong> {profile.email}</p>
            <p><strong>Coins:</strong> {profile.coins}</p>
            <button className="btn" onClick={handleLogout}>
              Logout
            </button>
          </section>
        )}

        {/* --- Modern Top-up Section --- */}
        {activeTab === "topup" && (
          <section className="panel modern-card">
            <h3 className="modern-title">💰 Top-up Coins</h3>
            <p className="modern-subtitle">Select a package — 1 ₹ = 1 Coin</p>

            <div className="amount-options">
              {[20, 50, 100, 200].map((amt) => (
                <button
                  key={amt}
                  className={`amount-btn ${topupAmount == amt ? "selected" : ""}`}
                  onClick={() => setTopupAmount(amt)}
                >
                  ₹{amt} = {amt} Coins
                </button>
              ))}
            </div>

            <button className="btn large glow" onClick={handleTopup}>
              🚀 Submit Top-up Request
            </button>
          </section>
        )}

        {/* --- Modern Withdraw Section --- */}
        {activeTab === "withdraw" && (
          <section className="panel modern-card">
            <h3 className="modern-title">🏦 Withdraw Coins</h3>
            <p className="modern-subtitle">10% Commission | Min ₹50</p>

            <div className="withdraw-form">
              <input
                type="number"
                placeholder="Enter withdrawal amount ₹"
                className="modern-input"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <input
                type="text"
                placeholder="Enter your UPI ID (example@upi)"
                className="modern-input"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
              <button className="btn large glow" onClick={handleWithdraw}>
                💸 Request Withdrawal
              </button>
            </div>
          </section>
        )}

        {/* --- Admin Section --- */}
        {activeTab === "admin" && profile.email === adminEmail && (
          <section className="panel">
            <h3>Admin Panel</h3>
            <h4>Top-up Requests</h4>
            {requests.topup.map((r) => (
              <div key={r.id} className="admin-row">
                <span>{r.email} | ₹{r.amount}</span>
                <div>
                  <button className="btn small" onClick={() => approveRequest("topup", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("topup", r)}>Reject</button>
                </div>
              </div>
            ))}
            <h4>Withdraw Requests</h4>
            {requests.withdraw.map((r) => (
              <div key={r.id} className="admin-row">
                <span>{r.email} | ₹{r.amount} | UPI: {r.upiId}</span>
                <div>
                  <button className="btn small" onClick={() => approveRequest("withdraw", r)}>Approve</button>
                  <button className="btn small ghost" onClick={() => rejectRequest("withdraw", r)}>Reject</button>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="bottom-nav">
        {["home", "matches", "topup", "withdraw", "account"].map((tab) => (
          <button
            key={tab}
            className={`nav-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>
    </div>
  );
}
