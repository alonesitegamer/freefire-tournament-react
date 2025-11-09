// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAIckZEyuVFr7aewkCNzIEmxB1uUjGJgEU",
  authDomain: "imperial-esports-da816.firebaseapp.com",
  projectId: "imperial-esports-da816",
  storageBucket: "imperial-esports-da816.appspot.com",
  messagingSenderId: "599688885836",
  appId: "1:599688885836:web:775b92a0a8892172eea6e9",
  measurementId: "G-LQK20L1KBT",
};

// ✅ Initialize core Firebase services
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
