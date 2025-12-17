// src/components/MatchDetails.jsx
import React, { useState, useEffect, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./MatchDetails.css";

export default function MatchDetails({
  match: initialMatch,
  onBack,
  user,
  profile,
  updateProfileField,
  joinMatch,           // <-- joinMatch is now received from Dashboard
}) {
  const [match, setMatch] = useState(initialMatch);
  const [joined, setJoined] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Sync updated match
  useEffect(() => setMatch(initialMatch), [initialMatch]);

  // Detect joined
  useEffect(() => {
    const isJoined =
      match?.playersJoined?.some((p) => p.uid === user.uid) || false;
    setJoined(isJoined);
  }, [match, user.uid]);

  // Auto refresh time
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  // Load latest match data
  async function refreshMatch() {
    const ref = doc(db, "matches", match.id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setMatch({ id: snap.id, ...snap.data() });
    }
  }

  // Central Join Handler — forwarded to Dashboard's joinMatch
  async function handleJoin() {
    if (!joinMatch) {
      alert("Join system missing.");
      return;
    }

    const success = await joinMatch(match);
    if (success) {
      await refreshMatch();
      setJoined(true);
    }
  }

  // Reveal timing
  const revealAt =
    match.revealAt?.seconds
      ? match.revealAt.toDate().getTime()
      : match.revealAt
      ? new Date(match.revealAt).getTime()
      : null;

  const canReveal = joined && revealAt && now >= revealAt;

  // Auto-rotate map
  const displayMap = useMemo(() => {
    const pool = match.mapPool?.length
      ? match.mapPool
      : ["Bermuda", "Purgatory", "Kalahari"];

    if (!match.autoRotate) return match.map || pool[0];

    const created = match.createdAt?.seconds
      ? match.createdAt.toDate().getTime()
      : Date.now();

    const minutes = Math.floor((now - created) / 60000);
    return pool[minutes % pool.length];
  }, [match, now]);

  function copy(text) {
    navigator.clipboard.writeText(text);
    alert("Copied!");
  }

  return (
    <section className="panel match-details-view premium-style">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div className="match-header-premium">
        <h2>{match.title}</h2>

        <div className="mini-meta">
          {match.mode} • Entry {match.entryFee} •{" "}
          {match.playersJoined?.length}/{match.maxPlayers}
        </div>

        {!joined && (
          <button className="join-premium-btn" onClick={handleJoin}>
            Join Match
          </button>
        )}

        {joined && (
          <button className="join-premium-btn joined" disabled>
            Joined ✓
          </button>
        )}
      </div>

      <img
        className="match-big-banner"
        src={match.imageUrls?.[0] || "/bt.jpg"}
        alt="Match Banner"
      />

      {/* ================================
          LOCKED (Not Joined)
      ================================= */}
      {!joined && (
        <div className="locked-overlay">
          <div className="locked-content">
            <h3>Join to Unlock Details</h3>
            <p>
              Room ID, Password & Rules become visible only after joining.
            </p>
            <button className="join-small-btn" onClick={handleJoin}>
              Join Now
            </button>
          </div>
        </div>
      )}

      {/* ================================
          UNLOCKED (Joined)
      ================================= */}
      {joined && (
        <div className="details-container">
          <h3 className="section-title">Room Details</h3>

          {!canReveal && (
            <p className="muted">
              Room will be revealed a few minutes before match.
            </p>
          )}

          {canReveal && (
            <>
              <div className="detail-row">
                <strong>Room ID:</strong> {match.roomID || "TBD"}
                <button className="copy-btn" onClick={() => copy(match.roomID)}>
                  Copy
                </button>
              </div>

              <div className="detail-row">
                <strong>Password:</strong> {match.roomPassword || "—"}
                <button
                  className="copy-btn"
                  onClick={() => copy(match.roomPassword)}
                >
                  Copy
                </button>
              </div>
            </>
          )}

          <div className="detail-row">
            <strong>Map:</strong> {displayMap}
          </div>

          <div className="detail-row">
            <strong>Mode:</strong> {match.mode}
          </div>

          <h3 className="section-title" style={{ marginTop: 20 }}>
            Rules
          </h3>

          <p className="rules-text">
            1 Kill = {match.killReward || 75} coins. <br />
            No teaming, hacking, exploiting or emulator unless stated. <br />
            Room details are private — do NOT share. <br />
            Admin decisions are final.
          </p>
        </div>
      )}
    </section>
  );
}
