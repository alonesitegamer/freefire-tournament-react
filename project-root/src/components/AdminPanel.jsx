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
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

  const [uploadingImg, setUploadingImg] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const [form, setForm] = useState({
    title: "",
    type: "tournament",
    mode: "Solo",
    teamType: "Solo",
    mapPool: DEFAULT_MAP_POOL.slice(),
    autoRotate: true,
    map: DEFAULT_MAP_POOL[0],
    maxPlayers: 4,
    entryFee: 0,
    reward: 0,
    startTime: "",
    revealDelayMinutes: 5,
    roomID: "",
    roomPassword: "",
    killReward: 75,
    imageUrl: "",
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
      maxPlayers: 4,
      entryFee: 0,
      reward: 0,
      startTime: "",
      revealDelayMinutes: 5,
      roomID: "",
      roomPassword: "",
      killReward: 75,
      imageUrl: "",
    });
    setImagePreview(null);
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
      map: m.map || DEFAULT_MAP_POOL[0],
      maxPlayers: m.maxPlayers || 4,
      entryFee: m.entryFee || 0,
      reward: m.reward || 0,
      startTime: m.startTime
        ? (m.startTime.seconds
            ? m.startTime.toDate().toISOString().slice(0, 16)
            : new Date(m.startTime).toISOString().slice(0, 16))
        : "",
      revealDelayMinutes: m.revealDelayMinutes || 5,
      roomID: m.roomID || "",
      roomPassword: m.roomPassword || "",
      killReward: m.killReward ?? (m.type === "tournament" ? 75 : 0),
      imageUrl: m.imageUrl || "",
    });
    setImagePreview(m.imageUrl || null);
    setShowCreate(true);
  }

  async function uploadImage(file) {
    if (!file) return null;

    setUploadingImg(true);
    try {
      const fileRef = ref(storage, `matchImages/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return url;
    } catch (err) {
      console.error("Image upload error", err);
      alert("Failed to upload image.");
      return null;
    } finally {
      setUploadingImg(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      let imageUrl = form.imageUrl;

      // if a NEW file selected
      const fileInput = document.getElementById("match-image-input");
      if (fileInput?.files?.length > 0) {
        const f = fileInput.files[0];
        const uploaded = await uploadImage(f);
        if (uploaded) imageUrl = uploaded;
      }

      if (!imageUrl) {
        alert("Please upload a match image.");
        setSaving(false);
        return;
      }

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
        revealDelayMinutes: Number(form.revealDelayMinutes),
        roomID: form.roomID,
        roomPassword: form.roomPassword,
        imageUrl,
        createdAt: serverTimestamp(),
        status: "upcoming",
        playersJoined: [],
      };

      if (form.startTime) {
        const start = new Date(form.startTime);
        payload.startTime = start;
        payload.revealAt = new Date(start - form.revealDelayMinutes * 60000);
      }

      if (editing) {
        await updateDoc(doc(db, "matches", editing.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        const refC = collection(db, "matches");
        const added = await addDoc(refC, payload);
        setLocalMatches((m) => [{ id: added.id, ...payload }, ...m]);
      }

      alert("Match saved!");
      setShowCreate(false);
    } catch (e) {
      console.error("save error", e);
      alert("Failed to save match.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m) {
    if (!window.confirm("Delete this match?")) return;
    try {
      await deleteDoc(doc(db, "matches", m.id));
      setLocalMatches((l) => l.filter((x) => x.id !== m.id));
    } catch (err) {
      alert("Failed to delete.");
    }
  }

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3>Admin Panel</h3>
        <button className="btn small" onClick={openCreate}>Create Match</button>
      </div>

      {/* Topup / Withdraw remain unchanged */}
      {/* MATCH LIST */}
      <h4 style={{ marginTop: 16 }}>Matches</h4>
      {localMatches.length === 0 ? (
        <p className="muted-small">No matches.</p>
      ) : (
        localMatches.map((m) => (
          <div key={m.id} className="admin-row">
            <div>
              <strong>{m.title}</strong>
              <div className="small-muted">
                {m.type} • {m.mode} • {m.maxPlayers} players
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn small" onClick={() => openEdit(m)}>
                Edit
              </button>
              <button className="btn small ghost" onClick={() => handleDelete(m)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      {/* CREATE / EDIT MODAL */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <h3>{editing ? "Edit Match" : "Create Match"}</h3>

            {/* MATCH IMAGE UPLOADER */}
            <label>Match Image</label>
            <input
              id="match-image-input"
              type="file"
              accept="image/*"
              className="modern-input"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) {
                  setImagePreview(URL.createObjectURL(f));
                }
              }}
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="preview"
                style={{ width: "100%", borderRadius: 10, marginTop: 8 }}
              />
            )}

            {/* REST OF THE FORM (unchanged) */}
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
              <option value="tournament">Tournament</option>
              <option value="custom">Custom</option>
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
              onChange={(e) =>
                setForm({ ...form, entryFee: Number(e.target.value) })
              }
            />

            <label>Kill Reward</label>
            <input
              type="number"
              className="modern-input"
              value={form.killReward}
              onChange={(e) =>
                setForm({ ...form, killReward: Number(e.target.value) })
              }
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
              min="1"
              max="30"
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
              onChange={(e) => setForm({ ...form, roomID: e.target.value })}
            />

            <label>Room Password</label>
            <input
              className="modern-input"
              value={form.roomPassword}
              onChange={(e) =>
                setForm({ ...form, roomPassword: e.target.value })
              }
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button className="btn small ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn small" onClick={handleSave} disabled={saving || uploadingImg}>
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
