import { getAdmin, handleError, json, method, requireAdminWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

export default async function handler(req, res) {
  try {
    method(req, "GET");
    const { user } = await requireAdminWithAppCheck(req);
    const allowed = await rateLimit({ key: `admin-queue:${user.uid}`, limit: 30, windowSeconds: 60 });
    if (!allowed) return json(res, 429, { error: "Too many requests" });

    const db = getAdmin().firestore();
    const [topupSnap, withdrawSnap] = await Promise.all([
      db.collection("topupRequests").where("status", "==", "pending").limit(100).get(),
      db.collection("withdrawRequests").where("status", "==", "pending").limit(100).get(),
    ]);

    return json(res, 200, {
      topup: topupSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
      withdraw: withdrawSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    });
  } catch (error) {
    return handleError(res, error);
  }
}
