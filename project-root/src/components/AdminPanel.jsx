// src/components/AccountMenu.jsx
import React, { useState } from "react";
import MatchHistoryPage from "../pages/MatchHistoryPage";
import WithdrawalHistoryPage from "../pages/WithdrawalHistoryPage";

export default function AccountMenu({ profile, setProfile, addXP, updateProfileField }) {
  const [view, setView] = useState("main");
  const [displayName, setDisplayName] = useState(profile.displayName || "");

  async function saveName(e) {
    e.preventDefault();
    if (!displayName) return alert("Enter a name");
    await updateProfileField({ displayName });
    setProfile(prev => ({ ...prev, displayName }));
    alert("Saved");
    setView("main");
  }

  return (
    <div>
      {view === "main" && (
        <>
          <section className="panel account-profile-card">
            <h3 className="modern-title">{profile.username || "Set Username"}</h3>
            <p className="modern-subtitle">{profile.email}</p>
            <div style={{marginTop:10}}>
              <button className="btn" onClick={()=>setView("profile")}>Profile Settings</button>
              <button className="btn ghost" onClick={()=>setView("refer")}>Refer a Friend</button>
              <button className="btn" onClick={()=>setView("match_history")}>Match History</button>
              <button className="btn" onClick={()=>setView("withdraw_history")}>Withdrawal History</button>
            </div>
          </section>
        </>
      )}

      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={()=>setView("main")}>Back</button>
          <h3>Profile Settings</h3>
          <form onSubmit={saveName}>
            <input className="modern-input" value={displayName} onChange={(e)=>setDisplayName(e.target.value)} />
            <button className="btn">Save</button>
          </form>
        </section>
      )}

      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={()=>setView("main")}>Back</button>
          <h3>Refer a Friend</h3>
          <p>Your code: <strong>{profile.referralCode}</strong></p>
          <p>Share and get rewards when friends redeem.</p>
        </section>
      )}

      {view === "match_history" && (
        <section className="panel">
          <button className="back-btn" onClick={()=>setView("main")}>Back</button>
          <MatchHistoryPage />
        </section>
      )}

      {view === "withdraw_history" && (
        <section className="panel">
          <button className="back-btn" onClick={()=>setView("main")}>Back</button>
          <WithdrawalHistoryPage />
        </section>
      )}
    </div>
  );
}

// src/components/AdminPanel.jsx
import React from "react";

export default function AdminPanel({ requests = {topup:[],withdraw:[]}, approveRequest, rejectRequest, matches=[] }) {
  return (
    <section className="panel">
      <h3>Admin Panel</h3>
      <h4>Top-up Requests</h4>
      {requests.topup.length === 0 ? <p className="muted-small">No topups.</p> : requests.topup.map(r=>(
        <div key={r.id} className="admin-row">
          <span>{r.email} | ₹{r.amount} | UPI:{r.upiId}</span>
          <div>
            <button className="btn small" onClick={()=>approveRequest("topup", r)}>Approve</button>
            <button className="btn small ghost" onClick={()=>rejectRequest("topup", r)}>Reject</button>
          </div>
        </div>
      ))}
      <h4 style={{marginTop:16}}>Withdraw Requests</h4>
      {requests.withdraw.length === 0 ? <p className="muted-small">No withdrawals.</p> : requests.withdraw.map(r=>(
        <div key={r.id} className="admin-row">
          <span>{r.email} | ₹{r.amount} | {r.type} {r.upiId ? `| UPI:${r.upiId}` : ""}</span>
          <div>
            <button className="btn small" onClick={()=>approveRequest("withdraw", r)}>Approve</button>
            <button className="btn small ghost" onClick={()=>rejectRequest("withdraw", r)}>Reject</button>
          </div>
        </div>
      ))}
    </section>
  );
}
