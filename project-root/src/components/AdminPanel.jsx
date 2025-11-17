// src/components/AdminPanel.jsx
import React, { useState } from "react";

export default function AdminPanel({
  requests = { topup: [], withdraw: [] },
  approveRequest = () => {},
  rejectRequest = () => {},
  matches = []
}) {
  // -------------------------
  // Default Tournament Rules
  // -------------------------
  const defaultRules = `
Tournament Format

Modes: Solo, Duo, Squad

Map Pool: Bermuda, Purgatory, Kalahari (rotating)

Point System:
No placement points.
Kills Only: 1 Kill = 75 Coins
Total coins determine final ranking.

--------------------------------------------------

Player Requirements
Players may participate solo, duo, or in squads.
In-game usernames must be clean and not offensive.

--------------------------------------------------

Match Rules
All players must join the lobby within the given time.
No teaming, stream-sniping, or exploiting bugs.
No scripts, hacks, cheats, macros, or modded APKs.

--------------------------------------------------

Device & Network Rules
Allowed devices: Mobile phones only (unless stated otherwise).
No tablets or emulators unless approved.
Network issues are the player’s own responsibility.

--------------------------------------------------

Character / Loadout Rules
All characters, skills, pets, and weapons allowed.
No throwable limits.
Grenade launcher ammo allowed.

--------------------------------------------------

Disconnection Policy
No rematches for individual disconnections.
If 50%+ players disconnect due to server issues, match will be replayed.

--------------------------------------------------

Cheating & Penalties
Any cheating = instant disqualification.
Reports require valid proof (screen recording / screenshot / POV).

--------------------------------------------------

Reporting Issues
Must be reported within 10 minutes after match completion.
Proof required.

--------------------------------------------------

Referee/Admin Decisions
All decisions made by officials are final.

--------------------------------------------------

Prize Distribution
Prize pool will be announced before the event.
Players must provide correct payout information.

--------------------------------------------------

Code of Conduct
No toxicity, racism, harassment, or abusive language.
Violations may lead to warnings or removal.

--------------------------------------------------

Streaming Rules
Recommended delay: 5–10 minutes.
Streamers must not reveal enemy positions.
Lobby passwords must not be shared.

--------------------------------------------------

Lobby Rules
Late players may be skipped for that round.
Wrong team placement is not remade once the plane takes off.

--------------------------------------------------

Organizer Rights
Organizer may modify rules at any time.
Joining automatically means accepting all rules.
`;

  // --------------------------------------
  // MATCH CREATION STATE
  // --------------------------------------
  const [matchForm, setMatchForm] = useState({
    title: "",
    mode: "solo", // solo, duo, squad, custom, tournament
    entryFee: 0,
    prize: "",
    map: "Bermuda",
    rules: "",
    startTime: "",
    roomId: "",
    roomPassword: ""
  });

  function updateField(field, value) {
    setMatchForm(prev => ({ ...prev, [field]: value }));
  }

  // ---------------------------
  // Submit new match (Firestore)
  // ---------------------------
  async function createMatch(e) {
    e.preventDefault();
    try {
      const ref = collection(db, "matches");
      await addDoc(ref, {
        ...matchForm,
        status: "upcoming",
        createdAt: serverTimestamp()
      });
      alert("Match Created!");
      setMatchForm({
        title: "",
        mode: "solo",
        entryFee: 0,
        prize: "",
        map: "Bermuda",
        rules: "",
        startTime: "",
        roomId: "",
        roomPassword: ""
      });
    } catch (err) {
      console.error(err);
      alert("Error creating match!");
    }
  }

  return (
    <section className="panel">
      <h3>Admin Panel</h3>

      {/* ---------------------- CREATE MATCH ---------------------- */}
      <h4 style={{ marginTop: 16 }}>Create Match</h4>

      <form onSubmit={createMatch} className="admin-form">
        <label>Match Title</label>
        <input
          className="modern-input"
          value={matchForm.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="Tournament | Solo | Duo | Squad"
        />

        <label>Mode</label>
        <select
          className="modern-input"
          value={matchForm.mode}
          onChange={(e) => updateField("mode", e.target.value)}
        >
          <option value="solo">Solo</option>
          <option value="duo">Duo</option>
          <option value="squad">Squad</option>
          <option value="custom">Custom</option>
          <option value="tournament">Tournament</option>
        </select>

        <label>Entry Fee</label>
        <input
          type="number"
          className="modern-input"
          value={matchForm.entryFee}
          onChange={(e) => updateField("entryFee", e.target.value)}
        />

        <label>Prize / Winning Amount</label>
        <input
          className="modern-input"
          value={matchForm.prize}
          onChange={(e) => updateField("prize", e.target.value)}
          placeholder="Example: 200 coins / ₹100"
        />

        <label>Map</label>
        <select
          className="modern-input"
          value={matchForm.map}
          onChange={(e) => updateField("map", e.target.value)}
        >
          <option>Bermuda</option>
          <option>Purgatory</option>
          <option>Kalahari</option>
        </select>

        <label>Start Time</label>
        <input
          className="modern-input"
          type="datetime-local"
          value={matchForm.startTime}
          onChange={(e) => updateField("startTime", e.target.value)}
        />

        <label>Room ID</label>
        <input
          className="modern-input"
          value={matchForm.roomId}
          onChange={(e) => updateField("roomId", e.target.value)}
        />

        <label>Room Password</label>
        <input
          className="modern-input"
          value={matchForm.roomPassword}
          onChange={(e) => updateField("roomPassword", e.target.value)}
        />

        {/* RULES */}
        <label>Rules</label>
        <div style={{ display: "flex", gap: 10 }}>
          <textarea
            className="modern-input"
            style={{ flex: 1, height: 180 }}
            value={matchForm.rules}
            onChange={(e) => updateField("rules", e.target.value)}
            placeholder="Enter rules or click button →"
          />
          <button
            type="button"
            className="btn small"
            onClick={() => updateField("rules", defaultRules)}
            style={{ whiteSpace: "nowrap", height: 40 }}
          >
            Use Default Rules
          </button>
        </div>

        <button className="btn" type="submit">Create Match</button>
      </form>

      {/* ---------------------- TOPUP REQUESTS ---------------------- */}
      <h4 style={{ marginTop: 30 }}>Top-up Requests</h4>
      {requests.topup.length === 0 ? (
        <p className="muted-small">No topups.</p>
      ) : (
        requests.topup.map((r) => (
          <div key={r.id} className="admin-row">
            <span>{r.email} | ₹{r.amount} | UPI:{r.upiId}</span>
            <div>
              <button className="btn small" onClick={() => approveRequest("topup", r)}>Approve</button>
              <button className="btn small ghost" onClick={() => rejectRequest("topup", r)}>Reject</button>
            </div>
          </div>
        ))
      )}

      {/* ---------------------- WITHDRAW REQUESTS ---------------------- */}
      <h4 style={{ marginTop: 16 }}>Withdraw Requests</h4>
      {requests.withdraw.length === 0 ? (
        <p className="muted-small">No withdrawals.</p>
      ) : (
        requests.withdraw.map((r) => (
          <div key={r.id} className="admin-row">
            <span>
              {r.email} | ₹{r.amount} | {r.type} {r.upiId ? `| UPI:${r.upiId}` : ""}
            </span>
            <div>
              <button className="btn small" onClick={() => approveRequest("withdraw", r)}>Approve</button>
              <button className="btn small ghost" onClick={() => rejectRequest("withdraw", r)}>Reject</button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
