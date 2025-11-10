import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWithdrawHistory } from "../utils/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

export default function WithdrawalHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Wait until Firebase auth is ready
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }

      setLoading(true);
      try {
        const data = await getWithdrawHistory(user.uid);
        setHistory(data);
      } catch (error) {
        console.error("Error loading withdrawal history:", error);
        alert("Failed to load withdrawal history.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="dash-root">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      {/* Simple Header with Back Button */}
      <header className="dash-header" style={{ justifyContent: "flex-start" }}>
        <button
          className="btn small ghost"
          onClick={() => navigate(-1)}
          style={{ marginRight: "15px" }}
        >
          &lt; Back
        </button>
        <div className="logo-row">
          <div className="title">Withdrawal History</div>
        </div>
      </header>

      <main className="dash-main">
        <section className="panel">
          <h3>Your Withdrawal Records</h3>

          {loading ? (
            <p>Loading records...</p>
          ) : history.length === 0 ? (
            <p>You haven't requested any withdrawals yet.</p>
          ) : (
            <ul className="history-list full-list">
              {history.map((wd) => (
                <li key={wd.id} className="history-item">
                  <span>{wd.amount || 0} ₹</span>
                  <span style={{ color: "var(--accent2)" }}>
                    {wd.status || "Pending"}
                  </span>
                  <span className="muted-small">
                    {wd.createdAt?.toDate
                      ? wd.createdAt.toDate().toLocaleString()
                      : "Date not available"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
