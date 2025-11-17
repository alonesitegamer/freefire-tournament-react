// src/components/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const DEFAULT_MAP_POOL = ["Bermuda", "Purgatory", "Kalahari"];

export default function AdminPanel({
  requests = { topup: [], withdraw: [] },
  approveRequest = () => {},
  rejectRequest = () => {},
  matches = [],
}) {
  const [localMatches, setLocalMatches] = useState(matches || []);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    title: "",
    type: "tournament", // tournament | custom
    mode: "Solo",
    teamType: "Solo",
    mapPool: DEFAULT_MAP_POOL.slice(),
    autoRotate: true,
    map: DEFAULT_MAP_POOL[0],
    fixedMaxPlayers: 4,
    customMaxPlayers: 16,
    maxPlayers: 4,
    entryFee: 0,
    reward: 0, // custom reward
    startTime: "",
    revealDelayMinutes: 5,
    roomID: "",
    roomPassword: "",
    killReward: 75,
  });

  useEffect(() => setLocalMatches(matches || []), [matches]);

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      type: "tournament",
      mode: "Solo",
      teamType: "Solo",
      mapPool: DEFAULT_MAP_POOL.slice(),
      autoRotate: true,
      map: DEFAULT_MAP_POOL[0],
      fixedMaxPlayers: 4,
      customMaxPlayers: 16,
      maxPlayers: 4,
      entryFee: 0,
      reward: 0,
      startTime: "",
      revealDelayMinutes: 5,
      roomID: "",
      roomPassword: "",
      killReward: 75,
    });
    setShowCreate(true);
  }

  function openEdit(m) {
    setEditing(m);
    setForm({
      title: m.title || "",
      type: m.type || "tournament",
      mode: m.mode || m.teamType || "Solo",
      teamType: m.teamType || m.mode || "Solo",
      mapPool: m.mapPool || DEFAULT_MAP_POOL.slice(),
      autoRotate: !!m.autoRotate,
      map: m.map || (m.mapPool && m.mapPool[0]) || DEFAULT_MAP_POOL[0],
      fixedMaxPlayers: m.maxPlayers || 4,
      customMaxPlayers: m.maxPlayers || 16,
      maxPlayers: m.maxPlayers || 4,
      entryFee: m.entryFee || 0,
      reward: m.reward || 0,
      startTime: m.startTime ? (m.startTime.seconds ? m.startTime.toDate().toISOString().slice(0,16) : new Date(m.startTime).toISOString().slice(0,16)) : "",
      revealDelayMinutes: m.revealDelayMinutes || 5,
      roomID: m.roomID || "",
      roomPassword: m.roomPassword || "",
      killReward: m.killReward ?? (m.type === "tournament" ? 75 : 0),
    });
    setShowCreate(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        type: form.type,
        mode: form.mode,
        teamType: form.mode,
        mapPool: form.mapPool,
        autoRotate: !!form.autoRotate,
        map: form.map,
        maxPlayers: Number(form.maxPlayers),
        entryFee: Number(form.entryFee),
        reward: Number(form.reward),
        killReward: Number(form.killReward),
        revealDelayMinutes: Number(form.revealDelayMinutes) || 5,
        roomID: form.roomID,
        roomPassword: form.roomPassword,
        createdAt: serverTimestamp(),
        status: "upcoming",
        playersJoined: [],
      };

      // compute startTime & revealAt
      if (form.startTime) {
        const start = new Date(form.startTime);
        payload.startTime = start;
        const revealAt = new Date(start.getTime() - (Number(form.revealDelayMinutes || 5) * 60 * 1000));
        payload.revealAt = revealAt;
      }

      if (editing) {
        const ref = doc(db, "matches", editing.id);
        await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
      } else {
        const ref = collection(db, "matches");
        const added = await addDoc(ref, payload);
        // optimistic push to local list
        setLocalMatches((m) => [{ id: added.id, ...payload }, ...m]);
      }

      setShowCreate(false);
      alert("Saved match.");
    } catch (e) {
      console.error("save match", e);
      alert("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m) {
    if (!window.confirm("Delete this match?")) return;
    try {
      await deleteDoc(doc(db, "matches", m.id));
      setLocalMatches((lm) => lm.filter((x) => x.id !== m.id));
    } catch (e) {
      console.error("delete match", e);
      alert("Failed to delete.");
    }
  }

  // Admin topup/withdraw list display (keeps previous logic)
  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Admin Panel</h3>
        <div>
          <button className="btn small" onClick={openCreate}>Create Match</button>
        </div>
      </div>

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

      <h4 style={{ marginTop: 16 }}>Matches</h4>
      <div className="admin-match-list">
        {localMatches.length === 0 ? <p className="muted-small">No matches.</p> : localMatches.map((m) => (
          <div key={m.id} className="admin-row">
            <div style={{ maxWidth: "70%" }}>
              <div style={{ fontWeight: 700 }}>{m.title}</div>
              <div className="small-muted">{m.type} • {m.mode} • {m.maxPlayers} players • Entry: {m.entryFee}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn small" onClick={() => openEdit(m)}>Edit</button>
              <button className="btn small ghost" onClick={() => handleDelete(m)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <h3 className="modern-title">{editing ? "Edit Match" : "Create Match"}</h3>

            <div className="admin-form">
              <label>Title</label>
              <input className="modern-input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} />

              <label>Type</label>
              <select className="modern-input" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
                <option value="tournament">Tournament (BR)</option>
                <option value="custom">Custom (1v1 / special)</option>
              </select>

              <label>Mode</label>
              <select className="modern-input" value={form.mode} onChange={(e) => setForm({...form, mode: e.target.value})}>
                <option>Solo</option>
                <option>Duo</option>
                <option>Squad</option>
              </select>

              <label>Map pool (comma separated)</label>
              <input className="modern-input" value={form.mapPool.join(",")} onChange={(e) => setForm({...form, mapPool: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})} />

              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ flex: 1 }}>
                  <div className="small-muted">Auto-rotate maps</div>
                  <input type="checkbox" checked={form.autoRotate} onChange={(e) => setForm({...form, autoRotate: e.target.checked})} />
                </label>

                <label style={{ flex: 1 }}>
                  <div className="small-muted">Manual map (override)</div>
                  <input className="modern-input" value={form.map} onChange={(e) => setForm({...form, map: e.target.value})} />
                </label>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ flex: 1 }}>
                  <div className="small-muted">Max players (2–48)</div>
                  <input type="number" min="2" max="48" className="modern-input" value={form.maxPlayers} onChange={(e) => setForm({...form, maxPlayers: Math.min(48, Math.max(2, Number(e.target.value || 2)))})} />
                </label>

                <label style={{ flex: 1 }}>
                  <div className="small-muted">Entry Fee</div>
                  <input type="number" className="modern-input" value={form.entryFee} onChange={(e) => setForm({...form, entryFee: Number(e.target.value || 0)})} />
                </label>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ flex: 1 }}>
                  <div className="small-muted">Start Time</div>
                  <input type="datetime-local" className="modern-input" value={form.startTime} onChange={(e) => setForm({...form, startTime: e.target.value})} />
                </label>

                <label style={{ flex: 1 }}>
                  <div className="small-muted">Reveal delay (minutes)</div>
                  <input type="number" min="1" max="30" className="modern-input" value={form.revealDelayMinutes} onChange={(e) => setForm({...form, revealDelayMinutes: Number(e.target.value || 5)})} />
                </label>
              </div>

              <label>Room ID</label>
              <input className="modern-input" value={form.roomID} onChange={(e) => setForm({...form, roomID: e.target.value})} />

              <label>Room Password</label>
              <input className="modern-input" value={form.roomPassword} onChange={(e) => setForm({...form, roomPassword: e.target.value})} />

              <label>Kill reward (coins) — tournament default 75</label>
              <input type="number" className="modern-input" value={form.killReward} onChange={(e) => setForm({...form, killReward: Number(e.target.value || 75)})} />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn small ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn small" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : (editing ? "Save" : "Create Match")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
