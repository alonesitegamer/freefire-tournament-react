// src/components/MatchDetails.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export default function MatchDetails({
  match: initialMatch,
  onBack,
  user,
  profile,
  updateProfileField,
}) {
  const [match, setMatch] = useState(initialMatch);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [joined, setJoined] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Expose join function so MatchList join works
  useEffect(() => {
    window.joinMatchDirect = () => {
      handleJoin();
    };
  });

  // Sync match on change
  useEffect(() => {
    setMatch(initialMatch);
  }, [initialMatch]);

  // detect if joined
  useEffect(() => {
    const players = match?.playersJoined || [];
    setJoined(players.some((p) => p.uid === user.uid));
  }, [match, user.uid]);

  // refresh timer
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  // refresh match from firestore
  async function refreshMatch() {
    try {
      const ref = doc(db, "matches", match.id);
      const snap = await getDoc(ref);
      if (snap.exists()) setMatch({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error("Match refresh error:", err);
    }
  }

  // JOIN MATCH
  async function handleJoin() {
    if (!profile) return alert("Profile missing.");

    let ingame = profile.username || profile.displayName || "";
    if (!ingame) {
      ingame = window.prompt("Enter your in-game username:", "");
      if (!ingame) return alert("You must enter a username.");
      await updateProfileField({ username: ingame });
    }

    const count = match.playersJoined?.length || 0;
    if (match.maxPlayers && count >= match.maxPlayers)
      return alert("Match is full.");

    setLoadingJoin(true);

    try {
      const ref = doc(db, "matches", match.id);

      await updateDoc(ref, {
        playersJoined: arrayUnion({
          uid: user.uid,
          username: ingame,
          joinedAt: serverTimestamp(),
        }),
      });

      await refreshMatch();
      setJoined(true);
      alert("Joined match successfully!");
    } catch (e) {
      console.error("Join error:", e);
      alert("Failed to join match.");
    }

    setLoadingJoin(false);
  }

  // Reveal time calculation
  const revealAt = match?.revealAt?.seconds
    ? match.revealAt.toDate().getTime()
    : match?.revealAt
    ? new Date(match.revealAt).getTime()
    : null;

  const revealReady = revealAt ? now >= revealAt : false;

  // Auto-rotate map
  const displayMap = useMemo(() => {
    const pool =
      match.mapPool?.length > 0
        ? match.mapPool
        : ["Bermuda", "Purgatory", "Kalahari"];

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
          <div className="match-meta">{match.mode}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="match-meta">Entry: {match.entryFee}</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>
            {match.playersJoined?.length || 0}/{match.maxPlayers}
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

      <img
        className="match-details-image"
        src={match.imageUrl || "/match-default.jpg"}
        alt=""
      />

      <div className="match-details-time">
        Starts:{" "}
        {match.startTime?.seconds
          ? match.startTime.toDate().toLocaleString()
          : "TBD"}
      </div>

      {/* ROOM DETAILS */}
      <div className="room-details">
        <h4>Room Details</h4>

        {/* ❌ Not joined → cannot see details */}
        {!joined && (
          <p style={{ color: "#f77" }}>
            Join the match to unlock room details.
          </p>
        )}

        {/* 🟡 Joined but reveal not ready */}
        {joined && !revealReady && (
          <p>
            Room ID & Password will be revealed{" "}
            {match.revealDelayMinutes || 5} minutes before match start.
          </p>
        )}

        {/* 🟢 Joined + reveal time reached */}
        {joined && revealReady && (
          <>
            <p><strong>ID:</strong> {match.roomID || "Not set"}</p>
            <p><strong>Password:</strong> {match.roomPassword || "Not set"}</p>
          </>
        )}

        <p><strong>Map:</strong> {displayMap} {match.autoRotate ? "(auto)" : ""}</p>
        <p><strong>Mode:</strong> {match.mode}</p>
      </div>

      {/* RULES */}
      <div className="match-rules">
        <h4>Rules</h4>
        <p style={{ whiteSpace: "pre-wrap" }}>
{`Point System:
1 Kill = ${
  match.type === "custom"
    ? (match.killReward || "Custom reward")
    : 75
} Coins

No teaming, hacking, exploiting, macros.
Organizer decisions are final.`}
        </p>
      </div>
    </section>
  );
}
