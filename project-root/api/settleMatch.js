import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Helper function to check if the caller is an admin
async function isAdmin(uid) {
  const userDoc = await db.doc(`users/${uid}`).get();
  if (!userDoc.exists) return false;
  const userEmail = userDoc.data().email;
  return (
    userEmail === 'esportsimperial50@gmail.com' ||
    userEmail === 'priyankabairagi036@gmail.com'
  );
}

export default async function handler(req, res) {
  // 1. Verify Admin & App Check
  const appCheckToken = req.headers['x-firebase-appcheck'];
  if (!appCheckToken) {
    return res.status(401).json({ success: false, message: "Unauthorized (No App Check token)." });
  }

  let decodedToken;
  try {
    decodedToken = await admin.appCheck().verifyToken(appCheckToken);
  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized (Invalid App Check token)." });
  }

  const isAdminUser = await isAdmin(decodedToken.uid);
  if (!isAdminUser) {
    return res.status(403).json({ success: false, message: "Forbidden. You are not an admin." });
  }

  // 2. Get data from the admin's form
  const { matchId, winnerUsername, kills } = req.body;

  if (!matchId || !winnerUsername) {
    return res.status(400).json({ success: false, message: "Match ID and Winner Username are required." });
  }

  try {
    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
      return res.status(404).json({ success: false, message: "Match not found." });
    }
    const matchData = matchSnap.data();

    // 3. Find the winner by their username
    const usersRef = db.collection("users");
    const q = usersRef.where("username", "==", winnerUsername);
    const userSnapshot = await q.get();

    if (userSnapshot.empty) {
      return res.status(404).json({ success: false, message: `User '${winnerUsername}' not found.` });
    }
    
    const winnerDoc = userSnapshot.docs[0];
    const winnerRef = winnerDoc.ref;
    
    // 4. Calculate the prize
    let totalPrize = 0;
    if (matchData.prizeModel === 'Fixed') {
      totalPrize = matchData.booyahPrize || 0;
    } else if (matchData.prizeModel === 'Scalable') {
      // (Booyah Prize)
      const commission = matchData.commissionPercent || 0;
      const totalCollection = matchData.entryFee * (matchData.playersJoined.length || 1);
      const totalPrizePool = totalCollection - (totalCollection * (commission / 100));
      const totalKills = (matchData.playersJoined.length || 1) - 1;
      const perKillPrize = matchData.perKillReward || 0;
      const totalKillPrize = totalKills * perKillPrize;
      const booyahPrize = totalPrizePool - totalKillPrize;
      
      // (Kill Prize)
      const winnerKills = parseInt(kills) || 0;
      const winnerKillPrize = winnerKills * perKillPrize;
      
      totalPrize = booyahPrize + winnerKillPrize;
    }

    if (totalPrize <= 0) {
      // Safety check
      totalPrize = 0;
    }

    // 5. Run the transaction to pay winner and end match
    await db.runTransaction(async (t) => {
      // Pay the winner
      t.update(winnerRef, { coins: admin.firestore.FieldValue.increment(totalPrize) });
      
      // Mark match as completed
      t.update(matchRef, { 
        status: 'completed',
        winner: winnerUsername,
        winnerKills: parseInt(kills) || 0
      });
    });

    return res.status(200).json({ success: true, message: `Successfully paid ${totalPrize} coins to ${winnerUsername} and completed the match.` });

  } catch (err) {
    console.error("Settle match error:", err);
    return res.status(500).json({ success: false, message: "An internal server error occurred." });
  }
}
