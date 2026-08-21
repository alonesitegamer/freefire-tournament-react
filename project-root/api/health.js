import { getAdmin, handleError, json, method } from "./_firebaseAdmin.js";

export default async function handler(req, res) {
  try {
    method(req, "GET");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const missing = ["FIREBASE_SERVICE_ACCOUNT", "OTP_EMAIL", "OTP_PASS"].filter((name) => !process.env[name]);
    let firebase = "unconfigured";
    if (!missing.includes("FIREBASE_SERVICE_ACCOUNT")) {
      try {
        getAdmin();
        firebase = "configured";
      } catch {
        firebase = "invalid";
      }
    }
    const healthy = missing.length === 0 && firebase === "configured";
    return json(res, healthy ? 200 : 503, {
      status: healthy ? "ok" : "degraded",
      service: "imperial-esports",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
      environment: process.env.VERCEL_ENV || "unknown",
      checks: {
        firebaseAdmin: firebase,
        otp: missing.includes("OTP_EMAIL") || missing.includes("OTP_PASS") ? "unconfigured" : "configured",
      },
      missing,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
