// src/components/TopupPage.jsx
import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function TopupPage({ user, profile }) {
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [custom, setCustom] = useState("");
  const [upi, setUpi] = useState("");
  const [stage, setStage] = useState("select"); // select -> pay -> confirm
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    const amt = parseInt(selectedAmount || custom);
    if (!amt || amt < 20) return alert("Minimum top-up ₹20");
    if (!upi) return alert("Please enter your UPI ID before paying.");
    setStage("pay");
  }

  async function handleConfirm() {
    const amt = parseInt(selectedAmount || custom);
    if (!amt) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: profile.email,
        amount: amt,
        coins: amt * 10, // 1 ₹ = 10 coins per your earlier choice
        upiId: upi,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      alert("Top-up request submitted. Admin will verify.");
      setSelectedAmount(null);
      setCustom("");
      setUpi("");
      setStage("select");
    } catch (err) {
      console.error("topup error", err);
      alert("Failed to submit top-up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="modern-card">
      {stage === "select" && (
        <>
          <h3 className="modern-title">Top-up Coins</h3>
          <p className="modern-subtitle">1 ₹ = 10 coins | Min ₹20</p>
          <div className="amount-options">
            {[20,50,100,200].map(a => (
              <div key={a} className={`amount-btn ${selectedAmount===a?"selected":""}`} onClick={()=>{ setSelectedAmount(a); setCustom(""); }}>
                ₹{a} = {a*10} Coins
              </div>
            ))}
          </div>
          <input type="number" className="modern-input" placeholder="Custom amount ₹" value={custom} onChange={(e)=>{ setCustom(e.target.value); setSelectedAmount(null); }} />
          <input type="text" className="modern-input" placeholder="Your UPI ID (for verification)" value={upi} onChange={(e)=>setUpi(e.target.value)} />
          <button className="btn glow large" onClick={handlePay}>Pay</button>
        </>
      )}

      {stage === "pay" && (
        <>
          <h3 className="modern-title">Scan & Pay</h3>
          <p className="modern-subtitle">Scan QR and pay ₹{selectedAmount || custom}</p>
          <img src="/qr.jpg" alt="qr" className="qr-code-image" />
          <p style={{marginTop:12}}>You provided UPI: <strong>{upi}</strong></p>
          <button className="btn glow large" onClick={handleConfirm} disabled={loading}>{loading ? "Submitting..." : "I Have Paid"}</button>
          <button className="btn large ghost" onClick={()=>setStage("select")} style={{marginTop:8}}>Back</button>
        </>
      )}
    </section>
  );
}
