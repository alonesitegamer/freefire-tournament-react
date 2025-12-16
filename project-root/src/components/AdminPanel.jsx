// src/components/AdminPanel.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "./AdminPanel.css";

const DEFAULT_MAP_POOL = ["Bermuda", "Purgatory", "Kalahari"];

export default function AdminPanel({
  requests = { topup: [], withdraw: [] },
  approveRequest = () => {},
  rejectRequest = () => {},
  matches = [],
  createMatch = () => {},
  editMatch = () => {},
  deleteMatch = () => {},
}) {
  const [localMatches, setLocalMatches] = useState(matches || []);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    title: "",
    type: "tournament",
    mode: "Solo",
    mapPool: DEFAULT_MAP_POOL.slice(),
    autoRotate: true,
    map: DEFAULT_MAP_POOL[0],
    maxPlayers: 4,
    entryFee: 0,
    reward: 0,
    killReward: 75,
    startTime: "",
    revealDelayMinutes: 5,
    roomID: "",
    roomPassword: "",
    imageUrl: "",
  });

  // Refresh matches from props
  useEffect(() => setLocalMatches(matches), [matches]);
  // -----------------------------
  // OPEN CREATE MATCH
  // -----------------------------
  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      type: "tournament",
      mode: "Solo",
      mapPool: DEFAULT_MAP_POOL.slice(),
      autoRotate: true,
      map: DEFAULT_MAP_POOL[0],
      maxPlayers: 4,
      entryFee: 0,
      reward: 0,
      killReward: 75,
      startTime: "",
      revealDelayMinutes: 5,
      roomID: "",
      roomPassword: "",
      imageNames: "",
      imageUrl: "",
    });
    setShowCreate(true);
  }

  // -----------------------------
  // OPEN EDIT MATCH
  // -----------------------------
  function openEdit(m) {
    setEditing(m);
    setForm({
      title: m.title || "",
      type: m.type || "tournament",
      mode: m.mode || "Solo",
      mapPool: m.mapPool || DEFAULT_MAP_POOL.slice(),
      autoRotate: m.autoRotate ?? true,
      map: m.map || DEFAULT_MAP_POOL[0],
      maxPlayers: m.maxPlayers || 4,
      entryFee: m.entryFee || 0,
      reward: m.reward || 0,
      killReward: m.killReward ?? 75,
      startTime: m.startTime
        ? (m.startTime.seconds
            ? m.startTime.toDate().toISOString().slice(0, 16)
            : new Date(m.startTime).toISOString().slice(0, 16))
        : "",
      revealDelayMinutes: m.revealDelayMinutes || 5,
      roomID: m.roomID || "",
      roomPassword: m.roomPassword || "",
      imageNames: (m.imageUrl || [])
      .map(p => p.replace("/match/", "")
        .replace(".jpeg", ""))
           .join(","),
      imageUrls: m.imageUrls || [],
    });
    setShowCreate(true);
  }

  // -----------------------------
  // SAVE MATCH
  // -----------------------------
  function resloveMatchImages(names) {
    if (!names) return [];
    return names
    .split(",")
    .map(n => n.trim())
    .filter(boolen)
    .map(n => `/match/${n}.jpeg`);
  }
  async function handleSave() {
    setSaving(true);

    try {
      const payload = {
        title: form.title,
        type: form.type,
        mode: form.mode,
        mapPool: form.mapPool,
        autoRotate: form.autoRotate,
        map: form.map,
        maxPlayers: Number(form.maxPlayers),
        entryFee: Number(form.entryFee),
        reward: Number(form.reward),
        killReward: Number(form.killReward),
        roomID: form.roomID,
        roomPassword: form.roomPassword,
        imageUrls: resolveMatchImages(form.imageNames), 
        status: "upcoming",
        playersJoined: [],
        createdAt: serverTimestamp(),
      };

      // start time & revealAt
      if (form.startTime) {
        const start = new Date(form.startTime);
        payload.startTime = start;

        payload.revealAt = new Date(
          start.getTime() -
            Number(form.revealDelayMinutes || 5) * 60 * 1000
        );
        payload.revealDelayMinutes = Number(form.revealDelayMinutes || 5);
      }

      if (editing) {
        await updateDoc(doc(db, "matches", editing.id), payload);
        await editMatch(editing.id, payload);
      } else {
        await createMatch(payload);
      }

      setShowCreate(false);
      alert("Match saved successfully!");
    } catch (e) {
      alert("Failed to save: " + e.message);
    }

    setSaving(false);
  }

  // -----------------------------
  // DELETE MATCH
  // -----------------------------
  async function handleDelete(m) {
    if (!window.confirm("Delete this match?")) return;
    await deleteMatch(m.id);
  }

  // -----------------------------
  // MAIN UI
  // -----------------------------

  return (
    <section className="panel admin-panel">
      <div className="admin-header">
        <h3>Admin Panel</h3>
        <button className="btn small" onClick={openCreate}>
          Create Match
        </button>
      </div>

      <h4>Top-up Requests</h4>
      {requests.topup.length === 0 ? (
        <p className="muted-small">No topups.</p>
      ) : (
        requests.topup.map((r) => (
          <div key={r.id} className="admin-row">
            <span>{r.email} | ₹{r.amount}</span>
            <div>
              <button className="btn small" onClick={() => approveRequest("topup", r)}>Approve</button>
              <button className="btn small ghost" onClick={() => rejectRequest("topup", r)}>Reject</button>
            </div>
          </div>
        ))
      )}

      <h4>Withdraw Requests</h4>
      {requests.withdraw.length === 0 ? (
        <p className="muted-small">No withdrawals.</p>
      ) : (
        requests.withdraw.map((r) => (
          <div key={r.id} className="admin-row">
            <span>{r.email} | ₹{r.amount}</span>
            <div>
              <button className="btn small" onClick={() => approveRequest("withdraw", r)}>Approve</button>
              <button className="btn small ghost" onClick={() => rejectRequest("withdraw", r)}>Reject</button>
            </div>
          </div>
        ))
      )}

      <h4>Matches</h4>
      {localMatches.length === 0 ? (
        <p className="muted-small">No matches.</p>
      ) : (
        localMatches.map((m) => (
          <div key={m.id} className="admin-row">
            <div>
              <b>{m.title}</b>
              <div className="small-muted">
                {m.type} • {m.mode} • {m.maxPlayers} players
              </div>
            </div>
            <div className="admin-match-actions">
              <button className="btn small" onClick={() => openEdit(m)}>Edit</button>
              <button className="btn small ghost" onClick={() => handleDelete(m)}>Delete</button>
            </div>
          </div>
        ))
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit Match" : "Create Match"}</h3>

            <label>Match Images (comma seperated)</label>
            <input
              className="modern-input"
              placeholder="FF1,FF2,FF4,FF5,FF6"
              value={form.imageNames}
              onChange={(e) =>
                setForm({ ...form, imageNames: e.target.value })
              }
              />
            {form.imagesNames && (
          <div class Name="image-preview-row">
            {resolveMatchImages(form.imageNames).map((src)
          => (
             <img
               key={src}
               src={src}
               alt"preview"
               style={{
                 width: 120,
                 height: 70,
                 objectFit: "cover",
                 borderRadius: 8,
                 marginRight: 8,
                 border: "1px solid rgba(255,255,255,0.1)"
               }}
               />
            )))}
            </div>
          )}

            <label>Title</label>
            <input
              className="modern-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />

            <label>Type</label>
            <select
              className="modern-input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="tournament">Tournament (BR)</option>
              <option value="custom">Custom (1v1)</option>
            </select>

            <label>Mode</label>
            <select
              className="modern-input"
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
            >
              <option>Solo</option>
              <option>Duo</option>
              <option>Squad</option>
            </select>

            <label>Map Pool</label>
            <input
              className="modern-input"
              value={form.mapPool.join(",")}
              onChange={(e) =>
                setForm({
                  ...form,
                  mapPool: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />

            <label>Max Players (2–48)</label>
            <input
              type="number"
              min="2"
              max="48"
              className="modern-input"
              value={form.maxPlayers}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxPlayers: Math.min(48, Math.max(2, Number(e.target.value))),
                })
              }
            />

            <label>Entry Fee</label>
            <input
              type="number"
              className="modern-input"
              value={form.entryFee}
              onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) })}
            />

            <label>Kill Reward</label>
            <input
              type="number"
              className="modern-input"
              value={form.killReward}
              onChange={(e) => setForm({ ...form, killReward: Number(e.target.value) })}
            />

            <label>Start Time</label>
            <input
              type="datetime-local"
              className="modern-input"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />

            <label>Reveal Delay (minutes)</label>
            <input
              type="number"
              className="modern-input"
              value={form.revealDelayMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  revealDelayMinutes: Number(e.target.value || 5),
                })
              }
            />

            <label>Room ID</label>
            <input
              className="modern-input"
              value={form.roomID}
              onChange={(e) => setForm({ ...form, roomID: e.target.value })}
            />

            <label>Room Password</label>
            <input
              className="modern-input"
              value={form.roomPassword}
              onChange={(e) => setForm({ ...form, roomPassword: e.target.value })}
            />

            <div className="admin-modal-actions">
              <button className="btn small ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn small" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editing ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
