import React, { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  addXP = async () => {},
  onRankClick = () => {},
  onLogout = null // function from Dashboard to handle navigation
}) {
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

  async function doLogout() {
    if (typeof onLogout === "function") {
      return onLogout();
    }
    // fallback
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div className="account-menu">
      {view === "main" && (
        <section className="panel account-profile-card">
          {/* User card top */}
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
            <div
              style={{
                width:72,
                height:72,
                overflow:"hidden",
                background:"rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6 /* square-ish corners */
              }}
            >
              {/* badge placeholder (replace if you have user image) */}
              <img src={profile.avatar || "/avatars/default.jpg"} alt="avatar"
                   style={{width:"100%", height:"100%", objectFit:"cover", display:"block"}} />
            </div>

            <div style={{fontWeight:800, fontSize:18, color:"var(--accent2)"}}>
              {profile.username || profile.displayName || "Set Username"}
            </div>
            <div style={{color:"var(--muted)"}}>{profile.email}</div>
          </div>

          <div className="account-btn-group" style={{width:"100%", marginTop:14}}>
            {/* Profile Settings */}
            <button className="account-option" onClick={() => setView("profile")}>
              <span style={{marginRight:12}}>👤</span>
              <span>Profile Settings</span>
            </button>

            {/* Rank */}
            <button className="account-option" onClick={() => { onRankClick(); }}>
              <span style={{marginRight:12}}>🏆</span>
              <span>Rank</span>
            </button>

            {/* Refer a Friend */}
            <button className="account-option" onClick={() => setView("refer")}>
              <span style={{marginRight:12}}>🔗</span>
              <span>Refer a Friend</span>
            </button>

            {/* Logout */}
            <button className="account-option" onClick={doLogout} style={{background:"rgba(255,255,255,0.04)"}}>
              <span style={{marginRight:12}}>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </section>
      )}

      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Profile Settings</h3>
          <form onSubmit={saveName}>
            <input className="modern-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <button className="btn">Save</button>
          </form>
        </section>
      )}

      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Refer a Friend</h3>
          <p>Your referral code:</p>
          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}
    </div>
  );
}
