import React, { useState } from "react";
import { signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { User, Trophy, Link2, LogOut, Settings, MessageSquare, ShieldCheck, Eye, EyeOff, Copy, Check } from "lucide-react";
import { secureApi } from "../utils/apiClient";
import "../styles/profilesettings.css";
import Popup from "./Popup";
import ProfileSettings from "./ProfileSettings";

export default function AccountMenu({ profile, setProfile = () => {}, updateProfileField = async () => {}, onRankClick = () => {}, onLogout = null, openAvatarModal }) {
  const [view, setView] = useState("main");
  const [popup, setPopup] = useState({ show: false, type: "", message: "" });
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const showPopup = (type, message) => { setPopup({ show: true, type, message }); setTimeout(() => setPopup({ show: false, type: "", message: "" }), 2200); };
  const isLong = newPass.length >= 6;

  async function handlePasswordChange() {
    if (!oldPass || !newPass || !confirmPass) return showPopup("error", "Fill all fields.");
    if (!isLong) return showPopup("error", "Password must be at least 6 characters.");
    if (newPass !== confirmPass) return showPopup("error", "Passwords don't match.");
    try {
      const user = auth.currentUser;
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, oldPass));
      await updatePassword(user, newPass);
      setOldPass(""); setNewPass(""); setConfirmPass(""); showPopup("success", "Password updated!");
    } catch (err) { showPopup("error", err.code === "auth/wrong-password" ? "Old password is incorrect." : "Failed to update password."); }
  }

  async function sendResetEmail() {
    try { await sendPasswordResetEmail(auth, profile.email); showPopup("success", "Reset email sent!"); }
    catch (_) { showPopup("error", "Failed to send reset email."); }
  }

  async function doLogout() {
    if (typeof onLogout === "function") return onLogout();
    await signOut(auth); window.location.href = "/login";
  }

  async function sendFeedback() {
    if (!feedback.trim()) return alert("Write something.");
    setFeedbackSaving(true);
    try {
      await secureApi("/api/feedback", { method: "POST", body: JSON.stringify({ text: feedback.trim() }) });
      setFeedback(""); showPopup("success", "Feedback sent!"); setView("main");
    } catch (error) { showPopup("error", error.message || "Failed to send feedback."); }
    finally { setFeedbackSaving(false); }
  }

  async function copyReferralCode() {
    if (!profile.referralCode) return;
    try {
      await navigator.clipboard.writeText(profile.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (_) {
      showPopup("error", "Unable to copy referral code.");
    }
  }

  return <div className="account-menu premium-panel">
    {popup.show && <Popup type={popup.type} message={popup.message} />}
    {view === "main" && <section className="panel account-profile-card premium glass-card">
      <div className="acc-top-row"><div className="acc-avatar" onClick={openAvatarModal}><img src={profile.avatar || "/avatars/default.jpg"} alt="avatar" /></div><div className="acc-meta"><div className="acc-name">{profile.displayName || profile.username || "Player"}</div><div className="acc-email">{profile.email}</div><div className="acc-stats"><span>Level {profile.level ?? 1}</span><span> • </span><span>{profile.coins ?? 0} coins</span></div></div></div>
      <div className="account-actions">
        <button className="account-option" onClick={() => setView("profile")}><Settings size={18} /><span>Profile Settings</span></button>
        <button className="account-option" onClick={onRankClick}><Trophy size={18} /><span>Rank</span></button>
        <button className="account-option" onClick={() => setView("refer")}><Link2 size={18} /><span>Refer a Friend</span></button>
        <button className="account-option" onClick={() => setView("feedback")}><MessageSquare size={18} /><span>Send Feedback</span></button>
        <button className="account-option" onClick={() => setView("security")}><ShieldCheck size={18} /><span>Security & Password</span></button>
        <button className="account-option logout" onClick={doLogout}><LogOut size={18} /><span>Logout</span></button>
      </div>
      <div className="account-links"><a href="/privacy-policy">Privacy Policy</a><a href="/terms">Terms</a><a href="/contact">Contact</a></div>
    </section>}

    {view === "security" && <section className="panel security-panel glass-card"><button className="back-btn" onClick={() => setView("main")}>Back</button><h3>Change Password</h3>
      <label>Current Password</label><div className="password-field"><input type={showOld ? "text" : "password"} value={oldPass} onChange={(e) => setOldPass(e.target.value)} /><span className="toggle-eye" onClick={() => setShowOld(!showOld)}>{showOld ? <EyeOff size={18} /> : <Eye size={18} />}</span></div>
      <label>New Password</label><div className="password-field"><input type={showNew ? "text" : "password"} value={newPass} onChange={(e) => setNewPass(e.target.value)} /><span className="toggle-eye" onClick={() => setShowNew(!showNew)}>{showNew ? <EyeOff size={18} /> : <Eye size={18} />}</span></div>
      <p className={`pass-rule ${isLong ? "ok" : "bad"}`}>• At least 6 characters</p>
      <label>Confirm New Password</label><div className="password-field"><input type={showConfirm ? "text" : "password"} value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} /><span className="toggle-eye" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</span></div>
      <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={handlePasswordChange}>Update Password</button><button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={sendResetEmail}>Forgot Password? (Email Reset)</button>
    </section>}

    {view === "refer" && <section className="panel glass-card">
      <button className="back-btn" onClick={() => setView("main")}>Back</button>
      <h3>Refer a Friend</h3>
      <p>Share your unique invite code. A successful referral gives both players a bonus.</p>
      <div className="referral-code" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span>{profile.referralCode || "Generating..."}</span>
        <button className="btn small" onClick={copyReferralCode} disabled={!profile.referralCode} title="Copy referral code">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="muted-small" style={{ marginTop: 12 }}>
        Successful referrals: {profile.referralCount ?? 0}
      </div>
    </section>}

    {view === "feedback" && <section className="panel glass-card"><button className="back-btn" onClick={() => setView("main")}>Back</button><h3>Send Feedback</h3><textarea className="field" rows={6} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Describe the issue..." /><button className="btn" onClick={sendFeedback} disabled={feedbackSaving}>{feedbackSaving ? "Sending..." : "Send Feedback"}</button></section>}

    {view === "profile" && <section className="panel"><button className="back-btn" onClick={() => setView("main")}>Back</button><ProfileSettings profile={profile} updateProfileField={updateProfileField} setProfile={setProfile} onBack={() => setView("main")} /></section>}
  </div>;
}
