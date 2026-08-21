import { getAdmin, handleError, json, method, requireAdminWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

function serialize(doc) {
  const data = doc.data();
  return { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null, processedAt: data.processedAt?.toDate?.()?.toISOString?.() || null };
}

export default async function handler(req, res) {
  try {
    method(req, "GET");
    const { user } = await requireAdminWithAppCheck(req);
    const allowed = await rateLimit({ key: `admin-queue:${user.uid}`, limit: 60, windowSeconds: 60 });
    if (!allowed) return json(res, 429, { error: "Too many requests" });
    const db = getAdmin().firestore();
    const [topups, withdrawals] = await Promise.all([
      db.collection("topupRequests").where("status", "==", "pending").orderBy("createdAt", "asc").limit(200).get(),
      db.collection("withdrawRequests").where("status", "==", "pending").orderBy("createdAt", "asc").limit(200).get(),
    ]);
    return json(res, 200, {
      topup: topups.docs.map(serialize),
      withdraw: withdrawals.docs.map(serialize),
    });
  } catch (error) { return handleError(res, error); }
}
