// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ---- CONFIG ----
const firebaseConfig = {
  apiKey: "AIzaSyAIckZEyuVFr7aewkCNzIEmxB1uUjGJgEU",
  authDomain: "imperial-esports-da816.firebaseapp.com",
  projectId: "imperial-esports-da816",
  storageBucket: "imperial-esports-da816.appspot.com",
  messagingSenderId: "599688885836",
  appId: "1:599688885836:web:bbd08bb6b1984b45eea6e9",
  measurementId: "G-9D09P3EWRG"
};

// ---- INIT APP ----
const app = initializeApp(firebaseConfig);

// ---- OPTIONAL: Disable App Check during dev/preview ----
if (
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname.includes("vercel.app"))
) {
  // This stops Firebase from requesting App Check tokens
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  console.warn("🔥 App Check debug token enabled (not enforced).");
}

// ---- EXPORTS ----
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
