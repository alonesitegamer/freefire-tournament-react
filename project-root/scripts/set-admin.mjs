import admin from "firebase-admin";

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/set-admin.mjs <firebase-uid>");
  process.exit(1);
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT is required.");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (serviceAccount.private_key?.includes("\\n")) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
await admin.auth().setCustomUserClaims(uid, { admin: true });
console.log(`Admin claim granted to ${uid}. The user must refresh/sign in again to receive the new ID token.`);
