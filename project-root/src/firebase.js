// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// 🔹 Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAIckZEyuVFr7aewkCNzIEmxB1uUjGJgEU",
  authDomain: "imperial-esports-da816.firebaseapp.com",
  projectId: "imperial-esports-da816",
  storageBucket: "imperial-esports-da816.appspot.com",
  messagingSenderId: "599688885836",
  appId: "1:599688885836:web:775b92a0a8892172eea6e9",
  measurementId: "G-LQK20L1KBT",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Core services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

// 🔹 Initialize App Check (reCAPTCHA v3)
export const appCheckInstance = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6Lce7wMsAAAAAILiEOO6OQzY6_E62GixASyfi3Vq"), // 👈 use your real site key
  isTokenAutoRefreshEnabled: true,
});

// 👇 Optional: Enable debug mode for localhost / dev
if (import.meta.env.DEV) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
