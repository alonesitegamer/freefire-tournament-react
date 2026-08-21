import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

async function read(file) {
  return fs.readFile(path.join(root, file), "utf8");
}

test("referral endpoint has one-time claim and legacy alias resolution", async () => {
  const source = await read("api/referral.js");
  assert.match(source, /referralClaims/);
  assert.match(source, /referralAliases/);
  assert.match(source, /welcomeBonusGiven/);
  assert.match(source, /tx\.create\(userRef/);
  assert.match(source, /tx\.update\(effectiveReferrerRef/);
});

test("custom API client uses limited-use App Check tokens", async () => {
  const source = await read("src/utils/apiClient.js");
  assert.match(source, /getLimitedUseToken/);
  assert.doesNotMatch(source, /getToken\(appCheckInstance/);
});

test("Firestore rules deny direct browser access", async () => {
  const source = await read("firestore.rules");
  assert.match(source, /match \/users\/\{uid\} \{ allow read, write: if false; \}/);
  assert.match(source, /match \/matches\/\{matchId\} \{ allow read, write: if false; \}/);
  assert.match(source, /match \/economyLedger\/\{id\} \{ allow read, write: if false; \}/);
});

test("result settlement is idempotent and atomic", async () => {
  const source = await read("api/admin-results.js");
  assert.match(source, /settlements/);
  assert.match(source, /runTransaction/);
  assert.match(source, /alreadySettled/);
  assert.match(source, /match_payout/);
  assert.match(source, /status: \"completed\"/);
});

test("security checks include referral migration and settlement", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.match(packageJson.scripts["check:api"], /admin-results\.js/);
  assert.match(packageJson.scripts["check:security"], /migrate-referral-codes\.mjs/);
});
