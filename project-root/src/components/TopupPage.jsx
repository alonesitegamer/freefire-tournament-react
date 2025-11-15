// src/components/TopupPage.jsx
import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function TopupPage({ user, profile }) {
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState(50);
  const [showQR, setShowQR] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function selectAmount(a) {
    setSelected(a);
    setAmount(String(a));
    setShowQR(false);
  }

  async function onPay() {
    const amt = Number(amount) || selected;
    if (!amt || amt < 20) return alert("Minimum top-up ₹20");
    // show QR first
    setShowQR(true);
  }

  async function confirmPayment() {
    if (!upiId) return alert("Enter payer UPI ID (for verification)");
    setSubmitting(true);
    try {
      await addDoc(collection(db, "topupRequests"), {
        userId: user.uid,
        email: user.email,
        amount: Number(amount) || Number(selected),
        upiId,
        coins: (Number(amount) || Number(selected)) * 10, // 1₹ = 10 coins
        status: "pending",
        createdAt: serverTimestamp(),
      });
      alert("Top-up request submitted. Admin will verify.");
      setShowQR(false);
      setAmount("");
      setUpiId("");
    } catch (err) {
      console.error(err);
      alert("Failed to submit top-up.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel glow-panel payment-page">
      <h3>Top-up Coins</h3>
      <p className="modern-subtitle">1 ₹ = 10 coins | Minimum ₹20</p>

      <div className="amount-options">
        {[20,50,100,200].map(a => (
          <button key={a} className={`amount-btn ${selected===a ? "selected":""}`} onClick={() => selectAmount(a)}>
            ₹{a} <div style={{fontSize:12, color:"var(--muted)"}}>{a*10} coins</div>
          </button>
        ))}
      </div>

      <input className="modern-input" placeholder="Or enter custom amount ₹" value={amount} onChange={e=>setAmount(e.target.value)} />

      {!showQR && <button className="btn large glow" onClick={onPay}>Pay</button>}

      {showQR && (
        <div style={{marginTop:16, textAlign:"center"}}>
          <img src="/qr.jpg" alt="qr" className="qr-code-image" />
          <p className="muted-small">Scan QR and send exact amount. Enter payer UPI ID below (required).</p>
          <input className="modern-input" placeholder="Payer UPI ID" value={upiId} onChange={e=>setUpiId(e.target.value)} />
          <div style={{display:"flex", gap:8, justifyContent:"center"}}>
            <button className="btn large glow" onClick={confirmPayment} disabled={submitting}>{submitting ? "Submitting..." : "I paid — Submit"}</button>
            <button className="btn large ghost" onClick={()=>setShowQR(false)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
