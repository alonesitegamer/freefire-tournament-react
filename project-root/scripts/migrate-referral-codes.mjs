import admin from "firebase-admin";

const LEGACY_CODE = /^[A-Z0-9]{6,16}$/;
const CANONICAL_CODE = /^[A-Z0-9]{8}$/;

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT is required.");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (serviceAccount.private_key?.includes("\\n")) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const users = await db.collection("users").get();
let canonicalCreated = 0;
let aliasCreated = 0;
let alreadyPresent = 0;
const collisions = [];
const skipped = [];

for (const userDoc of users.docs) {
  const data = userDoc.data();
  const code = String(data.referralCode || "").trim().toUpperCase();

  if (!code || !LEGACY_CODE.test(code)) {
    if (code) skipped.push({ userId: userDoc.id, code, reason: "Unsupported legacy format" });
    continue;
  }

  const collectionName = CANONICAL_CODE.test(code) ? "referralCodes" : "referralAliases";
  const ref = db.collection(collectionName).doc(code);
  const existing = await ref.get();

  if (!existing.exists) {
    await ref.create({
      uid: userDoc.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      migrated: true,
      legacy: !CANONICAL_CODE.test(code),
    });
    if (CANONICAL_CODE.test(code)) canonicalCreated += 1;
    else aliasCreated += 1;
  } else if (existing.data()?.uid === userDoc.id) {
    alreadyPresent += 1;
  } else {
    collisions.push({
      code,
      collection: collectionName,
      existingUid: existing.data()?.uid,
      userId: userDoc.id,
    });
  }
}

console.log(JSON.stringify({
  scanned: users.size,
  canonicalCreated,
  aliasCreated,
  alreadyPresent,
  skipped,
  collisions,
}, null, 2));

if (collisions.length) process.exitCode = 2;
