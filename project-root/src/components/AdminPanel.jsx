// src/components/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * AdminPanel
 *
 * Features:
 * - View matches list (from Firestore)
 * - Create match (form)
 * - Edit match
 * - Delete match
 * - Separate "Add Room Details" action (roomId + roomPassword, revealed 2-5 minutes before match)
 * - Auto-rotate map system (bermuda -> purgatory -> kalahari). Manual override allowed.
 * - Tournament mode: kills => 75 coins (enforced)
 * - Custom mode: admin can set custom kill reward
 * - Validates maxPlayers (2..48)
 */

const MAP_POOL = ["bermuda", "purgatory", "kalahari"];

// Final fixed rules text (the global rules you provided)
const GLOBAL_RULES = `Tournament Format

Modes: Solo, Duo, Squad

Map Pool: Bermuda, Purgatory, Kalahari (rotating)

Point System:

No placement points.

Kills Only: 1 Kill = 75 Coins

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

All participants automatically accept the rules upon joining.`;

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null); // match id being edited
  const [showRoomModal, setShowRoomModal] = useState(null); // match id for room details modal

  // form state for create/edit
  const defaultForm = {
    title: "",
    mode: "custom", // custom, tournament, solo, duo, squad
    entryFee: 0,
    time: "", // ISO string / datetime-local
    maxPlayers: 16,
    map: "auto", // 'auto' or map name
    autoRotate: true,
    killReward: 0, // for custom mode
    cover: "/covers/default.jpg",
    rules: GLOBAL_RULES,
    status: "upcoming",
  };
  const [form, setForm] = useState(defaultForm);

  // room form
  const [roomForm, setRoomForm] = useState({ roomId: "", roomPassword: "" });

  useEffect(() => {
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMatches() {
    setLoading(true);
    try {
      const col = collection(db, "matches");
      const q = query(col, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMatches(arr);
    } catch (err) {
      console.error("loadMatches", err);
      alert("Failed to load matches.");
    } finally {
      setLoading(false);
    }
  }

  // Determine next map index for auto-rotate: looks at last created match with a defined map
  async function computeNextMap() {
    try {
      // query latest match that has a map set (createdAt desc)
      const col = collection(db, "matches");
      const q = query(col, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => d.data()).filter(Boolean);
      if (!docs || docs.length === 0) return MAP_POOL[0];
      // find last match map that is in pool (skip 'auto' entries)
      const lastUsed = docs.find((m) => m.map && MAP_POOL.includes(String(m.map).toLowerCase()));
      let lastMap = lastUsed ? String(lastUsed.map).toLowerCase() : MAP_POOL[0];
      const idx = MAP_POOL.indexOf(lastMap);
      const next = MAP_POOL[(idx + 1) % MAP_POOL.length];
      return next;
    } catch (err) {
      console.warn("computeNextMap error", err);
      return MAP_POOL[0];
    }
  }

  function resetForm() {
    setForm({ ...defaultForm });
  }

  // Validate form before create/update
  function validateForm(f) {
    if (!f.title || f.title.trim().length < 2) return "Enter a title";
    if (!f.time) return "Select date/time";
    const mp = Number(f.maxPlayers) || 0;
    if (mp < 2 || mp > 48) return "maxPlayers must be between 2 and 48";
    if (f.mode === "custom") {
      const kr = Number(f.killReward);
      if (!kr || kr <= 0) return "Set a valid kill reward for custom mode";
    }
    return null;
  }

  async function handleCreate(e) {
    e && e.preventDefault();
    const err = validateForm(form);
    if (err) return alert(err);

    try {
      // enforce tournament kill reward
      const payload = { ...form };
      if (payload.mode === "tournament") {
        payload.killReward = 75; // enforced
      } else if (payload.mode !== "custom") {
        // default for modes (solo/duo/squad) we set 75 for tournament only, others can have 0 or custom value
        payload.killReward = payload.killReward || 0;
      }

      // handle auto-rotate: if autoRotate true, compute next map and set as 'map' value unless admin chose manual map
      if (payload.autoRotate && (payload.map === "auto" || !MAP_POOL.includes(payload.map))) {
        payload.map = await computeNextMap();
      } else if (payload.map === "auto") {
        // if autoRotate false but map==='auto', pick first pool map
        payload.map = MAP_POOL[0];
      }

      payload.maxPlayers = Number(payload.maxPlayers);
      payload.entryFee = Number(payload.entryFee) || 0;
      payload.createdAt = serverTimestamp();

      const col = collection(db, "matches");
      await addDoc(col, payload);
      resetForm();
      setShowCreate(false);
      await loadMatches();
      alert("Match created.");
    } catch (err) {
      console.error("create match", err);
      alert("Failed to create match.");
    }
  }

  async function openEdit(match) {
    // clone match into form
    const copy = { ...match };
    // if this match map is in pool but original was created with auto-rotate we still allow edit
    setForm({
      title: copy.title || "",
      mode: copy.mode || "custom",
      entryFee: copy.entryFee || 0,
      time: copy.time || "",
      maxPlayers: copy.maxPlayers || 16,
      map: copy.map || "auto",
      autoRotate: !!copy.autoRotate,
      killReward: copy.killReward || 0,
      cover: copy.cover || "/covers/default.jpg",
      rules: copy.rules || GLOBAL_RULES,
      status: copy.status || "upcoming",
    });
    setShowEdit(match.id);
  }

  async function handleUpdate(e) {
    e && e.preventDefault();
    if (!showEdit) return;
    const err = validateForm(form);
    if (err) return alert(err);

    try {
      const ref = doc(db, "matches", showEdit);
      const payload = { ...form };
      if (payload.mode === "tournament") payload.killReward = 75;
      payload.maxPlayers = Number(payload.maxPlayers);
      payload.entryFee = Number(payload.entryFee) || 0;
      payload.updatedAt = serverTimestamp();

      // if autoRotate true and map is 'auto' or not in pool, compute next map
      if (payload.autoRotate && (payload.map === "auto" || !MAP_POOL.includes(payload.map))) {
        payload.map = await computeNextMap();
      } else if (payload.map === "auto") {
        payload.map = MAP_POOL[0];
      }

      await updateDoc(ref, payload);
      setShowEdit(null);
      resetForm();
      await loadMatches();
      alert("Match updated.");
    } catch (err) {
      console.error("update match", err);
      alert("Failed to update match.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete match? This is permanent.")) return;
    try {
      await deleteDoc(doc(db, "matches", id));
      await loadMatches();
      alert("Match deleted.");
    } catch (err) {
      console.error("delete match", err);
      alert("Failed to delete match.");
    }
  }

  // open room modal (separate workflow per your choice B)
  function openRoomDetails(match) {
    setShowRoomModal(match.id);
    setRoomForm({ roomId: match.roomId || "", roomPassword: match.roomPassword || "" });
  }

  async function saveRoomDetails(e) {
    e && e.preventDefault();
    if (!showRoomModal) return;
    try {
      await updateDoc(doc(db, "matches", showRoomModal), {
        roomId: roomForm.roomId || null,
        roomPassword: roomForm.roomPassword || null,
        roomUpdatedAt: serverTimestamp(),
      });
      setShowRoomModal(null);
      await loadMatches();
      alert("Room details saved.");
    } catch (err) {
      console.error("save room", err);
      alert("Failed to save room details.");
    }
  }

  // small UI helpers
  function modeRequiresKillReward(mode) {
    return mode === "custom";
  }

  // Render
  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3>Admin Panel — Matches</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => { setShowCreate(true); resetForm(); }}>Create Match</button>
          <button className="btn ghost" onClick={() => loadMatches()}>Refresh</button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h4>Existing Matches</h4>
        {loading ? <p className="muted-small">Loading...</p> : (
          matches.length === 0 ? <p className="muted-small">No matches created.</p> : (
            <div className="admin-match-list">
              {matches.map((m) => (
                <div key={m.id} className="admin-row" style={{ alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{m.title} <span style={{ color: "var(--muted)", fontSize: 12 }}>({m.mode})</span></div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
                      Map: <strong>{m.map}</strong> • Max: <strong>{m.maxPlayers}</strong> • Entry: <strong>₹{m.entryFee}</strong> • Kill Reward: <strong>{m.killReward || 0}</strong>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
                      Room: {m.roomId ? <span> {m.roomId} / <small>{m.roomPassword || "-"}</small></span> : <em>Not revealed</em>}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <small className="muted-small">{m.rules ? (m.rules.length > 160 ? m.rules.slice(0, 160) + "…" : m.rules) : "No rules"}</small>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                    <button className="btn small" onClick={() => openEdit(m)}>Edit</button>
                    <button className="btn small ghost" onClick={() => openRoomDetails(m)}>{m.roomId ? "Update Room" : "Add Room Details"}</button>
                    <button className="btn small ghost" onClick={() => handleDelete(m.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Create Match</h3>
            <form className="admin-form" onSubmit={handleCreate}>
              <label>Title</label>
              <input className="modern-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

              <label>Mode</label>
              <select className="modern-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="custom">Custom (1v1 / special)</option>
                <option value="tournament">Tournament (BR)</option>
                <option value="solo">Solo</option>
                <option value="duo">Duo</option>
                <option value="squad">Squad</option>
              </select>

              <label>Entry Fee (₹)</label>
              <input type="number" min="0" className="modern-input" value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: e.target.value })} />

              <label>Scheduled Time</label>
              <input type="datetime-local" className="modern-input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />

              <label>Max Players (2 - 48)</label>
              <input type="number" min="2" max="48" className="modern-input" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: e.target.value })} />

              <label>Map</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="modern-input" value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })}>
                  <option value="auto">Auto (use rotation)</option>
                  {MAP_POOL.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <label style={{ alignSelf: "center", display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={form.autoRotate} onChange={(e) => setForm({ ...form, autoRotate: e.target.checked })} />
                  Auto-rotate
                </label>
              </div>

              {modeRequiresKillReward(form.mode) && (
                <>
                  <label>Kill Reward (coins) — Custom mode</label>
                  <input type="number" min="1" className="modern-input" value={form.killReward} onChange={(e) => setForm({ ...form, killReward: e.target.value })} />
                </>
              )}

              <label>Cover image (url)</label>
              <input className="modern-input" value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} />

              <label>Rules (editable)</label>
              <textarea className="modern-input" rows={6} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn small ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn small" type="submit">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => { setShowEdit(null); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Edit Match</h3>
            <form className="admin-form" onSubmit={handleUpdate}>
              <label>Title</label>
              <input className="modern-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

              <label>Mode</label>
              <select className="modern-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="custom">Custom (1v1 / special)</option>
                <option value="tournament">Tournament (BR)</option>
                <option value="solo">Solo</option>
                <option value="duo">Duo</option>
                <option value="squad">Squad</option>
              </select>

              <label>Entry Fee (₹)</label>
              <input type="number" min="0" className="modern-input" value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: e.target.value })} />

              <label>Scheduled Time</label>
              <input type="datetime-local" className="modern-input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />

              <label>Max Players (2 - 48)</label>
              <input type="number" min="2" max="48" className="modern-input" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: e.target.value })} />

              <label>Map</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="modern-input" value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })}>
                  <option value="auto">Auto (use rotation)</option>
                  {MAP_POOL.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <label style={{ alignSelf: "center", display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={form.autoRotate} onChange={(e) => setForm({ ...form, autoRotate: e.target.checked })} />
                  Auto-rotate
                </label>
              </div>

              {modeRequiresKillReward(form.mode) && (
                <>
                  <label>Kill Reward (coins) — Custom mode</label>
                  <input type="number" min="1" className="modern-input" value={form.killReward} onChange={(e) => setForm({ ...form, killReward: e.target.value })} />
                </>
              )}

              <label>Cover image (url)</label>
              <input className="modern-input" value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} />

              <label>Rules (editable)</label>
              <textarea className="modern-input" rows={6} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn small ghost" onClick={() => { setShowEdit(null); resetForm(); }}>Cancel</button>
                <button className="btn small" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROOM DETAILS MODAL (separate workflow B) */}
      {showRoomModal && (
        <div className="modal-overlay" onClick={() => setShowRoomModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Add / Update Room Details</h3>
            <form className="admin-form" onSubmit={saveRoomDetails}>
              <label>Room ID</label>
              <input className="modern-input" value={roomForm.roomId} onChange={(e) => setRoomForm({ ...roomForm, roomId: e.target.value })} />
              <label>Room Password</label>
              <input className="modern-input" value={roomForm.roomPassword} onChange={(e) => setRoomForm({ ...roomForm, roomPassword: e.target.value })} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn small ghost" type="button" onClick={() => setShowRoomModal(null)}>Cancel</button>
                <button className="btn small" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
