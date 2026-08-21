import admin from "firebase-admin";

let initialized = false;

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const serviceAccount = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (serviceAccount.private_key?.includes("\\n")) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    return serviceAccount;
  } catch {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON");
  }
}

export function getAdmin() {
  if (!initialized) {
    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured");
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
  }
  return admin;
}

export async function requireUser(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Authentication required"); error.status = 401; throw error;
  }
  try {
    return await getAdmin().auth().verifyIdToken(authorization.slice(7).trim(), true);
  } catch {
    const error = new Error("Invalid or expired authentication token"); error.status = 401; throw error;
  }
}

export async function requireAppCheck(req) {
  const token = req.headers["x-firebase-appcheck"];
  if (!token) {
    const error = new Error("App Check required"); error.status = 401; throw error;
  }
  try {
    const result = await getAdmin().appCheck().verifyToken(token);
    if (result.alreadyConsumed) {
      const error = new Error("App Check token replay detected"); error.status = 401; throw error;
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    const unauthorized = new Error("Invalid App Check token"); unauthorized.status = 401; throw unauthorized;
  }
}

export async function requireUserWithAppCheck(req) {
  const [user, appCheck] = await Promise.all([requireUser(req), requireAppCheck(req)]);
  return { user, appCheck };
}

export async function requireAdmin(req) {
  const decoded = await requireUser(req);
  if (decoded.admin !== true) {
    const error = new Error("Admin access required"); error.status = 403; throw error;
  }
  return decoded;
}

export async function requireAdminWithAppCheck(req) {
  const [{ user }, appCheck] = await Promise.all([
    requireUserWithAppCheck(req),
    requireAppCheck(req),
  ]);
  if (user.admin !== true) {
    const error = new Error("Admin access required"); error.status = 403; throw error;
  }
  return { user, appCheck };
}

export function json(res, status, body) { return res.status(status).json(body); }
export function method(req, expected) {
  if (req.method !== expected) {
    const error = new Error("Method not allowed"); error.status = 405; error.allow = expected; throw error;
  }
}
export function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
export function positiveInt(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    const error = new Error(`${field} must be a positive integer`); error.status = 400; throw error;
  }
  return number;
}
export function handleError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  if (error?.allow) res.setHeader("Allow", error.allow);
  return json(res, status, { error: status >= 500 ? "Internal server error" : error.message });
}
