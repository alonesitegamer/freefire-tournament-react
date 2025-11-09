import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMatchHistory } from '../utils/firestore'; // ✅ fixed import name
import { auth } from '../firebase';

export default function MatchHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadHistory = async () => {
      setLoading(true);
      try {
        // ✅ updated function name
        const data = await getMatchHistory(user.uid);
        setHistory(data);
      } catch (error) {
        console.error("Error loading match history:", error);
        alert("Failed to load match history.");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [user, navigate]);

  return (
    <div className="dash-root">
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />
      
      {/* Simple Header with Back Button */}
      <header className="dash-header" style={{ justifyContent: 'flex-start' }}>
        <button className="btn small ghost" onClick={() => navigate(-1)} style={{ marginRight: '15px' }}>
          &lt; Back
        </button>
        <div className="logo-row">
          <div className="title">Match History</div>
        </div>
      </header>

      <main className="dash-main">
        <section className="panel">
          <h3>Your Tournament Records</h3>
          {loading ? (
            <p>Loading records...</p>
          ) : history.length === 0 ? (
            <p>No matches played yet. Go join a tournament!</p>
          ) : (
            <ul className="history-list full-list">
              {history.map((match) => (
                <li key={match.id} className="history-item">
                  <span>{match.matchName || `Match ID: ${match.id.substring(0, 5)}...`}</span>
                  <span style={{ color: "var(--accent)" }}>
                    {match.result || "N/A"}
                  </span>
                  <span className="muted-small">
                    {match.createdAt?.toDate().toLocaleString()}
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
