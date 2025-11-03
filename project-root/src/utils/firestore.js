// src/utils/firestore.js (or similar path)
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase"; // Assuming your firebase.js export is correct

/**
 * Fetches the user's last 10 match history records.
 * @param {string} userId - The UID of the current user.
 * @returns {Array} List of match history documents.
 */
export async function fetchMatchHistory(userId) {
  if (!userId) return [];
  
  const matchQuery = query(
    collection(db, "match_history"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  
  const matchSnap = await getDocs(matchQuery);
  return matchSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Fetches the user's last 10 withdrawal history records.
 * @param {string} userId - The UID of the current user.
 * @returns {Array} List of withdrawal history documents.
 */
export async function fetchWithdrawalHistory(userId) {
  if (!userId) return [];
  
  const withdrawalQuery = query(
    collection(db, "withdrawals"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  
  const withdrawalSnap = await getDocs(withdrawalQuery);
  return withdrawalSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}
