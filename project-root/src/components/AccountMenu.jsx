// src/components/AccountMenu.jsx
import React, { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  onRankClick = () => {},
  onLogout = null
}) {
  const [view, setView] = useState("main");
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [showAvatarSelect, setShowAvatarSelect] = useState(false);

  // All avatars in public/avatars/
  const avatarList = [
    "default.jpg",
    "angelic.jpg",
    "authentic.jpg",
    "brain.jpg",
    "chicken.jpg",
    "crown.jpg",
    "cyberpunk.jpg",
    "dragon.jpg",
    "flame-falco.jpg",
    "flower-wind.jpg",
    "flower.jpg",
    "free.jpg",
    "freefire.jpg",
    "ghost-mask.jpg",
    "ghost.jpg",
    "girl.jpg",
    "helm.jpg",
    "panda.jpg",
    "pink-glow.jpg",
    "purple.jpg",
    "radiation.jpg",
    "season7.jpg",
    "season8.jpg",
    "season9.jpg",
    "star.jpg",
    "unknown.jpg",
    "water.jpg"
  ];

  // Rank-lock rule
  function isLocked(a) {
    const lvl = profile.level || 1;

    if (["default.jpg"].includes(a)) return false;        // always allowed
    if (["angelic.jpg", "chicken.jpg", "girl.jpg"].includes(a)) return lvl < 5;
    if (["crown.jpg", "flame-falco.jpg"].includes(a)) return lvl < 10;
    if (["dragon.jpg", "season7.jpg", "season9.jpg"].includes(a)) return lvl < 15;
    return false;
  }

  async function handleAvatarSelect(a) {
    if (isLocked(a)) return alert("Your level is too low for this avatar.");
    await updateProfileField({ avatar: a });
    setProfile(prev => ({ ...prev, avatar: a }));
    setShowAvatarSelect(false);
  }

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

  return (
    <div className="account-menu">

      {/* ---------- MAIN PAGE ---------- */}
      {view === "main" && (
        <section className="panel account-profile-card">

          {/* Avatar (CLICK TO CHANGE) */}
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
            <div
              onClick={() => setShowAvatarSelect(true)}
              style={{
                width:72, height:72, borderRadius:12, overflow:"hidden",
                background:"rgba(255,255,255,0.04)", cursor:"pointer"
              }}
            >
              <img
                src={`/avatars/${profile.avatar || "default.jpg"}`}
                alt="avatar"
                style={{width:"100%", height:"100%", objectFit:"cover"}}
              />
            </div>

            <div style={{fontWeight:800, fontSize:18, color:"var(--accent2)"}}>
              {profile.username || profile.displayName || "Set Username"}
            </div>

            <div style={{color:"var(--muted)"}}>{profile.email}</div>
          </div>

          {/* OPTIONS */}
          <div className="account-btn-group" style={{width:"100%", marginTop:14}}>
            <button className="account-option" onClick={() => setView("profile")}>
              <span style={{marginRight:12}}>👤</span> Profile Settings
            </button>

            <button className="account-option" onClick={() => onRankClick()}>
              <span style={{marginRight:12}}>🏆</span> Rank
            </button>

            <button className="account-option" onClick={() => setView("refer")}>
              <span style={{marginRight:12}}>🔗</span> Refer a Friend
            </button>

            <button className="account-option" onClick={doLogout}>
              <span style={{marginRight:12}}>🚪</span> Logout
            </button>
          </div>
        </section>
      )}

      {/* ---------- PROFILE SETTINGS ---------- */}
      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Profile Settings</h3>

          <form onSubmit={saveName}>
            <input
              className="modern-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button className="btn">Save</button>
          </form>
        </section>
      )}

      {/* ---------- REFER ---------- */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Refer a Friend</h3>
          <p>Your referral code:</p>
          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}

      {/* ---------- AVATAR SELECTOR MODAL ---------- */}
      {showAvatarSelect && (
        <div className="modal-overlay" onClick={() => setShowAvatarSelect(false)}>
          <div
            className="modal-content glow-panel"
            style={{maxWidth:380, padding:20}}
            onClick={(e)=>e.stopPropagation()}
          >
            <h3 className="modern-title" style={{textAlign:"center"}}>Choose Avatar</h3>

            <div
              style={{
                display:"grid",
                gridTemplateColumns:"repeat(3,1fr)",
                gap:12,
                marginTop:10
              }}
            >
              {avatarList.map(a => (
                <div
                  key={a}
                  onClick={() => handleAvatarSelect(a)}
                  style={{
                    borderRadius:12,
                    overflow:"hidden",
                    border: isLocked(a)
                      ? "2px solid rgba(255,80,80,0.5)"
                      : "2px solid rgba(255,255,255,0.1)",
                    opacity: isLocked(a) ? 0.45 : 1,
                    cursor: isLocked(a) ? "not-allowed" : "pointer"
                  }}
                >
                  <img
                    src={`/avatars/${a}`}
                    style={{width:"100%", height:90, objectFit:"cover"}}
                    alt=""
                  />
                </div>
              ))}
            </div>

            <button
              className="btn ghost"
              style={{marginTop:18, width:"100%"}}
              onClick={() => setShowAvatarSelect(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
