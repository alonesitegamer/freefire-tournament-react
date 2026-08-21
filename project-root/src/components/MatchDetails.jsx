import React, { useState, useEffect, useMemo } from "react";
import { secureApi } from "../utils/apiClient";
import "./MatchDetails.css";
import PlayersBoard from "./PlayersBoard";
import ResultsBoard from "./ResultsBoard";

export default function MatchDetails({ match: initialMatch, onBack, user }) {
  const [match, setMatch] = useState(initialMatch);
  const [joined, setJoined] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [joining, setJoining] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);

  useEffect(() => setMatch(initialMatch), [initialMatch]);
  useEffect(() => setJoined(match?.playersJoined?.some((player) => player.uid === user.uid) || false), [match, user.uid]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  async function refreshMatch() {
    const result = await secureApi(`/api/matches?matchId=${encodeURIComponent(match.id)}`);
    if (result.match) setMatch(result.match);
    setJoined(Boolean(result.joined));
    return result;
  }

  async function handleJoin() {
    if (joining || joined) return;
    setJoining(true);
    try {
      const result = await secureApi("/api/economy", { method: "POST", body: JSON.stringify({ action: "join", matchId: match.id }) });
      await refreshMatch();
      setJoined(true);
      alert(`Joined successfully. ${result.coins} coins remaining.`);
    } catch (error) {
      console.error(error);
      alert(error.message || "Unable to join match.");
    } finally {
      setJoining(false);
    }
  }

  async function revealRoom() {
    if (!joined || roomLoading || (match.roomID && match.roomPassword)) return;
    setRoomLoading(true);
    try {
      const result = await refreshMatch();
      if (!result.privateVisible) alert("Room details are not available yet.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Unable to load room details.");
    } finally {
      setRoomLoading(false);
    }
  }

  const revealAt = match.revealAt?.seconds ? match.revealAt.toDate().getTime() : match.revealAt ? new Date(match.revealAt).getTime() : null;
  const canReveal = joined && revealAt && now >= revealAt;

  const displayMap = useMemo(() => {
    const pool = match.mapPool?.length ? match.mapPool : ["Bermuda", "Purgatory", "Kalahari"];
    if (!match.autoRotate) return match.map || pool[0];
    const created = match.createdAt?.seconds ? match.createdAt.toDate().getTime() : new Date(match.createdAt || Date.now()).getTime();
    const minutes = Math.floor((now - created) / 60000);
    return pool[Math.max(0, minutes) % pool.length];
  }, [match, now]);

  function copy(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => alert("Copied!")).catch(() => alert("Copy failed"));
  }

  return (
    <section className="panel match-details-view premium-style">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="match-header-premium">
        <h2>{match.title}</h2>
        <div className="mini-meta">{match.mode} • Entry {match.entryFee} • {match.playersJoined?.length || 0}/{match.maxPlayers}</div>
        {!joined ? <button className="join-premium-btn" onClick={handleJoin} disabled={joining}>{joining ? "Joining..." : "Join Match"}</button> : <button className="join-premium-btn joined" disabled>Joined ✓</button>}
      </div>

      <img className="match-big-banner" src={match.imageUrls?.[0] || "/bt.jpg"} alt="Match Banner" />

      {!joined && (
        <div className="locked-overlay">
          <div className="locked-content">
            <h3>Join to Unlock Details</h3>
            <p>Room ID, Password & Rules become visible only after joining.</p>
            <button className="join-small-btn" onClick={handleJoin} disabled={joining}>{joining ? "Joining..." : "Join Now"}</button>
          </div>
        </div>
      )}

      {match.status === "completed" ? <ResultsBoard match={match} /> : <PlayersBoard match={match} />}

      {joined && (
        <div className="details-container">
          <h3 className="section-title">Room Details</h3>
          {!canReveal && <p className="muted">Room will be revealed a few minutes before match.</p>}
          {canReveal && !match.roomID && (
            <button className="btn small" onClick={revealRoom} disabled={roomLoading}>{roomLoading ? "Loading room..." : "Reveal Room Details"}</button>
          )}
          {canReveal && match.roomID && (
            <>
              <div className="detail-row"><strong>Room ID:</strong> {match.roomID}<button className="copy-btn" onClick={() => copy(match.roomID)}>Copy</button></div>
              <div className="detail-row"><strong>Password:</strong> {match.roomPassword || "—"}<button className="copy-btn" onClick={() => copy(match.roomPassword)}>Copy</button></div>
            </>
          )}
          <div className="detail-row"><strong>Map:</strong> {displayMap}</div>
          <div className="detail-row"><strong>Mode:</strong> {match.mode}</div>
          <h3 className="section-title" style={{ marginTop: 20 }}>Rules</h3>
          <p className="rules-text">1 Kill = {match.killReward || 75} coins.<br />No teaming, hacking, exploiting or emulator unless stated.<br />Room details are private — do NOT share.<br />Admin decisions are final.</p>
        </div>
      )}
    </section>
  );
}
