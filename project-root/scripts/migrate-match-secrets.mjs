import admin from "firebase-admin";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT is required.");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (serviceAccount.private_key?.includes("\\n")) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const matches = await db.collection("matches").get();
let migrated = 0;
let skipped = 0;
let batch = db.batch();
let batchCount = 0;

for (const matchDoc of matches.docs) {
  const data = matchDoc.data();
  if (data.roomID === undefined && data.roomPassword === undefined) {
    skipped += 1;
    continue;
  }

  const secretRef = db.collection("matchSecrets").doc(matchDoc.id);
  batch.set(secretRef, {
    matchId: matchDoc.id,
    roomID: String(data.roomID || ""),
    roomPassword: String(data.roomPassword || ""),
    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  batch.update(matchDoc.ref, {
    roomID: admin.firestore.FieldValue.delete(),
    roomPassword: admin.firestore.FieldValue.delete(),
  });

  migrated += 1;
  batchCount += 2;
  if (batchCount >= 400) {
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }
}

if (batchCount > 0) await batch.commit();
console.log(`Migrated ${migrated} match secret records; ${skipped} matches needed no migration.`);
