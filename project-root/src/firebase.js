import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// We also need to import App Check
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyAIckZEyuVFr7aewkCNzIEmxB1uUjGJgEU",
  authDomain: "imperial-esports-da816.firebaseapp.com",
  projectId: "imperial-esports-da816",
  storageBucket: "imperial-esports-da816.appspot.com",
  messagingSenderId: "599688885836",
  appId: "1:599688885836:web:bbd08bb6b1984b45eea6e9",
  measurementId: "G-9D09P3EWRG"
};

const app = initializeApp(firebaseConfig);

// Initialize App Check
// This is your site key from the screenshot
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6Lce7wMsAAAAAILiEOO6OQzY6_E62GixASyfi3Vq'),
  isTokenAutoRefreshEnabled: true
});

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const appCheckInstance = appCheck; // 👈 *** THIS IS THE NEW LINE ***
