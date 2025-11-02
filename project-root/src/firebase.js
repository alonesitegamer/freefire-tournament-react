// firebase.js - initialize and export auth + firestore
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAIckZEyuVFr7aewkCNzIEmxB1uUjGJgEU",
  authDomain: "imperial-esports-da816.firebaseapp.com",
  projectId: "imperial-esports-da816",
  storageBucket: "imperial-esports-da816.appspot.com", // ✅ fixed here
  messagingSenderId: "599688885836",
  appId: "1:599688885836:web:bbd08bb6b1984b45eea6e9",
  measurementId: "G-9D09P3EWRG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
