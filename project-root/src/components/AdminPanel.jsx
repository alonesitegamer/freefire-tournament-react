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
  createMatch,
  editMatch,
  deleteMatch,
}) {
  const [localMatches, setLocalMatches] = useState(matches || []);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    title: "",
    type: "tournament",
    mode: "Solo",
    mapPool: DEFAULT_MAP_POOL,
    autoRotate: true,
    map: "Bermuda",
    maxPlayers: 4,
    entryFee: 0,
    killReward: 75,
    reward: 0,
    startTime: "",
    revealDelayMinutes: 5,
    roomID: "",
    roomPassword: "",
    imageUrl: "",
  });

  // Keep match list synced
  useEffect(() => setLocalMatches(matches || []), [matches]);

  // Open blank form
  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      type: "tournament",
      mode: "Solo",
      mapPool: DEFAULT_MAP_POOL,
      autoRotate: true,
      map: "Bermuda",
      maxPlayers: 4,
      entryFee: 0,
      killReward: 75,
      reward: 0,
      startTime: "",
      revealDelayMinutes: 5,
      roomID: "",
      roomPassword: "",
      imageUrl: "",
    });
    setShowCreate(true);
  }

  // Edit match
  function openEdit(m) {
    setEditing(m);
    setForm({
      title: m.title || "",
      type: m.type || "tournament",
      mode: m.mode || "Solo",
      mapPool: m.mapPool || DEFAULT_MAP_POOL,
      autoRotate: !!m.autoRotate,
      map: m.map || "Bermuda",
      maxPlayers: m.maxPlayers || 4,
      entryFee: m.entryFee || 0,
      killReward: m.killReward ?? 75,
      reward: m.reward || 0,
      startTime: m.startTime
        ? (m.startTime.seconds
            ? m.startTime.toDate().toISOString().slice(0, 16)
            : new Date(m.startTime).toISOString().slice(0, 16))
        : "",
      revealDelayMinutes: m.revealDelayMinutes || 5,
      roomID: m.roomID || "",
      roomPassword: m.roomPassword || "",
      imageUrl: m.imageUrl || "",
    });
    setShowCreate(true);
  }

  // Save match
  async function handleSave() {
    setSaving(true);

    try {
      // -----------------------------
      // VALIDATION FIXES
      // -----------------------------

      if (!form.title.trim()) {
        alert("Title cannot be empty.");
        setSaving(false);
        return;
      }

      const maxPlayers = Number(form.maxPlayers);
      if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 48) {
        alert("Max players must be between 2 and 48.");
        setSaving(false);
        return;
      }

      let start = null;
      if (form.startTime) {
        start = new Date(form.startTime);
        if (isNaN(start.getTime())) {
          alert("Invalid start time format.");
          setSaving(false);
          return;
        }
      }

      const payload = {
        title: form.title.trim(),
        type: form.type,
        mode: form.mode,
        mapPool: form.mapPool,
        autoRotate: form.autoRotate,
        map: form.map,
        maxPlayers,
        entryFee: Number(form.entryFee) || 0,
        killReward:
          form.type === "tournament"
            ? 75
            : Number(form.killReward) || 0,
        reward: Number(form.reward) || 0,
        roomID: form.roomID || "",
        roomPassword: form.roomPassword || "",
        imageUrl: form.imageUrl || "",
        createdAt: serverTimestamp(),
        status: "upcoming",
        playersJoined: [],
      };

      if (start) {
        payload.startTime = start;
        const revealAt = new Date(
          start.getTime() -
            (Number(form.revealDelayMinutes) || 5) * 60000
        );
        payload.revealAt = revealAt;
        payload.revealDelayMinutes =
          Number(form.revealDelayMinutes) || 5;
      }

      // -----------------------------
      // CREATE or UPDATE
      // -----------------------------
      if (editing) {
        await updateDoc(doc(db, "matches", editing.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        alert("Match updated.");
      } else {
        await addDoc(collection(db, "matches"), payload);
        alert("Match created.");
      }

      setShowCreate(false);
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save match.");
    }

    setSaving(false);
  }

  async function remove(m) {
    if (!window.confirm("Delete match?")) return;
    try {
      await deleteDoc(doc(db, "matches", m.id));
      alert("Deleted.");
    } catch (e) {
      alert("Failed to delete.");
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3>Admin Panel</h3>
        <button className="btn small" onClick={openCreate}>
          Create Match
        </button>
      </div>

      {/* Matches List */}
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
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn small" onClick={() => openEdit(m)}>
                Edit
              </button>
              <button className="btn small ghost" onClick={() => remove(m)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 700 }}
          >
            <h3>{editing ? "Edit Match" : "Create Match"}</h3>

            {/* Title */}
            <label>Match Title</label>
            <input
              className="modern-input"
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
            />

            {/* Type */}
            <label>Match Type</label>
            <select
              className="modern-input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="tournament">Tournament (BR)</option>
              <option value="custom">Custom (1v1)</option>
            </select>

            {/* Mode */}
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

            {/* Map Pool */}
            <label>Map Pool (comma separated)</label>
            <input
              className="modern-input"
              value={form.mapPool.join(",")}
              onChange={(e) =>
                setForm({
                  ...form,
                  mapPool: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />

            {/* Auto-rotate & manual */}
            <label>
              <input
                type="checkbox"
                checked={form.autoRotate}
                onChange={(e) =>
                  setForm({ ...form, autoRotate: e.target.checked })
                }
              />{" "}
              Auto-rotate maps
            </label>

            <label>Manual Map</label>
            <input
              className="modern-input"
              value={form.map}
              onChange={(e) => setForm({ ...form, map: e.target.value })}
            />

            {/* Max players */}
            <label>Max Players (2–48)</label>
            <input
              type="number"
              className="modern-input"
              min={2}
              max={48}
              value={form.maxPlayers}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxPlayers: Math.min(
                    48,
                    Math.max(2, Number(e.target.value))
                  ),
                })
              }
            />

            {/* Entry fee */}
            <label>Entry Fee</label>
            <input
              type="number"
              className="modern-input"
              value={form.entryFee}
              onChange={(e) =>
                setForm({
                  ...form,
                  entryFee: Number(e.target.value) || 0,
                })
              }
            />

            {/* Kill reward */}
            <label>Kill Reward</label>
            <input
              type="number"
              className="modern-input"
              value={form.killReward}
              onChange={(e) =>
                setForm({
                  ...form,
                  killReward: Number(e.target.value) || 0,
                })
              }
              disabled={form.type === "tournament"}
            />

            {/* Start Time */}
            <label>Start Time</label>
            <input
              type="datetime-local"
              className="modern-input"
              value={form.startTime}
              onChange={(e) =>
                setForm({ ...form, startTime: e.target.value })
              }
            />

            {/* Reveal delay */}
            <label>Reveal Delay (minutes)</label>
            <input
              type="number"
              min={1}
              max={30}
              className="modern-input"
              value={form.revealDelayMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  revealDelayMinutes: Number(e.target.value) || 5,
                })
              }
            />

            {/* Room ID */}
            <label>Room ID</label>
            <input
              className="modern-input"
              value={form.roomID}
              onChange={(e) =>
                setForm({ ...form, roomID: e.target.value })
              }
            />

            {/* Room Password */}
            <label>Room Password</label>
            <input
              className="modern-input"
              value={form.roomPassword}
              onChange={(e) =>
                setForm({ ...form, roomPassword: e.target.value })
              }
            />

            {/* Image URL */}
            <label>Match Image URL</label>
            <input
              className="modern-input"
              value={form.imageUrl}
              onChange={(e) =>
                setForm({ ...form, imageUrl: e.target.value })
              }
              placeholder="https://..."
            />

            {/* Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn small ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn small" disabled={saving} onClick={handleSave}>
                {saving ? "Saving..." : editing ? "Save Match" : "Create Match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
