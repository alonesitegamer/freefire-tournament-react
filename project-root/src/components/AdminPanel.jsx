import React, { useEffect, useState } from "react";
import { secureApi } from "../utils/apiClient";
import "./AdminPanel.css";

const DEFAULT_MAP_POOL = ["Bermuda", "Purgatory", "Kalahari"];
const AVAILABLE_IMAGES = ["FF1", "FF2", "FF4", "FF5", "FF6"];

export default function AdminPanel({ matches = [], createMatch, editMatch, deleteMatch, requests = { topup: [], withdraw: [] }, onRefreshRequests = () => {} }) {
  const [localMatches, setLocalMatches] = useState(matches);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [form, setForm] = useState({ title: "", type: "tournament", mode: "Solo", mapPool: DEFAULT_MAP_POOL, maxPlayers: 4, entryFee: 0, reward: 0, killReward: 75, startTime: "", revealDelayMinutes: 5, roomID: "", roomPassword: "", imageUrls: [] });

  useEffect(() => setLocalMatches(matches), [matches]);

  function openCreate() {
    setEditing(null);
    setForm({ title: "", type: "tournament", mode: "Solo", mapPool: DEFAULT_MAP_POOL, maxPlayers: 4, entryFee: 0, reward: 0, killReward: 75, startTime: "", revealDelayMinutes: 5, roomID: "", roomPassword: "", imageUrls: [] });
    setShowForm(true);
  }

  function openEdit(match) {
    setEditing(match);
    setForm({ title: match.title || "", type: match.type || "tournament", mode: match.mode || "Solo", mapPool: match.mapPool || DEFAULT_MAP_POOL, maxPlayers: match.maxPlayers || 4, entryFee: match.entryFee || 0, reward: match.reward || 0, killReward: match.killReward ?? 75, startTime: match.startTime ? new Date(match.startTime).toISOString().slice(0, 16) : "", revealDelayMinutes: match.revealDelayMinutes || 5, roomID: "", roomPassword: "", imageUrls: match.imageUrls || [] });
    setShowForm(true);
  }

  async function save() {
    if (!form.title.trim()) return alert("Match title is required.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        maxPlayers: Number(form.maxPlayers), entryFee: Number(form.entryFee), reward: Number(form.reward), killReward: Number(form.killReward),
        revealDelayMinutes: Number(form.revealDelayMinutes),
        startTime: form.startTime || null,
      };
      if (editing) await editMatch(editing.id, payload);
      else await createMatch(payload);
      setShowForm(false);
    } catch (error) { alert(error.message || "Unable to save match"); }
    finally { setSaving(false); }
  }

  async function process(type, requestId, approve) {
    const key = `${type}:${requestId}:${approve}`;
    setProcessing(key);
    try {
      await secureApi("/api/economy", { method: "POST", body: JSON.stringify({ action: type === "topup" ? "admin_topup" : "admin_withdrawal", requestId, approve }) });
      await onRefreshRequests();
    } catch (error) { alert(error.message || "Unable to process request"); }
    finally { setProcessing(null); }
  }

  return <section className="panel admin-panel">
    <div className="admin-header"><h3>Admin Panel</h3><button className="btn small" onClick={openCreate}>Create Match</button></div>

    <h4>Financial Requests</h4>
    {(requests.topup.length === 0 && requests.withdraw.length === 0) ? <p className="muted-small">No pending financial requests.</p> : <>
      {requests.topup.map((request) => <div className="admin-row" key={`topup-${request.id}`}><div><b>Top-up ₹{request.amount}</b><div className="small-muted">{request.email} • {request.coins} coins • UPI {request.upiId}</div></div><div className="admin-match-actions"><button className="btn small" disabled={!!processing} onClick={() => process("topup", request.id, true)}>{processing === `topup:${request.id}:true` ? "..." : "Approve"}</button><button className="btn small ghost" disabled={!!processing} onClick={() => process("topup", request.id, false)}>Reject</button></div></div>)}
      {requests.withdraw.map((request) => <div className="admin-row" key={`withdraw-${request.id}`}><div><b>Withdrawal ₹{request.amount}</b><div className="small-muted">{request.email} • {request.type} • {request.upiId || "gift card"} • reserved {request.reservedCoins} coins</div></div><div className="admin-match-actions"><button className="btn small" disabled={!!processing} onClick={() => process("withdrawal", request.id, true)}>{processing === `withdrawal:${request.id}:true` ? "..." : "Approve"}</button><button className="btn small ghost" disabled={!!processing} onClick={() => process("withdrawal", request.id, false)}>Reject</button></div></div>)}
    </>}

    <h4>Matches</h4>
    {localMatches.length === 0 ? <p className="muted-small">No matches.</p> : localMatches.map((match) => <div className="admin-row" key={match.id}><div><b>{match.title}</b><div className="small-muted">{match.type} • {match.mode} • {match.maxPlayers} players</div></div><div className="admin-match-actions"><button className="btn small" onClick={() => openEdit(match)}>Edit</button><button className="btn small ghost" onClick={() => deleteMatch(match.id)}>Delete</button></div></div>)}

    {showForm && <div className="modal-overlay" onClick={() => setShowForm(false)}><div className="modal-content admin-modal" onClick={(event) => event.stopPropagation()}><h3>{editing ? "Edit Match" : "Create Match"}</h3>
      <label>Title</label><input className="modern-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <label>Type</label><select className="modern-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="tournament">Tournament</option><option value="custom">Custom</option></select>
      <label>Mode</label><select className="modern-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}><option>Solo</option><option>Duo</option><option>Squad</option></select>
      <label>Map Pool</label><input className="modern-input" value={form.mapPool.join(", ")} onChange={(e) => setForm({ ...form, mapPool: e.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
      <label>Max Players</label><input className="modern-input" type="number" min="2" max="48" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: e.target.value })} />
      <label>Entry Fee</label><input className="modern-input" type="number" min="0" value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: e.target.value })} />
      <label>Reward</label><input className="modern-input" type="number" min="0" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
      <label>Kill Reward</label><input className="modern-input" type="number" min="0" value={form.killReward} onChange={(e) => setForm({ ...form, killReward: e.target.value })} />
      <label>Start Time</label><input className="modern-input" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
      <label>Reveal Delay (minutes)</label><input className="modern-input" type="number" min="0" max="1440" value={form.revealDelayMinutes} onChange={(e) => setForm({ ...form, revealDelayMinutes: e.target.value })} />
      <label>Room ID</label><input className="modern-input" value={form.roomID} onChange={(e) => setForm({ ...form, roomID: e.target.value })} />
      <label>Room Password</label><input className="modern-input" value={form.roomPassword} onChange={(e) => setForm({ ...form, roomPassword: e.target.value })} />
      <label>Images</label><div className="image-picker-grid">{AVAILABLE_IMAGES.map((name) => { const src = `/match/${name}.jpeg`; const selected = form.imageUrls.includes(src); return <button className={`image-picker-item ${selected ? "selected" : ""}`} key={name} onClick={() => setForm((current) => ({ ...current, imageUrls: selected ? current.imageUrls.filter((url) => url !== src) : [...current.imageUrls, src] }))}><img src={src} alt={name} /><span>{name}</span></button>; })}</div>
      <div className="admin-modal-actions"><button className="btn small ghost" onClick={() => setShowForm(false)}>Cancel</button><button className="btn small" disabled={saving} onClick={save}>{saving ? "Saving..." : editing ? "Save" : "Create"}</button></div>
    </div></div>}
  </section>;
}
