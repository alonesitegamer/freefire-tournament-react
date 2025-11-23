// src/components/AccountMenu.jsx
import React, { useState } from "react";
import ProfileSettings from "./ProfileSettings";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

// Modern icons
import { User, Trophy, Link2, LogOut, Settings, MessageSquare, ShieldCheck } from "lucide-react";
import "../styles/profilesettings.css";

export default function AccountMenu({
  profile,
  setProfile = () => {},
  updateProfileField = async () => {},
  onRankClick = () => {},
  onLogout = null,
  openAvatarModal
}) {
  const [view, setView] = useState("main");

  async function doLogout() {
    if (typeof onLogout === "function") return onLogout();
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div className="account-menu premium-panel">
      {view === "main" && (
        <section className="panel account-profile-card premium">
          <div className="acc-top-row">
            <div className="acc-avatar" onClick={openAvatarModal}>
              <img src={profile.avatar || "/avatars/default.jpg"} alt="avatar" />
            </div>

            <div className="acc-meta">
              <div className="acc-name">{profile.displayName || profile.username || "Player"}</div>
              <div className="acc-email">{profile.email}</div>
              <div className="acc-stats">
                <span>Level {profile.level ?? 1}</span>
                <span> • </span>
                <span>{profile.coins ?? 0} coins</span>
              </div>
            </div>
          </div>

          <div className="account-actions">
            <button className="account-option" onClick={() => setView("profile")}>
              <Settings size={18} /> <span>Profile Settings</span>
            </button>

            <button className="account-option" onClick={onRankClick}>
              <Trophy size={18} /> <span>Rank</span>
            </button>

            <button className="account-option" onClick={() => setView("refer")}>
              <Link2 size={18} /> <span>Refer a Friend</span>
            </button>

            <button className="account-option" onClick={() => setView("feedback")}>
              <MessageSquare size={18} /> <span>Send Feedback</span>
            </button>

            <button className="account-option" onClick={() => setView("security")}>
              <ShieldCheck size={18} /> <span>Security & Password</span>
            </button>

            <button className="account-option logout" onClick={doLogout}>
              <LogOut size={18} /> <span>Logout</span>
            </button>
          </div>

          <div className="account-links">
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/terms-of-service">Terms</a>
            <a href="/contact">Contact</a>
          </div>
        </section>
      )}

      {view === "profile" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <ProfileSettings
            profile={profile}
            updateProfileField={updateProfileField}
            onBack={() => setView("main")}
            setProfile={setProfile}
          />
        </section>
      )}

      {view === "refer" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Refer a Friend</h3>
          <p>Share this code with your friends — you both earn rewards when they join and redeem.</p>
          <div className="referral-code">{profile.referralCode}</div>
        </section>
      )}

      {view === "feedback" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Send Feedback</h3>
          <p className="muted">Got a bug, suggestion, or report? We'll read it.</p>
          <FeedbackForm onDone={() => setView("main")} profile={profile} />
        </section>
      )}

      {view === "security" && (
        <section className="panel">
          <button className="back-btn" onClick={() => setView("main")}>Back</button>
          <h3>Security</h3>
          <p className="muted">Change password or reset using email.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <button className="btn" onClick={() => setView("profile")}>Change Password</button>
            <button className="btn ghost" onClick={() => { navigator.clipboard.writeText(profile.referralCode); alert("Referral copied"); }}>
              Copy Referral
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* small FeedbackForm inside same file so you only drop one component */
function FeedbackForm({ onDone = () => {}, profile = {} }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  // lazy import to avoid circular imports
  const { db } = require("../firebase"); // eslint-disable-line

  const { addDoc, collection, serverTimestamp } = require("firebase/firestore"); // eslint-disable-line

  async function send() {
    if (!text.trim()) return alert("Write something first.");
    setSaving(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: profile.id || null,
        email: profile.email || null,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      alert("Thanks — feedback sent.");
      setText("");
      onDone();
    } catch (e) {
      console.error("send feedback", e);
      alert("Failed to send feedback.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="feedback-root">
      <textarea className="field" rows={6} value={text} onChange={(e)=>setText(e.target.value)} placeholder="Tell us what's up..." />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button className="btn ghost" onClick={() => { setText(""); onDone(); }}>Cancel</button>
        <button className="btn" onClick={send} disabled={saving}>{saving ? "Sending..." : "Send Feedback"}</button>
      </div>
    </div>
  );
}
