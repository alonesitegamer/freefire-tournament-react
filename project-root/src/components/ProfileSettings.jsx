// src/components/ProfileSettings.jsx
import React, { useState } from "react";
import { auth, updatePassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

import {
  FaUserEdit,
  FaLock,
  FaCommentDots,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

export default function ProfileSettings({ profile, updateProfileField, onBack }) {
  const [screen, setScreen] = useState("menu"); // menu | username | password | feedback

  const [username, setUsername] = useState(profile.username || "");
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [displayName, setDisplayName] = useState(profile.displayName || "");

  const [saving, setSaving] = useState(false);

  // -----------------------------
  // SAVE USERNAME / DISPLAY NAME
  // -----------------------------
  async function saveUsername() {
    if (saving) return;
    setSaving(true);

    try {
      await updateProfileField({
        username: username.trim(),
        displayName: displayName.trim(),
      });

      alert("Profile updated!");
      setScreen("menu");
    } catch (err) {
      console.error(err);
      alert("Error updating profile");
    }

    setSaving(false);
  }

  // -----------------------------
  // SAVE NEW PASSWORD
  // -----------------------------
  async function saveNewPassword() {
    if (!newPassword) return alert("Enter new password");

    try {
      await updatePassword(auth.currentUser, newPassword);
      alert("Password updated!");
      setNewPassword("");
      setScreen("menu");
    } catch (err) {
      alert("You need to re-login to change password.");
    }
  }

  // -----------------------------
  // SAVE FEEDBACK
  // -----------------------------
  async function submitFeedback() {
    if (!feedback.trim()) return alert("Write something first");
    setSaving(true);

    try {
      const fbRef = doc(db, "feedback", `${auth.currentUser.uid}_${Date.now()}`);

      await setDoc(fbRef, {
        userId: auth.currentUser.uid,
        email: auth.currentUser.email,
        feedback: feedback.trim(),
        createdAt: serverTimestamp(),
      });

      alert("Feedback sent!");
      setFeedback("");
      setScreen("menu");
    } catch (err) {
      console.error(err);
      alert("Failed to send feedback");
    }

    setSaving(false);
  }

  // -----------------------------
  // SLIDE ANIMATION CLASS
  // -----------------------------
  function slideClass(target) {
    if (screen === target) return "ps-screen active";
    if (screen !== target) return "ps-screen";
  }

  return (
    <div className="ps-container">

      {/* BACK to Account */}
      <button className="ps-back" onClick={onBack}>
        <FaChevronLeft /> Back
      </button>

      {/* ----------------------------- */}
      {/* MAIN MENU SCREEN */}
      {/* ----------------------------- */}
      <div className={slideClass("menu")}>
        <h2 className="ps-title">Profile Settings</h2>

        <div className="ps-option" onClick={() => setScreen("username")}>
          <FaUserEdit className="ps-icon" />
          <span>Change Username</span>
          <FaChevronRight className="ps-arrow" />
        </div>

        <div className="ps-option" onClick={() => setScreen("password")}>
          <FaLock className="ps-icon" />
          <span>Change Password</span>
          <FaChevronRight className="ps-arrow" />
        </div>

        <div className="ps-option" onClick={() => setScreen("feedback")}>
          <FaCommentDots className="ps-icon" />
          <span>Send Feedback</span>
          <FaChevronRight className="ps-arrow" />
        </div>

        <a className="ps-footer-link" href="/privacy-policy">
          Privacy Policy
        </a>
      </div>

      {/* ----------------------------- */}
      {/* USERNAME SCREEN */}
      {/* ----------------------------- */}
      <div className={slideClass("username")}>
        <button className="ps-sub-back" onClick={() => setScreen("menu")}>
          <FaChevronLeft /> Back
        </button>

        <h2 className="ps-title">Change Username</h2>

        <label className="ps-label">Username</label>
        <input
          className="ps-input"
          value={username}
          maxLength={18}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="ps-label">Display Name</label>
        <input
          className="ps-input"
          value={displayName}
          maxLength={24}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <button className="ps-btn" onClick={saveUsername}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* ----------------------------- */}
      {/* PASSWORD SCREEN */}
      {/* ----------------------------- */}
      <div className={slideClass("password")}>
        <button className="ps-sub-back" onClick={() => setScreen("menu")}>
          <FaChevronLeft /> Back
        </button>

        <h2 className="ps-title">Change Password</h2>

        <label className="ps-label">New Password</label>
        <input
          type="password"
          className="ps-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button className="ps-btn" onClick={saveNewPassword}>
          Update Password
        </button>
      </div>

      {/* ----------------------------- */}
      {/* FEEDBACK SCREEN */}
      {/* ----------------------------- */}
      <div className={slideClass("feedback")}>
        <button className="ps-sub-back" onClick={() => setScreen("menu")}>
          <FaChevronLeft /> Back
        </button>

        <h2 className="ps-title">Send Feedback</h2>

        <textarea
          className="ps-textarea"
          rows="5"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Write your feedback here..."
        />

        <button className="ps-btn" onClick={submitFeedback}>
          {saving ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
