const USERNAME_RE = /^[\p{L}\p{N}_. -]{3,24}$/u;
const UPI_RE = /^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9.-]{2,64}$/;

export function stringField(value, field, { min = 1, max = 256, pattern } = {}) {
  const valueString = String(value ?? "").trim();
  if (valueString.length < min || valueString.length > max) {
    const error = new Error(`${field} must be between ${min} and ${max} characters`);
    error.status = 400;
    throw error;
  }
  if (pattern && !pattern.test(valueString)) {
    const error = new Error(`Invalid ${field}`);
    error.status = 400;
    throw error;
  }
  return valueString;
}

export function optionalString(value, field, { max = 256 } = {}) {
  if (value == null || value === "") return "";
  return stringField(value, field, { min: 1, max });
}

export function username(value) {
  return stringField(value, "username", { min: 3, max: 24, pattern: USERNAME_RE });
}

export function upiId(value) {
  return stringField(value, "UPI ID", { min: 3, max: 100, pattern: UPI_RE });
}

export function finiteInt(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    const error = new Error(`Invalid ${field}`);
    error.status = 400;
    throw error;
  }
  return number;
}

export function requireBody(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    const error = new Error("Invalid request body");
    error.status = 400;
    throw error;
  }
  return req.body;
}
