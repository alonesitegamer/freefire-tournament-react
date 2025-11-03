import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection, // NEW: For querying collections
  query, // NEW: For building queries
  where, // NEW: For filtering data
  getDocs, // NEW: For fetching multiple documents
  orderBy, // NEW: For sorting results
  limit, // NEW: For limiting results
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home"); 
  const navigate = useNavigate();
  const adminEmail = "esportsimperial50@gmail.com";

  // NEW: State for history data
  const [matchHistory, setMatchHistory] = useState([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Initial Profile Load Effect
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

  // NEW: History Fetch Effect (Runs only when activeTab is "account")
  useEffect(() => {
    if (activeTab !== "account") return;

    async function fetchHistory() {
      setHistoryLoading(true);
      setMatchHistory([]);
      setWithdrawalHistory([]); 

      try {
        // --- Fetch Match History ---
        const matchQuery = query(
          collection(db, "match_history"), // Collection name assumption
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(10) // Get last 10
        );
        const matchSnap = await getDocs(matchQuery);
        const matches = matchSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMatchHistory(matches);

        // --- Fetch Withdrawal History ---
        const withdrawalQuery = query(
          collection(db, "withdrawals"), // Collection name assumption
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(10) // Get last 10
        );
        const withdrawalSnap = await getDocs(withdrawalQuery);
        const withdrawals = withdrawalSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setWithdrawalHistory(withdrawals);
      } catch (err) {
        console.error("Failed to fetch history:", err);
        alert("Could not load history.");
      } finally {
        setHistoryLoading(false);
      }
    }

    fetchHistory();
  }, [activeTab, user.uid]); // Dependency array ensures it only runs on tab change

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
              onClick={() => alert("Admin: coming soon")}
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
                          alert("Join flow will be implemented soon")
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

        {/* NEW/UPDATED: Account Tab with History */}
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

            {/* --- NEW HISTORY SECTIONS START --- */}
            <hr style={{ borderColor: "#444", margin: "20px 0" }} />

            {/* Match History */}
            <div className="history-section" style={{ marginTop: "20px" }}>
              <h4>Match History</h4>
              {historyLoading ? (
                <p>Loading match history...</p>
              ) : matchHistory.length === 0 ? (
                <p>No matches played yet.</p>
              ) : (
                <ul className="history-list">
                  {matchHistory.map((match) => (
                    <li key={match.id} className="history-item">
                      <span>{match.matchName || "Unnamed Match"}</span>
                      {/* Using your --accent color for results */}
                      <span style={{ color: "var(--accent)" }}>
                        {match.result || "N/A"}
                      </span>
                      <span className="muted-small">
                        {match.createdAt?.toDate().toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Withdrawal History */}
            <div className="history-section" style={{ marginTop: "20px" }}>
              <h4>Withdrawal History</h4>
              {historyLoading ? (
                <p>Loading withdrawal history...</p>
              ) : withdrawalHistory.length === 0 ? (
                <p>No withdrawals made yet.</p>
              ) : (
                <ul className="history-list">
                  {withdrawalHistory.map((wd) => (
                    <li key={wd.id} className="history-item">
                      <span>{wd.amount || 0} Coins</span>
                      {/* Using your --accent2 color for status */}
                      <span style={{ color: "var(--accent2)" }}>
                        {wd.status || "Pending"}
                      </span>
                      <span className="muted-small">
                        {wd.createdAt?.toDate().toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* --- NEW HISTORY SECTIONS END --- */}
          </section>
        )}
      </main>

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
          className={`nav-btn ${activeTab === "account" ? "active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          Account
        </button>
      </footer>
    </div>
  );
}
