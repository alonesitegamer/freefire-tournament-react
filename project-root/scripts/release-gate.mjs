import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function exists(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) failures.push(`Missing required release artifact: ${relativePath}`);
}

function contains(relativePath, text, message) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) {
    failures.push(`Cannot inspect missing file: ${relativePath}`);
    return;
  }
  const content = fs.readFileSync(full, "utf8");
  if (!content.includes(text)) failures.push(message);
}

for (const file of [
  "firestore.rules",
  "storage.rules",
  "firebase.json",
  "api/health.js",
  "api/economy.js",
  "api/referral.js",
  "api/matches.js",
  "api/admin-matches.js",
  "api/admin-results.js",
  "scripts/migrate-match-secrets.mjs",
  "scripts/migrate-referral-codes.mjs",
]) exists(file);

contains("firestore.rules", "match /{document=**}", "Firestore must have a default deny catch-all rule.");
contains("firestore.rules", "match /economyLedger/{id}", "Economy ledger rules are missing.");
contains("storage.rules", "allow read, write: if false", "Storage must be closed until an explicit upload policy exists.");
contains("api/economy.js", "requireUserWithAppCheck", "Economy API must require user authentication and App Check.");
contains("api/admin-results.js", "settlements", "Settlement endpoint must persist an idempotency record.");
contains("api/referral.js", "referralClaims", "Referral API must persist a one-time claim record.");
contains("scripts/migrate-referral-codes.mjs", "referralAliases", "Legacy referral aliases must be migratable.");

if (fs.existsSync(path.join(root, ".env"))) {
  failures.push("Tracked/local .env must not be present in the release tree.");
}

if (!fs.existsSync(path.join(root, "package-lock.json"))) {
  failures.push("package-lock.json is missing. Generate and commit it before the production merge so CI can use npm ci.");
}

if (failures.length) {
  console.error("RELEASE GATE: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RELEASE GATE: PASS");
