import React, { useState } from 'react';
import { auth, db } from '../firebase'; // Assuming you have these exports
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

// Import the CSS for this page
import './ProfilePage.css';

export default function ProfilePage() {
  const user = auth.currentUser;

  // State for forms
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // State for messages
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Function to show a temporary success message
  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  };

  // --- 1. Handle Display Name Update ---
  const handleNameUpdate = async (e) => {
    e.preventDefault();
    if (!user) return;

    // Don't update if the name is the same
    if (displayName === user.displayName) {
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Update in Firebase Auth
      await updateProfile(user, { displayName: displayName });

      // Update in Firestore 'users' collection
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        displayName: displayName,
      });

      setLoading(false);
      showSuccess('Display name updated successfully!');

    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  // --- 2. Handle Password Change ---
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      // Firebase requires re-authentication to change a password
      // This is a critical security feature
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Once re-authenticated, we can safely update the password
      await updatePassword(user, newPassword);

      setLoading(false);
      showSuccess('Password changed successfully!');
      // Clear the password fields
      setCurrentPassword('');
      setNewPassword('');

    } catch (err) {
      console.error(err);
      // Handle common errors
      if (err.code === 'auth/wrong-password') {
        setError('The current password you entered is incorrect.');
      } else if (err.code === 'auth/weak-password') {
        setError('New password must be at least 6 characters long.');
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-container">
        <p>Please log in to see your profile.</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h1>Your Profile</h1>
        <p className="profile-email">
          <strong>Email:</strong> {user.email}
        </p>
        <p className="profile-uid">
          <strong>User ID:</strong> {user.uid}
        </p>

        {/* --- Display Name Form --- */}
        <form onSubmit={handleNameUpdate} className="profile-form">
          <h2>Update Display Name</h2>
          <label htmlFor="displayName">Display Name</label>
          <input
            type="text"
            id="displayName"
            className="field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
          />
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Saving...' : 'Save Name'}
          </button>
        </form>

        <div className="sep-profile"></div>

        {/* --- Change Password Form --- */}
        <form onSubmit={handleChangePassword} className="profile-form">
          <h2>Change Password</h2>
          <p className="text-muted-small">
            You must enter your current password to make changes.
          </p>
          <label htmlFor="currentPassword">Current Password</label>
          <input
            type="password"
            id="currentPassword"
            className="field"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <label htmlFor="newPassword">New Password</label>
          <input
            type="password"
            id="newPassword"
            className="field"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="At least 6 characters"
          />
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Updating...' : 'Change Password'}
          </button>
        </form>
        
        {/* --- Global Messages --- */}
        {error && <div className="error profile-msg">{error}</div>}
        {success && <div className="error success profile-msg">{success}</div>}
        
      </div>
    </div>
  );
}
