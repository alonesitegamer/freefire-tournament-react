import admin from "firebase-admin";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT is required.");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (serviceAccount.private_key?.includes("\\n")) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const users = await db.collection("users").get();
let created = 0;
let alreadyPresent = 0;
const collisions = [];

for (const userDoc of users.docs) {
  const data = userDoc.data();
  const code = String(data.referralCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) continue;

  const ref = db.collection("referralCodes").doc(code);
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.create({ uid: userDoc.id, createdAt: admin.firestore.FieldValue.serverTimestamp(), migrated: true });
    created += 1;
  } else if (existing.data()?.uid === userDoc.id) {
    alreadyPresent += 1;
  } else {
    collisions.push({ code, existingUid: existing.data()?.uid, userId: userDoc.id });
  }
}

console.log(JSON.stringify({ scanned: users.size, created, alreadyPresent, collisions }, null, 2));
if (collisions.length) process.exitCode = 2;
