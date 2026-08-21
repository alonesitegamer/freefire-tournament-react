import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
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
  "tests/production-contract.test.mjs",
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}`);
}
if (fs.existsSync(path.join(root, ".env"))) failures.push(".env must not be present");

const rules = fs.existsSync(path.join(root, "firestore.rules")) ? fs.readFileSync(path.join(root, "firestore.rules"), "utf8") : "";
if (!rules.includes("match /{document=**}")) failures.push("Firestore default deny boundary missing");
if (!rules.includes("match /economyLedger/{id}")) failures.push("Economy ledger rules missing");
if (!rules.includes("match /matchSecrets/{matchId}")) failures.push("Match secret rules missing");

const workflow = path.join(root, "..", ".github", "workflows", "phase1-ci.yml");
if (!fs.existsSync(workflow)) failures.push("Security CI workflow missing");

if (failures.length) {
  console.error("RELEASE CHECK: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const lockfile = fs.existsSync(path.join(root, "package-lock.json"));
console.log(`RELEASE CHECK: PASS (lockfile ${lockfile ? "present" : "missing; manual release prerequisite"})`);
