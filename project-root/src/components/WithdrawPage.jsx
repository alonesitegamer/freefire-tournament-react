// src/components/WithdrawPage.jsx
import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function WithdrawPage({ profile }) {
  const [method, setMethod] = useState("UPI");
  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState(profile.upiId || "");
  const [email, setEmail] = useState(profile.email || "");
  const [submitting, setSubmitting] = useState(false);

  const amounts = [50, 100, 200];

  function selectAmt(a) {
    setAmount(String(a));
  }

  async function submitRequest() {
    const amt = Number(amount);
    if (!amt || ![50,100,200].includes(amt)) return alert("Choose a valid amount (50/100/200).");
    if (method === "UPI" && !upiId) return alert("Enter your UPI ID (required for UPI).");
    if ((method === "Google Play" || method === "Amazon") && !email) {
      // optional, but allow empty (use sign-in email)
      // we accept empty because user email is known
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "withdrawRequests"), {
        userId: profile.id,
        email: email || profile.email,
        amount: amt,
        type: method,
        upiId: method === "UPI" ? upiId : "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      alert("Withdraw request submitted. Admin will process.");
      setAmount("");
    } catch (err) {
      console.error(err);
      alert("Failed to submit withdraw request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel glow-panel">
      <h3>Withdraw</h3>
      <p className="modern-subtitle">10% commission. Minimum ₹50.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["UPI", "Google Play", "Amazon"].map(m => (
          <button key={m} className={`amount-btn ${method===m ? "selected":""}`} onClick={()=>setMethod(m)}>{m}</button>
        ))}
      </div>

      <div className="amount-options" style={{ marginBottom: 14 }}>
        {amounts.map(a => (
          <button key={a} className={`amount-btn ${Number(amount)===a ? "selected":""}`} onClick={() => selectAmt(a)}>₹{a}</button>
        ))}
      </div>

      <input className="modern-input" placeholder="Enter amount ₹" value={amount} onChange={e=>setAmount(e.target.value)} />

      {method === "UPI" && (
        <input className="modern-input" placeholder="Enter your UPI ID (required)" value={upiId} onChange={e=>setUpiId(e.target.value)} />
      )}

      {(method === "Google Play" || method === "Amazon") && (
        <input className="modern-input" placeholder="Email for gift card (optional)" value={email} onChange={e=>setEmail(e.target.value)} />
      )}

      <button className="btn large glow" onClick={submitRequest} disabled={submitting}>
        {submitting ? "Submitting..." : "Request Withdrawal"}
      </button>
    </section>
  );
}
