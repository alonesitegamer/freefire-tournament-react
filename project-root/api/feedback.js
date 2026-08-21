import { getAdmin, handleError, json, method, requireUserWithAppCheck } from "./_firebaseAdmin.js";
import { rateLimit } from "./_rateLimit.js";

export default async function handler(req, res) {
  try {
    method(req, "POST");
    const { user } = await requireUserWithAppCheck(req);
    const allowed = await rateLimit({ key: `feedback:${user.uid}`, limit: 10, windowSeconds: 3600 });
    if (!allowed) return json(res, 429, { error: "Too many feedback submissions" });
    const text = String(req.body?.text || "").trim();
    if (!text || text.length > 3000) return json(res, 400, { error: "Feedback must be 1-3000 characters" });

    const admin = getAdmin();
    await admin.firestore().collection("feedback").add({
      userId: user.uid,
      email: user.email || "",
      text,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "new",
    });
    return json(res, 201, { success: true });
  } catch (error) { return handleError(res, error); }
}
