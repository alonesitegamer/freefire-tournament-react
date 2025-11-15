// src/components/AccountMenu.jsx
import React, { useState } from "react";

export default function AccountMenu({
  profile,
  setProfile,
  addXP,
  updateProfileField,
  onRankClick = () => {},
}) {
  const [view, setView] = useState("main");
  const [displayName, setDisplayName] = useState(profile.displayName || "");

  async function saveName(e) {
    e.preventDefault();
    if (!displayName) return alert("Enter a name");

    await updateProfileField({ displayName });
    setProfile((prev) => ({ ...prev, displayName }));
    alert("Saved!");
    setView("main");
  }

  return (
    <div className="account-menu">

      {/* MAIN MENU */}
      {view === "main" && (
        <section className="panel account-profile-card">

          <h3 className="modern-title">
            {profile.username || profile.displayName || "Set Username"}
          </h3>
          <p className="modern-subtitle">{profile.email}</p>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <button className="btn" onClick={() => setView("profile")}>
              Profile Settings
            </button>

            <button className="btn" onClick={onRankClick}>
              Rank
            </button>

            <button className="btn" onClick={() => setView("refer")}>
              Refer a Friend
            </button>
          </div>
        </section>
      )}

      {/* PROFILE SETTINGS */}
      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>

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

      {/* REFER SECTION */}
      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>
            Back
          </button>

          <h3>Refer a Friend</h3>
          <p>
            Your referral code:
            <strong> {profile.referralCode}</strong>
          </p>
        </section>
      )}
    </div>
  );
}
