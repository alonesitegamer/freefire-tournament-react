import { getAdmin, handleError, json, method } from "./_firebaseAdmin.js";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
};

export default async function handler(req, res) {
  try {
    method(req, "GET");
    Object.entries(RESPONSE_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

    const missing = ["FIREBASE_SERVICE_ACCOUNT", "OTP_EMAIL", "OTP_PASS"].filter((name) => !process.env[name]);
    const checks = { firebaseAdmin: "unconfigured", firestore: "unconfigured", otp: "unconfigured" };

    if (!missing.includes("FIREBASE_SERVICE_ACCOUNT")) {
      try {
        const admin = getAdmin();
        checks.firebaseAdmin = "configured";
        await admin.firestore().collection("_health").doc("readiness").get();
        checks.firestore = "reachable";
      } catch {
        checks.firebaseAdmin = "invalid";
        checks.firestore = "unreachable";
      }
    }

    if (!missing.includes("OTP_EMAIL") && !missing.includes("OTP_PASS")) checks.otp = "configured";

    const ready = missing.length === 0 && checks.firebaseAdmin === "configured" && checks.firestore === "reachable" && checks.otp === "configured";
    return json(res, ready ? 200 : 503, {
      status: ready ? "ready" : "not_ready",
      service: "imperial-esports",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
      checks,
      missing,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
