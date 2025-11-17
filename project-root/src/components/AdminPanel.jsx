// src/components/AdminPanel.jsx
import React, { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function AdminPanel({
  requests = { topup: [], withdraw: [] },
  approveRequest = () => {},
  rejectRequest = () => {},
  matches = []
}) {
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    type: "",
    mode: "",
    teamType: "",
    entryFee: "",
    perKillReward: "",
    maxPlayers: "",
    prizeModel: "",
    imageUrl: "",
    rules: "",
    startTime: "",
  });

  const MODE_OPTIONS = ["Custom", "Tournament"];

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function createMatch(e) {
    e.preventDefault();

    // ---------- Full Validation ----------
    if (!form.title.trim()) return alert("Match title is required.");
    if (!form.type.trim()) return alert("Match type is required.");
    if (!form.mode.trim()) return alert("Mode is required.");
    if (!form.teamType.trim()) return alert("Team type is required.");
    if (!form.entryFee || form.entryFee < 0)
      return alert("Entry fee cannot be negative.");
    if (!form.perKillReward || form.perKillReward < 0)
      return alert("Per kill reward cannot be negative.");
    if (!form.maxPlayers || form.maxPlayers < 2)
      return alert("Max players must be at least 2.");
    if (!form.startTime.trim()) return alert("Start time is required.");

    if (new Date(form.startTime) < new Date())
      return alert("Start time cannot be in the past.");

    if (!form.imageUrl.trim()) return alert("Image URL is required.");

    setCreating(true);

    try {
      await addDoc(collection(db, "matches"), {
        title: form.title,
        type: form.type,
        mode: form.mode,
        teamType: form.teamType,
        entryFee: Number(form.entryFee),
        perKillReward: Number(form.perKillReward),
        maxPlayers: Number(form.maxPlayers),
        prizeModel: form.prizeModel,
        imageUrl: form.imageUrl,
        rules: form.rules,
        startTime: form.startTime,
        status: "upcoming",
        createdAt: serverTimestamp(),
        playersJoined: [],
      });

      alert("Match created successfully!");

      // reset form
      setForm({
        title: "",
        type: "",
        mode: "",
        teamType: "",
        entryFee: "",
        perKillReward: "",
        maxPlayers: "",
        prizeModel: "",
        imageUrl: "",
        rules: "",
        startTime: "",
      });
    } catch (err) {
      console.error("Match create error:", err);
      alert("Failed to create match.");
    }

    setCreating(false);
  }

  return (
    <section className="panel">
      <h3>Admin Panel</h3>

      {/* ---------------- CREATE MATCH ---------------- */}
      <div className="admin-form" style={{ marginBottom: 30 }}>
        <h4>Create Match</h4>

        <form onSubmit={createMatch}>
          <label>Title</label>
          <input
            className="modern-input"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
          />

          <label>Type (BR, CS, etc)</label>
          <input
            className="modern-input"
            value={form.type}
            onChange={(e) => updateField("type", e.target.value)}
          />

          <label>Mode</label>
          <select
            className="modern-input"
            value={form.mode}
            onChange={(e) => updateField("mode", e.target.value)}
          >
            <option value="">Select Mode</option>
            {MODE_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <label>Team Type (Solo / Duo / Squad)</label>
          <input
            className="modern-input"
            value={form.teamType}
            onChange={(e) => updateField("teamType", e.target.value)}
          />

          <label>Entry Fee</label>
          <input
            type="number"
            className="modern-input"
            value={form.entryFee}
            onChange={(e) => updateField("entryFee", e.target.value)}
          />

          <label>Per Kill Reward</label>
          <input
            type="number"
            className="modern-input"
            value={form.perKillReward}
            onChange={(e) => updateField("perKillReward", e.target.value)}
          />

          <label>Max Players</label>
          <input
            type="number"
            className="modern-input"
            value={form.maxPlayers}
            onChange={(e) => updateField("maxPlayers", e.target.value)}
          />

          <label>Prize Model (1st, 2nd, etc)</label>
          <input
            className="modern-input"
            value={form.prizeModel}
            onChange={(e) => updateField("prizeModel", e.target.value)}
          />

          <label>Image URL</label>
          <input
            className="modern-input"
            value={form.imageUrl}
            onChange={(e) => updateField("imageUrl", e.target.value)}
          />

          <label>Rules</label>
          <textarea
            className="modern-input"
            value={form.rules}
            onChange={(e) => updateField("rules", e.target.value)}
          />

          <label>Start Time</label>
          <input
            type="datetime-local"
            className="modern-input"
            value={form.startTime}
            onChange={(e) => updateField("startTime", e.target.value)}
          />

          <button
            className="btn"
            disabled={creating}
            style={{ marginTop: 10 }}
          >
            {creating ? "Creating..." : "Create Match"}
          </button>
        </form>
      </div>

      {/* ---------------- TOP-UP REQUESTS ---------------- */}
      <h4>Top-up Requests</h4>
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

      {/* ---------------- WITHDRAW REQUESTS ---------------- */}
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
