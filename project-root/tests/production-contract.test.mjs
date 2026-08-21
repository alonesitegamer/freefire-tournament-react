import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Firestore has a default deny boundary", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/\{document=\*\*\}/);
  assert.match(rules, /allow read, write: if false/);
});

test("Referral system has canonical and legacy resolution plus idempotency", () => {
  const referral = read("api/referral.js");
  assert.match(referral, /referralCodes/);
  assert.match(referral, /referralAliases/);
  assert.match(referral, /referralClaims/);
  assert.match(referral, /REFERRER_BONUS = 20/);
  assert.match(referral, /REFERRED_BONUS = 20/);
});

test("Tournament settlement is server-authoritative and idempotent", () => {
  const settlement = read("api/admin-results.js");
  assert.match(settlement, /requireAdminWithAppCheck/);
  assert.match(settlement, /settlements/);
  assert.match(settlement, /economyLedger/);
  assert.match(settlement, /status: \"completed\"/);
});

test("Room secrets are server-only", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/matchSecrets\/\{matchId\}/);
  assert.match(rules, /allow read, write: if false/);
});

test("Client API path carries both Auth and App Check", () => {
  const apiClient = read("src/utils/apiClient.js");
  assert.match(apiClient, /Authorization: `Bearer \$\{idToken\}`/);
  assert.match(apiClient, /X-Firebase-AppCheck/);
});

test("Release health endpoint exists", () => {
  const health = read("api/health.js");
  assert.match(health, /FIREBASE_SERVICE_ACCOUNT/);
  assert.match(health, /OTP_EMAIL/);
  assert.match(health, /OTP_PASS/);
});

test("Production release gate intentionally blocks missing lockfile", () => {
  const gate = read("scripts/release-gate.mjs");
  assert.match(gate, /package-lock\.json/);
  assert.match(gate, /process\.exit\(1\)/);
});
