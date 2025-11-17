// src/components/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const DEFAULT_RULES = `Tournament Format

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

const MAP_POOL = ["Bermuda", "Purgatory", "Kalahari"];

export default function AdminPanel({
  requests = { topup: [], withdraw: [] },
  approveRequest = () => {},
  rejectRequest = () => {},
  matches: matchesProp = [],
}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // form fields
  const [form, setForm] = useState({
    title: "",
    mode: "Solo",
    category: "Tournament",
    map: "Bermuda",
    autoRotate: false,
    maxPlayersFixed: true,
    maxPlayers: 4,
    customMaxPlayers: 16,
    entryFee: 0,
    prize: 0,
    startAt: "", // ISO string or datetime-local value
    roomId: "Will be given 2–5 minutes before match",
    roomPassword: "Will be given 2–5 minutes before match",
    rules: DEFAULT_RULES,
  });

  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("startAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMatches(arr);
      setLoading(false);
    }, (err) => {
      console.error("matches snapshot error", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // helper to reset modal form
  function resetForm() {
    setEditingId(null);
    setForm({
      title: "",
      mode: "Solo",
      category: "Tournament",
      map: "Bermuda",
      autoRotate: false,
      maxPlayersFixed: true,
      maxPlayers: 4,
      customMaxPlayers: 16,
      entryFee: 0,
      prize: 0,
      startAt: "",
      roomId: "Will be given 2–5 minutes before match",
      roomPassword: "Will be given 2–5 minutes before match",
      rules: DEFAULT_RULES,
    });
  }

  async function getAndAdvanceRotationIndex() {
    const ref = doc(db, "settings", "mapRotation");
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // create initial doc
      await setDoc(ref, { index: 0, pool: MAP_POOL });
      return { map: MAP_POOL[0], newIndex: 1 };
    }
    const data = snap.data();
    const idx = typeof data.index === "number" ? data.index : 0;
    const pool = Array.isArray(data.pool) && data.pool.length ? data.pool : MAP_POOL;
    const map = pool[idx % pool.length];
    const newIndex = (idx + 1) % pool.length;
    // write back new index
    await updateDoc(ref, { index: newIndex, pool });
    return { map, newIndex };
  }

  async function handleCreateOrUpdate(e) {
    e.preventDefault();
    // validation
    if (!form.title) return alert("Please enter a title");
    if (isNaN(Number(form.entryFee))) return alert("Entry fee must be a number");
    if (isNaN(Number(form.prize))) return alert("Prize must be a number");

    // determine map
    let selectedMap = form.map;
    if (form.autoRotate) {
      try {
        const r = await getAndAdvanceRotationIndex();
        selectedMap = r.map;
      } catch (err) {
        console.error("rotation error", err);
        // fallback to chosen map
        selectedMap = form.map || MAP_POOL[0];
      }
    }

    const payload = {
      title: form.title,
      mode: form.mode,
      category: form.category,
      map: selectedMap,
      autoRotate: !!form.autoRotate,
      maxPlayers: form.maxPlayersFixed ? Number(form.maxPlayers) : Number(form.customMaxPlayers),
      entryFee: Number(form.entryFee || 0),
      prize: Number(form.prize || 0),
      startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
      roomId: form.roomId || null,
      roomPassword: form.roomPassword || null,
      rules: form.rules || DEFAULT_RULES,
      createdAt: new Date().toISOString(),
      // optional counters
      playersJoined: 0,
    };

    try {
      if (editingId) {
        const dref = doc(db, "matches", editingId);
        await updateDoc(dref, payload);
        alert("Match updated");
      } else {
        await addDoc(collection(db, "matches"), payload);
        alert("Match created");
      }
      resetForm();
      setShowModal(false);
    } catch (err) {
      console.error("create/update match error", err);
      alert("Failed to save match");
    }
  }

  async function handleEdit(match) {
    setEditingId(match.id);
    setForm({
      title: match.title || "",
      mode: match.mode || "Solo",
      category: match.category || "Tournament",
      map: match.map || MAP_POOL[0],
      autoRotate: !!match.autoRotate,
      maxPlayersFixed: true,
      maxPlayers: match.maxPlayers || 4,
      customMaxPlayers: match.maxPlayers || 16,
      entryFee: match.entryFee ?? 0,
      prize: match.prize ?? 0,
      startAt: match.startAt ? new Date(match.startAt).toISOString().slice(0, 16) : "",
      roomId: match.roomId || "Will be given 2–5 minutes before match",
      roomPassword: match.roomPassword || "Will be given 2–5 minutes before match",
      rules: match.rules || DEFAULT_RULES,
    });
    setShowModal(true);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this match? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "matches", id));
      alert("Match deleted");
    } catch (err) {
      console.error("delete match error", err);
      alert("Failed to delete");
    }
  }

  // helper to toggle manual override of map for a match (admin convenience)
  async function overrideMap(matchId, newMap) {
    try {
      await updateDoc(doc(db, "matches", matchId), { map: newMap, autoRotate: false });
      alert("Map updated");
    } catch (err) {
      console.error("override map error", err);
      alert("Failed to update map");
    }
  }

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Admin Panel</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            Create Match
          </button>
        </div>
      </div>

      <h4 style={{ marginTop: 12 }}>Top-up Requests</h4>
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

      <h4 style={{ marginTop: 18 }}>Matches</h4>
      {loading ? (
        <p className="muted-small">Loading matches…</p>
      ) : matches.length === 0 ? (
        <p className="muted-small">No matches created.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th style={{ padding: "8px 6px" }}>Title</th>
                <th>Mode</th>
                <th>Map</th>
                <th>Entry (₹)</th>
                <th>Prize (₹)</th>
                <th>Start</th>
                <th>Players</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "10px 6px", fontWeight: 700 }}>{m.title}</td>
                  <td style={{ padding: "10px 6px" }}>{m.mode}</td>
                  <td style={{ padding: "10px 6px" }}>
                    {m.map} {m.autoRotate ? <span style={{ opacity: 0.7, fontSize: 12 }}>(auto)</span> : null}
                  </td>
                  <td style={{ padding: "10px 6px" }}>{m.entryFee ?? 0}</td>
                  <td style={{ padding: "10px 6px" }}>{m.prize ?? 0}</td>
                  <td style={{ padding: "10px 6px" }}>{m.startAt ? new Date(m.startAt).toLocaleString() : "TBD"}</td>
                  <td style={{ padding: "10px 6px" }}>{m.playersJoined ?? 0} / {m.maxPlayers ?? "-"}</td>
                  <td style={{ padding: "10px 6px", display: "flex", gap: 8 }}>
                    <button className="btn small" onClick={() => handleEdit(m)}>Edit</button>
                    <button className="btn small ghost" onClick={() => handleDelete(m.id)}>Delete</button>
                    <div style={{ display: "flex", gap: 6 }}>
                      {/* quick map override */}
                      <select
                        value={m.map}
                        onChange={(e) => overrideMap(m.id, e.target.value)}
                        style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.05)", padding: "6px", borderRadius: 8 }}
                      >
                        {MAP_POOL.map((mp) => <option key={mp} value={mp}>{mp}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820 }}>
            <h3 className="modern-title">{editingId ? "Edit Match" : "Create Match"}</h3>
            <form onSubmit={handleCreateOrUpdate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  className="modern-input"
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                  required
                />
                <select className="modern-input" value={form.mode} onChange={(e) => setForm((s) => ({ ...s, mode: e.target.value }))}>
                  <option>Solo</option>
                  <option>Duo</option>
                  <option>Squad</option>
                  <option>Custom</option>
                  <option>Tournament</option>
                </select>

                <select className="modern-input" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}>
                  <option value="Tournament">Tournament</option>
                  <option value="Custom">Custom</option>
                  <option value="Classic">Classic</option>
                </select>

                <div style={{ display: "flex", gap: 8 }}>
                  <select className="modern-input" value={form.map} onChange={(e) => setForm((s) => ({ ...s, map: e.target.value }))} style={{ flex: 1 }}>
                    {MAP_POOL.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={form.autoRotate} onChange={(e) => setForm((s) => ({ ...s, autoRotate: e.target.checked }))} />
                    Auto-rotate
                  </label>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="radio" checked={form.maxPlayersFixed} onChange={() => setForm((s) => ({ ...s, maxPlayersFixed: true }))} />
                    Fixed
                  </label>
                  <select className="modern-input" value={form.maxPlayers} onChange={(e) => setForm((s) => ({ ...s, maxPlayers: e.target.value }))} style={{ flex: 1 }}>
                    {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="radio" checked={!form.maxPlayersFixed} onChange={() => setForm((s) => ({ ...s, maxPlayersFixed: false }))} />
                    Custom
                  </label>
                  <input className="modern-input" type="number" min={1} max={500} value={form.customMaxPlayers} onChange={(e) => setForm((s) => ({ ...s, customMaxPlayers: e.target.value }))} style={{ flex: 1 }} />
                </div>

                <input className="modern-input" type="number" placeholder="Entry Fee (number)" value={form.entryFee} onChange={(e) => setForm((s) => ({ ...s, entryFee: e.target.value }))} />
                <input className="modern-input" type="number" placeholder="Prize (number)" value={form.prize} onChange={(e) => setForm((s) => ({ ...s, prize: e.target.value }))} />

                <input className="modern-input" type="datetime-local" value={form.startAt} onChange={(e) => setForm((s) => ({ ...s, startAt: e.target.value }))} />
                <input className="modern-input" placeholder="Room ID (or leave default)" value={form.roomId} onChange={(e) => setForm((s) => ({ ...s, roomId: e.target.value }))} />

                <input className="modern-input" placeholder="Room Password" value={form.roomPassword} onChange={(e) => setForm((s) => ({ ...s, roomPassword: e.target.value }))} />
                <textarea className="modern-input" placeholder="Rules" value={form.rules} onChange={(e) => setForm((s) => ({ ...s, rules: e.target.value }))} style={{ minHeight: 120, gridColumn: "1 / -1" }} />

              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button type="button" className="btn small ghost" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
                <button className="btn small" type="submit">{editingId ? "Save changes" : "Create Match"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
