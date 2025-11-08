// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAIckZEyuVFr7aewkCNzIEmxB1uUjGJgEU",
  authDomain: "imperial-esports-da816.firebaseapp.com",
  projectId: "imperial-esports-da816",
  storageBucket: "imperial-esports-da816.firebasestorage.app",
  messagingSenderId: "599688885836",
  appId: "1:599688885836:web:775b92a0a8892172eea6e9",
  measurementId: "G-LQK20L1KBT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
