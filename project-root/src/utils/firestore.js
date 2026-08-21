// src/utils/firestore.js
import { db } from "../firebase";
import { collection, getDocs, getDoc, doc, query, where, orderBy } from "firebase/firestore";
import { secureApi } from "./apiClient";

// Read-only helpers remain client-side. Any mutation that affects economy,
// match history, or player statistics goes through the authenticated API.
export async function getMatchHistory(userId) {
  const q = query(collection(db, "matchHistory"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function addMatchHistory(userId, matchData) {
  if (!userId) throw new Error("User is required");
  return secureApi("/api/player", {
    method: "POST",
    body: JSON.stringify({
      action: "history",
      matchId: matchData.matchId,
      result: matchData.result,
      kills: matchData.kills || 0,
      placement: matchData.placement || 0,
      idempotencyKey: matchData.idempotencyKey || crypto.randomUUID(),
    }),
  });
}

export async function getWithdrawHistory(userId) {
  const q = query(collection(db, "withdrawRequests"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function addWithdrawRequest(_userId, amount, upiId) {
  return secureApi("/api/economy", {
    method: "POST",
    body: JSON.stringify({
      action: "withdraw",
      amount,
      type: "UPI",
      upiId,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
}

export async function getUserProfile(userId) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function updateUserCoins() {
  throw new Error("Direct coin updates are disabled. Use a server-authoritative economy action.");
}

export async function incrementPlayerStats(userId, { matches = 0, kills = 0, booyah = 0, coins = 0, idempotencyKey = crypto.randomUUID() }) {
  if (!userId) throw new Error("User is required");
  if (coins !== 0) throw new Error("Direct coin/stat reward mutation is disabled");
  return secureApi("/api/player", {
    method: "POST",
    body: JSON.stringify({ action: "stats", matches, kills, booyah, idempotencyKey }),
  });
}
