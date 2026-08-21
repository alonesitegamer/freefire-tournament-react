import { getAdmin } from "./_firebaseAdmin.js";

/**
 * Firestore-backed fixed-window limiter.
 * This is intentionally server-side so refreshing/changing browser state
 * cannot reset the abuse counter.
 */
export async function rateLimit({ key, limit, windowSeconds }) {
  const admin = getAdmin();
  const db = admin.firestore();
  const ref = db.collection("rateLimits").doc(key);
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : null;
    const active = current && nowMs - Number(current.windowStartedAt || 0) < windowMs;
    const count = active ? Number(current.count || 0) : 0;

    if (count >= limit) return false;

    tx.set(
      ref,
      {
        count: count + 1,
        windowStartedAt: active ? current.windowStartedAt : nowMs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  });
}
