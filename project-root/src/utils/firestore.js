// src/utils/firestore.js
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";

// ✅ Fetch match history for a user
export async function getMatchHistory(userId) {
  const q = query(
    collection(db, "matchHistory"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// ✅ Add a new match to history
export async function addMatchHistory(userId, matchData) {
  await addDoc(collection(db, "matchHistory"), {
    userId,
    ...matchData,
    createdAt: serverTimestamp(),
  });
}

// ✅ Fetch withdrawal history
export async function getWithdrawHistory(userId) {
  const q = query(
    collection(db, "withdrawRequests"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// ✅ Add withdrawal request
export async function addWithdrawRequest(userId, amount, upiId) {
  await addDoc(collection(db, "withdrawRequests"), {
    userId,
    amount,
    upiId,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

// ✅ Get a user's profile
export async function getUserProfile(userId) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// ✅ Update user coin balance
export async function updateUserCoins(userId, coins) {
  const ref = doc(db, "users", userId);
  await updateDoc(ref, { coins });
}

// ✅ Increment player stats (NEW FEATURE)
export async function incrementPlayerStats(userId, { matches = 0, kills = 0, booyah = 0, coins = 0 }) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const stats = snap.data().stats || {
    matchesPlayed: 0,
    totalKills: 0,
    booyahs: 0,
    coinsEarned: 0,
  };

  await updateDoc(ref, {
    "stats.matchesPlayed": stats.matchesPlayed + matches,
    "stats.totalKills": stats.totalKills + kills,
    "stats.booyahs": stats.booyahs + booyah,
    "stats.coinsEarned": stats.coinsEarned + coins,
  });
}
