import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "api/health.js",
  "api/ready.js",
  "firestore.rules",
  "storage.rules",
  "docs/PHASE5_RELEASE_GATE.md",
  "docs/PHASE6_OPERATIONS.md",
  "scripts/migrate-match-secrets.mjs",
  "scripts/migrate-referral-codes.mjs",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing operational files:\n${missing.join("\n")}`);
  process.exit(1);
}

const envExample = fs.existsSync(path.join(root, ".env.example"));
if (!envExample) {
  console.error("Missing .env.example");
  process.exit(1);
}

const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
if (!rules.includes("match /{document=**}")) {
  console.error("Firestore rules do not contain a final deny-all guard");
  process.exit(1);
}

console.log("Operational readiness checks passed.");
