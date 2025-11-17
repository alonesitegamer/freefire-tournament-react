// src/components/MatchDetails.jsx
import React, { useMemo, useState, useEffect } from "react";
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function MatchDetails({ match: initialMatch, onBack, user, profile, updateProfileField }) {
  const [match, setMatch] = useState(initialMatch);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [joined, setJoined] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setMatch(initialMatch);
  }, [initialMatch]);

  useEffect(() => {
    // live "now" tick for reveal logic / rotating map display
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const players = match?.playersJoined || [];
    setJoined(players.some((p) => p.uid === user.uid));
  }, [match, user.uid]);

  async function refreshMatch() {
    try {
      const ref = doc(db, "matches", match.id);
      const snap = await getDoc(ref);
      if (snap.exists()) setMatch({ id: snap.id, ...snap.data() });
    } catch (e) {
      console.error("refreshMatch", e);
    }
  }

  async function handleJoin() {
    if (!profile) return alert("Profile missing.");
    if (joined) return alert("You already joined this match.");

    // ensure ingame name exists
    let ingame = profile.username || profile.displayName || "";
    if (!ingame) {
      ingame = window.prompt("Enter your in-game username (this will be saved):", "");
      if (!ingame) return alert("You must enter an in-game username to join.");
      try {
        if (typeof updateProfileField === "function") {
          await updateProfileField({ username: ingame });
        } else {
          // fallback direct update (best effort)
          await updateDoc(doc(db, "users", user.uid), { username: ingame });
        }
        // optimistic local update
        setTimeout(() => {}, 200);
      } catch (e) {
        console.error("save username", e);
      }
    }

    const maxP = match.maxPlayers || 0;
    const playerCount = (match.playersJoined || []).length;
    if (maxP > 0 && playerCount >= maxP) return alert("Match is full.");

    setLoadingJoin(true);
    try {
      const ref = doc(db, "matches", match.id);

      const playerObj = { uid: user.uid, username: ingame, joinedAt: serverTimestamp() };
      await updateDoc(ref, {
        playersJoined: arrayUnion(playerObj),
      });

      // refresh local
      await refreshMatch();
      setJoined(true);
      alert("Joined match!");
    } catch (err) {
      console.error("join error", err);
      alert("Failed to join.");
    } finally {
      setLoadingJoin(false);
    }
  }

  // compute whether to show room
  const revealAt = match?.revealAt ? (match.revealAt.seconds ? match.revealAt.toDate().getTime() : new Date(match.revealAt).getTime()) : null;
  const canReveal = revealAt ? now >= revealAt : false;

  // compute displayed map (auto-rotate)
  const displayMap = useMemo(() => {
    const pool = match?.mapPool?.length ? match.mapPool : ["Bermuda", "Purgatory", "Kalahari"];
    if (!match) return pool[0];
    if (!match.autoRotate) {
      return match.map || pool[0];
    }
    // simple rotation: index by minutes since creation /  % pool.length
    const created = match.createdAt ? (match.createdAt.seconds ? match.createdAt.toDate().getTime() : new Date(match.createdAt).getTime()) : Date.now();
    const minutesSince = Math.floor((now - created) / (60 * 1000));
    return pool[minutesSince % pool.length];
  }, [match, now]);

  return (
    <section className="panel match-details-view">
      <button className="back-btn" onClick={onBack}>Back</button>

      <div className="match-details-header">
        <div>
          <h2 style={{ margin: 0 }}>{match.title}</h2>
          <div className="match-meta time">{match.teamType || match.mode || "Solo"}</div>
        </div>

        <div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#bfc7d1", fontSize: 13 }}>{`Entry: ${match.entryFee ?? 0}`}</div>
            <div style={{ fontWeight: 800, marginTop: 8 }}>{`${(match.playersJoined || []).length}/${match.maxPlayers || "?"}`}</div>
            <div style={{ marginTop: 8 }}>
              <button
                className="btn"
                onClick={handleJoin}
                disabled={loadingJoin || (match.maxPlayers && (match.playersJoined || []).length >= (match.maxPlayers))}
              >
                {loadingJoin ? "Joining..." : (joined ? "Joined" : "Join")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <img className="match-details-image" src={match.imageUrl || "/match-default.jpg"} alt="match" />

      <div className="match-details-time">
        Starts: {match.startTime ? (match.startTime.seconds ? match.startTime.toDate().toLocaleString() : new Date(match.startTime).toLocaleString()) : "TBD"}
      </div>

      <div className="room-details">
        <h4>Room details</h4>
        {!canReveal ? (
          <p>Room ID and Password will be given {match.revealDelayMinutes ? `${match.revealDelayMinutes} minute(s)` : "a few minutes"} before match.</p>
        ) : (
          <>
            <p><strong>Room ID:</strong> {match.roomID || "TBD"}</p>
            <p><strong>Password:</strong> {match.roomPassword || ""}</p>
          </>
        )}
        <p><strong>Map:</strong> {displayMap} {match.autoRotate ? "(auto-rotate)" : ""}</p>
        <p><strong>Mode:</strong> {match.mode || match.teamType || "Solo"}</p>
      </div>

      <div className="match-rules">
        <h4>Rules</h4>
        <p style={{ whiteSpace: "pre-wrap" }}>
{`Tournament Format

Modes: Solo, Duo, Squad

Map Pool: Bermuda, Purgatory, Kalahari (rotating)

Point System:

No placement points.

Kills Only: 1 Kill = ${match.type === "custom" ? (match.killReward ?? "custom") : 75} Coins

Total coins determine final ranking.

---

Player Requirements

Players may participate solo, duo, or in squads.

In-game usernames must be clean, non-offensive, and must not imitate official staff.

---

Match Rules

All players must join the lobby within the given time.

No teaming, stream-sniping, or exploiting bugs.

No scripts, hacks, cheats, macros, or modded APKs.

---

Device & Network Rules

Allowed devices: Mobile phones only (unless stated otherwise).

No tablets or emulators unless approved.

Network issues are the player’s own responsibility.

---

Character / Loadout Rules

All characters, skills, pets, and weapons allowed.

No throwable limits.

Grenade launcher ammo allowed.

---

Disconnection Policy

No rematches for individual disconnections.

If more than 50% of players disconnect due to server issues, match will be replayed.

---

Cheating & Penalties

Any cheating results in instant disqualification.

Strong evidence (screen recording/screenshot/POV) required for reports.

---

Reporting Issues

Players must report issues within 10 minutes after match completion.

Proof required.

---

Referee/Admin Decisions

All decisions made by officials are final.

---

Prize Distribution

Prize pool will be announced prior to the event.

Players must provide correct payout information.

---

Code of Conduct

No toxicity, harassment, racism, or abusive language.

Violations may lead to warnings or removal.

---

Streaming Rules

Delay: 5–10 minutes recommended.

Streamers must not reveal enemy positions intentionally.

Lobby passwords must not be shared.

---

Lobby Rules

Late players may be skipped for that round.

Wrong team placement will not trigger remakes once the plane takes off.

---

Organizer Rights

The organizer reserves full rights to modify rules when required.

All participants automatically accept the rules upon joining.`}
        </p>
      </div>
    </section>
  );
}
