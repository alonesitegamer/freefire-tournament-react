// src/components/MatchDetails.jsx
import React, { useState, useEffect, useMemo } from "react";
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "./styles/matchdetails.css";

export default function MatchDetails({ match: initialMatch, onBack, user, profile, updateProfileField }) {
  const [match, setMatch] = useState(initialMatch);
  const [joined, setJoined] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => setMatch(initialMatch), [initialMatch]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const isJoined =
      match?.playersJoined?.some((p) => p.uid === user.uid) || false;
    setJoined(isJoined);
  }, [match, user.uid]);

  async function refreshMatch() {
    const ref = doc(db, "matches", match.id);
    const snap = await getDoc(ref);
    if (snap.exists()) setMatch({ id: snap.id, ...snap.data() });
  }

  async function handleJoin() {
    if (joined) return alert("Already joined!");

    let name = profile.username || profile.displayName || "";

    if (!name) {
      name = prompt("Enter your in-game name:");
      if (!name) return alert("Username required!");
      await updateProfileField({ username: name });
    }

    setLoadingJoin(true);
    try {
      await updateDoc(doc(db, "matches", match.id), {
        playersJoined: arrayUnion({
          uid: user.uid,
          username: name,
          joinedAt: serverTimestamp(),
        }),
      });

      await refreshMatch();
      alert("Joined!");
      setJoined(true);
    } catch (e) {
      console.error("joinMatch error", e);
      alert("Failed to join match.");
    }
    setLoadingJoin(false);
  }

  // reveal logic
  const revealAt = match.revealAt?.seconds
    ? match.revealAt.toDate().getTime()
    : match.revealAt
    ? new Date(match.revealAt).getTime()
    : null;

  const canReveal = joined && revealAt && now >= revealAt;

  // auto-rotate
  const displayMap = useMemo(() => {
    const pool = match.mapPool?.length ? match.mapPool : ["Bermuda", "Purgatory", "Kalahari"];
    if (!match.autoRotate) return match.map || pool[0];
    const created = match.createdAt?.seconds
      ? match.createdAt.toDate().getTime()
      : Date.now();
    const min = Math.floor((now - created) / (1000 * 60));
    return pool[min % pool.length];
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
          {match.mode} • Entry {match.entryFee} • {match.playersJoined?.length}/{match.maxPlayers}
        </div>

        <button
          className={`join-premium-btn ${joined ? "joined" : ""}`}
          onClick={handleJoin}
          disabled={loadingJoin || joined}
        >
          {joined ? "Joined ✓" : loadingJoin ? "Joining..." : "Join Match"}
        </button>
      </div>

      <img
        className="match-big-banner"
        src={match.imageUrl || "/bt.jpg"}
        alt="Match"
      />

      {/* 🔐 LOCKED VIEW */}
      {!joined && (
        <div className="locked-overlay">
          <div className="locked-content">
            <h3>Join to Unlock Details</h3>
            <p>Room ID, Password, Rules & Map become visible only after joining.</p>
            <button className="join-small-btn" onClick={handleJoin}>
              Join Now
            </button>
          </div>
        </div>
      )}

      {/* 🔓 REVEALED VIEW */}
      {joined && (
        <div className="details-container">
          <h3 className="section-title">Room Details</h3>

          {!canReveal ? (
            <p className="muted">Room will be revealed shortly before match.</p>
          ) : (
            <>
              <div className="detail-row">
                <strong>Room ID:</strong> {match.roomID || "TBD"}
                <button className="copy-btn" onClick={() => copy(match.roomID)}>Copy</button>
              </div>

              <div className="detail-row">
                <strong>Password:</strong> {match.roomPassword || "—"}
                <button className="copy-btn" onClick={() => copy(match.roomPassword)}>Copy</button>
              </div>
            </>
          )}

          <div className="detail-row">
            <strong>Map:</strong> {displayMap}
          </div>

          <div className="detail-row">
            <strong>Mode:</strong> {match.mode}
          </div>

          <h3 className="section-title" style={{ marginTop: 20 }}>Rules</h3>
          <p className="rules-text">
            1 Kill = {match.type === "custom" ? match.killReward : 75} coins.{"\n"}
            No teaming, hacking, exploiting or emulator unless stated.{"\n"}
            Admin decisions are final.{"\n"}
            Room ID is private — do not share.
          </p>
        </div>
      )}
    </section>
  );
}
