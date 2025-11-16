// src/components/AccountMenu.jsx
import React, { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  addXP = async () => {},
  onRankClick = () => {},
  onLogout = null,
  openAvatarModal = null, // Dashboard sends this
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
    if (typeof onLogout === "function") return onLogout();
    await signOut(auth);
    window.location.href = "/login";
  }

  // tap avatar → open modal
  function handleAvatarClick() {
    if (typeof openAvatarModal === "function") openAvatarModal();
  }

  return (
    <div className="account-menu">
      {view === "main" && (
        <section className="panel account-profile-card">

          {/* TOP USER INFO */}
          <div style={{ 
            display:"flex", 
            flexDirection:"column", 
            alignItems:"center", 
            gap:10 
          }}>
            {/* TAP AVATAR TO CHANGE */}
            <div 
              onClick={handleAvatarClick}
              style={{
                width:72,
                height:72,
                borderRadius:8,
                overflow:"hidden",
                border:"2px solid var(--accent2)",
                cursor:"pointer",
              }}
            >
              <img 
                src={profile.avatar || "/avatars/default.jpg"} 
                alt="avatar" 
                style={{ width:"100%", height:"100%", objectFit:"cover" }} 
              />
            </div>

            <div style={{fontWeight:800, fontSize:18, color:"var(--accent2)"}}>
              {profile.username || profile.displayName || "Set Username"}
            </div>

            <div style={{color:"var(--muted)"}}>
              {profile.email}
            </div>
          </div>

          {/* MENU BUTTONS */}
          <div className="account-btn-group" style={{width:"100%", marginTop:18}}>
            <button className="account-option" onClick={() => setView("profile")}>
              👤 Profile Settings
            </button>

            <button className="account-option" onClick={onRankClick}>
              🏆 Rank
            </button>

            <button className="account-option" onClick={() => setView("refer")}>
              🔗 Refer a Friend
            </button>

            <button className="account-option" onClick={doLogout}>
              🚪 Logout
            </button>
          </div>
        </section>
      )}

      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Profile Settings</h3>
          <form onSubmit={saveName}>
            <input 
              className="modern-input" 
              value={displayName} 
              onChange={(e)=>setDisplayName(e.target.value)} 
            />
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
