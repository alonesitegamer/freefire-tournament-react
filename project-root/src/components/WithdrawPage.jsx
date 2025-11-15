// src/components/WithdrawPage.jsx
import React, { useState } from "react";
import { addDoc, collection, serverTimestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Withdraw rules:
 * - min ₹50
 * - commission 10% (so user needs coins = ceil(amount * 1.1))
 * - admin approves and sends UPI manually
 * - gift card redemptions (Google/Amazon) optional send to email
 */
export default function WithdrawPage({ profile, onRequested }) {
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState(profile?.upiId || "");
  const [type, setType] = useState("UPI");
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    const amt = parseInt(amount);
    if (!amt || amt < 50) return alert("Minimum withdrawal is ₹50.");
    if (type === "UPI" && !upi) return alert("Please set your UPI ID to receive payment.");
    const coinsNeeded = Math.ceil(amt * 1.1); // 10% commission
    if ((profile.coins || 0) < coinsNeeded) return alert(`You need ${coinsNeeded} coins (including 10% commission).`);

    setLoading(true);
    try {
      await addDoc(collection(db, "withdrawRequests"), {
        userId: profile.id,
        email: profile.email,
        amount: amt,
        coinsDeducted: coinsNeeded,
        type,
        upiId: type === "UPI" ? upi : null,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      // deduct coins immediately
      const userRef = doc(db, "users", profile.id);
      await updateDoc(userRef, { coins: profile.coins - coinsNeeded });
      alert("Withdrawal requested. Admin will process it.");
      setAmount("");
      if (typeof onRequested === "function") onRequested();
    } catch (err) {
      console.error("withdraw error", err);
      alert("Failed to submit request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="modern-card">
      <h3 className="modern-title">Withdraw</h3>
      <p className="modern-subtitle">10% commission applied</p>
      <div style={{display:"flex", gap:8, marginBottom:12}}>
        <button className={`btn ${type==='UPI'?'glow':''}`} onClick={()=>setType("UPI")}>UPI</button>
        <button className={`btn ${type==='Google Play'?'glow':''}`} onClick={()=>setType("Google Play")}>Google Play</button>
        <button className={`btn ${type==='Amazon'?'glow':''}`} onClick={()=>setType("Amazon")}>Amazon</button>
      </div>

      <input type="number" className="modern-input" placeholder="Enter amount ₹" value={amount} onChange={(e)=>setAmount(e.target.value)} />
      {type === "UPI" && (
        <input type="text" className="modern-input" placeholder="Enter your UPI ID" value={upi} onChange={(e)=>setUpi(e.target.value)} />
      )}
      <div style={{marginTop:8, marginBottom:12}}>
        <small>Coins required: {amount ? Math.ceil(parseInt(amount) * 1.1) : "—"}</small>
      </div>
      <button className="btn glow large" onClick={handleRequest} disabled={loading}>{loading ? "Submitting..." : "Request Withdrawal"}</button>
    </section>
  );
}
