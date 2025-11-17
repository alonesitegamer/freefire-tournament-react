// src/components/MatchDetails.jsx
import React, { useState, useEffect, useMemo } from "react";
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function MatchDetails({ match: initialMatch, onBack, user, profile, updateProfileField }) {
  const [match, setMatch] = useState(initialMatch);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [joined, setJoined] = useState(false);
  const [now, setNow] = useState(Date.now());

  // expose join function globally (for MatchList direct join)
  useEffect(() => {
    window.joinMatchDirect = () => {
      handleJoin();
    };
  });

  useEffect(() => {
    setMatch(initialMatch);
  }, [initialMatch]);

  useEffect(() => {
    const players = match?.playersJoined || [];
    setJoined(players.some((p) => p.uid === user.uid));
  }, [match, user.uid]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  async function refreshMatch() {
    try {
      const ref = doc(db, "matches", match.id);
      const snap = await getDoc(ref);
      if (snap.exists()) setMatch({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error("refreshMatch", err);
    }
  }

  // ✨ FIXED JOIN LOGIC
  async function handleJoin() {
    if (!profile) return alert("Profile missing.");

    // Username check before joining
    let ingameName = profile.username || profile.displayName || "";
    if (!ingameName) {
      ingameName = window.prompt("Enter your in-game username:", "");
      if (!ingameName) return alert("You must enter a username to join.");

      await updateProfileField({ username: ingameName });
    }

    // Max player check
    const count = match.playersJoined?.length || 0;
    if (match.maxPlayers && count >= match.maxPlayers)
      return alert("Match is full.");

    setLoadingJoin(true);
    try {
      const ref = doc(db, "matches", match.id);

      await updateDoc(ref, {
        playersJoined: arrayUnion({
          uid: user.uid,
          username: ingameName,
          joinedAt: serverTimestamp(),
        }),
      });

      await refreshMatch();
      setJoined(true);
      alert("Joined match successfully!");

    } catch (e) {
      console.error("join error", e);
      alert("Failed to join match.");
    }

    setLoadingJoin(false);
  }

  // Room reveal logic
  const revealAt = match?.revealAt?.seconds
    ? match.revealAt.toDate().getTime()
    : match?.revealAt
    ? new Date(match.revealAt).getTime()
    : null;

  const canReveal = revealAt ? now >= revealAt : false;

  // Auto-rotate map
  const displayMap = useMemo(() => {
    const pool = match.mapPool?.length ? match.mapPool : ["Bermuda", "Purgatory", "Kalahari"];
    if (!match.autoRotate) return match.map || pool[0];

    const created = match.createdAt?.seconds
      ? match.createdAt.toDate().getTime()
      : Date.now();

    const minutes = Math.floor((now - created) / (1000 * 60));
    return pool[minutes % pool.length];
  }, [match, now]);

  return (
    <section className="panel match-details-view">
      <button className="back-btn" onClick={onBack}>Back</button>

      <div className="match-details-header">
        <div>
          <h2>{match.title}</h2>
          <div className="match-meta time">{match.mode || "Solo"}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="match-meta">Entry: {match.entryFee}</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>
            {match.playersJoined?.length || 0}/{match.maxPlayers || "?"}
          </div>
          <button
            className="btn"
            disabled={loadingJoin || joined}
            onClick={handleJoin}
            style={{ marginTop: 10 }}
          >
            {joined ? "Joined" : loadingJoin ? "Joining..." : "Join"}
          </button>
        </div>
      </div>

      <img className="match-details-image" src={match.imageUrl || "/match-default.jpg"} />

      <div className="match-details-time">
        Starts: {match.startTime?.seconds
          ? match.startTime.toDate().toLocaleString()
          : "TBD"}
      </div>

      {/* ROOM DETAILS */}
      <div className="room-details">
        <h4>Room Details</h4>

        {!canReveal ? (
          <p>Room ID & Password will be revealed 2–5 minutes before match.</p>
        ) : (
          <>
            <p><strong>ID:</strong> {match.roomID}</p>
            <p><strong>Password:</strong> {match.roomPassword}</p>
          </>
        )}

        <p><strong>Map:</strong> {displayMap} {match.autoRotate ? "(auto)" : ""}</p>
        <p><strong>Mode:</strong> {match.mode}</p>
      </div>

      {/* RULES */}
      <div className="match-rules">
        <h4>Rules</h4>
        <p style={{ whiteSpace: "pre-wrap" }}>
{`Tournament Format

Modes: Solo, Duo, Squad
Map Pool: Bermuda, Purgatory, Kalahari (rotating)

Point System:
1 Kill = ${match.type === "custom" ? (match.killReward || "Custom") : 75} Coins

Total coins determine final ranking.

All players must join in time.
No teaming, hacking, exploiting, macros, or modded APKs.
No rematches for individual disconnection.
Official decisions are final.

Organizer reserves full rights to modify rules.`}
        </p>
      </div>
    </section>
  );
}
