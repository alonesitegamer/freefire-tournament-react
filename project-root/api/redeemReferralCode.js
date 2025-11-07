import admin from 'firebase-admin';

// This is the Firebase Admin key you set in Vercel
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK);

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // 1. Check if the user is logged in (via App Check token)
  const appCheckToken = req.headers['x-firebase-appcheck'];
  if (!appCheckToken) {
    return res.status(401).json({ success: false, message: "Unauthorized. No App Check token." });
  }

  let decodedToken;
  try {
    // Verify the App Check token
    decodedToken = await admin.appCheck().verifyToken(appCheckToken);
  } catch (err) {
    console.error("App Check verification failed:", err);
    return res.status(401).json({ success: false, message: "Unauthorized. Invalid App Check token." });
  }

  // 2. Get the user ID (referee) and the code they sent
  const refereeUid = decodedToken.uid;
  const { code } = req.body;

  if (!refereeUid) {
    return res.status(401).json({ success: false, message: "Invalid user." });
  }
  if (!code) {
    return res.status(400).json({ success: false, message: "No code provided." });
  }

  // 3. Get the referee's (current user's) document
  const refereeRef = db.doc(`users/${refereeUid}`);
  const refereeSnap = await refereeRef.get();
  if (!refereeSnap.exists) {
    return res.status(404).json({ success: false, message: "Your user profile not found." });
  }

  const refereeData = refereeSnap.data();

  // 4. Run checks
  if (refereeData.hasRedeemedReferral) {
    return res.status(400).json({ success: false, message: "You have already redeemed a referral code." });
  }
  if (refereeData.referralCode === code) {
    return res.status(400).json({ success: false, message: "You cannot use your own referral code." });
  }

  // 5. Find the referrer (the code owner)
  const usersRef = db.collection("users");
  const q = usersRef.where("referralCode", "==", code);
  const querySnapshot = await q.get();

  if (querySnapshot.empty) {
    return res.status(404).json({ success: false, message: "Invalid referral code." });
  }

  const referrerDoc = querySnapshot.docs[0];
  const referrerRef = referrerDoc.ref;

  // 6. Pay both users in a secure "transaction"
  try {
    await db.runTransaction(async (t) => {
      // Pay the referrer (friend) 20 coins
      t.update(referrerRef, { coins: admin.firestore.FieldValue.increment(20) });
      
      // Pay the referee (current user) 50 coins and mark as redeemed
      t.update(refereeRef, {
        coins: admin.firestore.FieldValue.increment(50),
        hasRedeemedReferral: true,
      });
    });

    return res.status(200).json({ success: true, message: "Success! You received 50 coins, and your friend received 20 coins." });

  } catch (e) {
    console.error("Referral transaction failed:", e);
    return res.status(500).json({ success: false, message: "An error occurred during the transaction." });
  }
}
