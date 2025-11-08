// firebase.js — full setup for Auth + Firestore + optional Analytics
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAIckZEyuVFr7aewkCNzIEmxB1uUjGJgEU",
  authDomain: "imperial-esports-da816.firebaseapp.com",
  projectId: "imperial-esports-da816",
  storageBucket: "imperial-esports-da816.appspot.com", // ✅ corrected
  messagingSenderId: "599688885836",
  appId: "1:599688885836:web:775b92a0a8892172eea6e9",
  measurementId: "G-LQK20L1KBT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Optional: Initialize Analytics (won’t break anything if unavailable)
try {
  getAnalytics(app);
} catch (e) {
  console.warn("Analytics not supported in this environment:", e);
}
