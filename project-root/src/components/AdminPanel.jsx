import React, { useEffect, useState } from "react";
import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "./AdminPanel.css";

const DEFAULT_MAP_POOL = ["Bermuda", "Purgatory", "Kalahari"];
const AVAILABLE_IMAGES = ["FF1", "FF2", "FF4", "FF5", "FF6"];

export default function AdminPanel({
  matches = [],
  createMatch = () => {},
  editMatch = () => {},
  deleteMatch = () => {},
}) {
  const [localMatches, setLocalMatches] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    title: "",
    type: "tournament",
    mode: "Solo",
    mapPool: DEFAULT_MAP_POOL,
    maxPlayers: 4,
    entryFee: 0,
    reward: 0,
    killReward: 75,
    startTime: "",
    revealDelayMinutes: 5,
    roomID: "",
    roomPassword: "",
    imageUrls: [],
  });

  useEffect(() => {
    setLocalMatches(matches || []);
  }, [matches]);

  // -----------------------------
  // OPEN CREATE
  // -----------------------------
  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      type: "tournament",
      mode: "Solo",
      mapPool: DEFAULT_MAP_POOL,
      maxPlayers: 4,
      entryFee: 0,
      reward: 0,
      killReward: 75,
      startTime: "",
      revealDelayMinutes: 5,
      roomID: "",
      roomPassword: "",
      imageUrls: [],
    });
    setShowCreate(true);
  }

  // -----------------------------
  // OPEN EDIT
  // -----------------------------
  function openEdit(m) {
    setEditing(m);
    setForm({
      title: m.title || "",
      type: m.type || "tournament",
      mode: m.mode || "Solo",
      mapPool: m.mapPool || DEFAULT_MAP_POOL,
      maxPlayers: m.maxPlayers || 4,
      entryFee: m.entryFee || 0,
      reward: m.reward || 0,
      killReward: m.killReward ?? 75,
      startTime: m.startTime
        ? new Date(
            m.startTime.seconds
              ? m.startTime.toDate()
              : m.startTime
          )
            .toISOString()
            .slice(0, 16)
        : "",
      revealDelayMinutes: m.revealDelayMinutes || 5,
      roomID: m.roomID || "",
      roomPassword: m.roomPassword || "",
      imageUrls: m.imageUrls || [],
    });
    setShowCreate(true);
  }

  // -----------------------------
  // SAVE MATCH
  // -----------------------------
  async function handleSave() {
    setSaving(true);

    try {
      const payload = {
        title: form.title,
        type: form.type,
        mode: form.mode,
        mapPool: form.mapPool,
        maxPlayers: Number(form.maxPlayers),
        entryFee: Number(form.entryFee),
        reward: Number(form.reward),
        killReward: Number(form.killReward),
        roomID: form.roomID,
        roomPassword: form.roomPassword,
        imageUrls: form.imageUrls,
        status: "upcoming",
        playersJoined: [],
        createdAt: serverTimestamp(),
      };

      if (form.startTime) {
        const start = new Date(form.startTime);
        payload.startTime = start;
        payload.revealDelayMinutes = Number(form.revealDelayMinutes);
        payload.revealAt = new Date(
          start.getTime() -
            payload.revealDelayMinutes * 60 * 1000
        );
      }

      if (editing) {
        const ref = doc(db, "matches", editing.id);

        // existing data
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          alert("Match not found");
          return;
        }

        const existing = snap.data();

        // merge payload + playersJoined
        await updateDoc(ref, {
          ...payload,
          playersJoined: existing.playersJoined || [],
        });
        
        await editMatch(editing.id, payload);
      } else {
        await createMatch(payload);
      }

      setShowCreate(false);
      alert("Match saved successfully!");
    } catch (e) {
      alert("Save failed: " + e.message);
    }

    setSaving(false);
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <section className="panel admin-panel">
      <div className="admin-header">
        <h3>Admin Panel</h3>
        <button className="btn small" onClick={openCreate}>
          Create Match
        </button>
      </div>

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
              <button
                className="btn small"
                onClick={() => openEdit(m)}
              >
                Edit
              </button>
              <button
                className="btn small ghost"
                onClick={() => deleteMatch(m.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      {showCreate && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="modal-content admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editing ? "Edit Match" : "Create Match"}</h3>

            {/* IMAGE PICKER */}
            <label>Match Images</label>
            <div className="image-picker-grid">
              {AVAILABLE_IMAGES.map((name) => {
                const src = `/match/${name}.jpeg`;
                const selected = form.imageUrls.includes(src);

                return (
                  <div
                    key={name}
                    className={`image-picker-item ${
                      selected ? "selected" : ""
                    }`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        imageUrls: selected
                          ? prev.imageUrls.filter(
                              (u) => u !== src
                            )
                          : [...prev.imageUrls, src],
                      }))
                    }
                  >
                    <img src={src} alt={name} />
                    <span>{name}</span>
                  </div>
                );
              })}
            </div>

            <label>Title</label>
            <input
              className="modern-input"
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
            />

            <label>Type</label>
            <select
              className="modern-input"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value })
              }
            >
              <option value="tournament">Tournament (BR)</option>
              <option value="custom">Custom</option>
            </select>

            <label>Mode</label>
            <select
              className="modern-input"
              value={form.mode}
              onChange={(e) =>
                setForm({ ...form, mode: e.target.value })
              }
            >
              <option>Solo</option>
              <option>Duo</option>
              <option>Squad</option>
            </select>

            <label>Map Pool</label>
            <input
              className="modern-input"
              value={form.mapPool.join(", ")}
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

            <label>Max Players</label>
            <input
              type="number"
              min="2"
              max="48"
              className="modern-input"
              value={form.maxPlayers}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxPlayers: Number(e.target.value),
                })
              }
            />

            <label>Entry Fee</label>
            <input
              type="number"
              className="modern-input"
              value={form.entryFee}
              onChange={(e) =>
                setForm({
                  ...form,
                  entryFee: Number(e.target.value),
                })
              }
            />

            <label>Kill Reward</label>
            <input
              type="number"
              className="modern-input"
              value={form.killReward}
              onChange={(e) =>
                setForm({
                  ...form,
                  killReward: Number(e.target.value),
                })
              }
            />

            <label>Start Time</label>
            <input
              type="datetime-local"
              className="modern-input"
              value={form.startTime}
              onChange={(e) =>
                setForm({
                  ...form,
                  startTime: e.target.value,
                })
              }
            />

            <label>Reveal Delay (minutes)</label>
            <input
              type="number"
              className="modern-input"
              value={form.revealDelayMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  revealDelayMinutes: Number(e.target.value),
                })
              }
            />

            <label>Room ID</label>
            <input
              className="modern-input"
              value={form.roomID}
              onChange={(e) =>
                setForm({ ...form, roomID: e.target.value })
              }
            />

            <label>Room Password</label>
            <input
              className="modern-input"
              value={form.roomPassword}
              onChange={(e) =>
                setForm({
                  ...form,
                  roomPassword: e.target.value,
                })
              }
            />

            <div className="admin-modal-actions">
              <button
                className="btn small ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="btn small"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : editing ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
