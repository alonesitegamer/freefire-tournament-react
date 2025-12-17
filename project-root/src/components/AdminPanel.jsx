import React, { useState, useEffect } from "react";
import {
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
  const [localMatches, setLocalMatches] = useState([]);
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
    imageFiles: [],   // File objects (preview only)
    imageUrls: [],    // Stored paths
  });

  useEffect(() => {
    setLocalMatches(matches || []);
  }, [matches]);

  // -----------------------------
  // IMAGE HANDLER (NO UPLOAD)
  // -----------------------------
  function handleImageSelect(e) {
    const files = Array.from(e.target.files || []);

    const urls = files.map(
      (file) => `/match/${file.name.replace(/\.[^/.]+$/, "")}.jpeg`
    );

    setForm((prev) => ({
      ...prev,
      imageFiles: files,
      imageUrls: urls,
    }));
  }

  // -----------------------------
  // OPEN CREATE
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
      imageFiles: [],
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
      mapPool: m.mapPool || DEFAULT_MAP_POOL.slice(),
      autoRotate: m.autoRotate ?? true,
      map: m.map || DEFAULT_MAP_POOL[0],
      maxPlayers: m.maxPlayers || 4,
      entryFee: m.entryFee || 0,
      reward: m.reward || 0,
      killReward: m.killReward ?? 75,
      startTime: m.startTime
        ? new Date(m.startTime.seconds ? m.startTime.toDate() : m.startTime)
            .toISOString()
            .slice(0, 16)
        : "",
      revealDelayMinutes: m.revealDelayMinutes || 5,
      roomID: m.roomID || "",
      roomPassword: m.roomPassword || "",
      imageFiles: [],
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
        autoRotate: form.autoRotate,
        map: form.map,
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
        payload.revealDelayMinutes = Number(form.revealDelayMinutes || 5);
        payload.revealAt = new Date(
          start.getTime() - payload.revealDelayMinutes * 60000
        );
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
              <button className="btn small" onClick={() => openEdit(m)}>
                Edit
              </button>
              <button
                className="btn small ghost"
                onClick={() => handleDelete(m)}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div
            className="modal-content admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editing ? "Edit Match" : "Create Match"}</h3>

            <label>Match Images (FF1, FF2…)</label>
            <input
              type="file"
              multiple
              accept="image/jpeg"
              className="modern-input"
              onChange={handleImageSelect}
            />

            {(form.imageFiles.length > 0 || form.imageUrls.length > 0) && (
              <div className="image-preview-row">
                {(form.imageFiles.length > 0
                  ? form.imageFiles.map((f) =>
                      URL.createObjectURL(f)
                    )
                  : form.imageUrls
                ).map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt="preview"
                    style={{
                      width: 120,
                      height: 70,
                      objectFit: "cover",
                      borderRadius: 8,
                      marginRight: 8,
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  />
                ))}
              </div>
            )}

            <label>Title</label>
            <input
              className="modern-input"
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
            />

            <label>Start Time</label>
            <input
              type="datetime-local"
              className="modern-input"
              value={form.startTime}
              onChange={(e) =>
                setForm({ ...form, startTime: e.target.value })
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
