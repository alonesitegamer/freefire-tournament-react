import React, { useState } from "react";
import { secureApi } from "../utils/apiClient";

export default function WithdrawPage({ profile }) {
  const [method, setMethod] = useState("UPI");
  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState(profile?.upiId || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const amounts = [50, 100, 200];

  async function submitRequest() {
    const amt = Number(amount);
    if (![50, 100, 200].includes(amt)) return alert("Choose a valid amount (50/100/200).");
    if (method === "UPI" && !upiId.trim()) return alert("Enter your UPI ID (required for UPI).");

    setSubmitting(true);
    try {
      await secureApi("/api/economy", {
        method: "POST",
        body: JSON.stringify({
          action: "withdraw",
          amount: amt,
          type: method,
          upiId: method === "UPI" ? upiId.trim() : "",
          email: email.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      alert("Withdrawal request submitted. Your coin balance has been reserved until the request is approved or rejected.");
      setAmount("");
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to submit withdrawal request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel glow-panel">
      <h3>Withdraw</h3>
      <p className="modern-subtitle">10% commission. Minimum ₹50.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["UPI", "Google Play", "Amazon"].map((value) => (
          <button key={value} className={`amount-btn ${method === value ? "selected" : ""}`} onClick={() => setMethod(value)}>
            {value}
          </button>
        ))}
      </div>

      <div className="amount-options" style={{ marginBottom: 14 }}>
        {amounts.map((value) => (
          <button key={value} className={`amount-btn ${Number(amount) === value ? "selected" : ""}`} onClick={() => setAmount(String(value))}>
            ₹{value}
          </button>
        ))}
      </div>

      <input className="modern-input" type="number" min="50" placeholder="Enter amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} />

      {method === "UPI" && (
        <input className="modern-input" placeholder="Enter your UPI ID (required)" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
      )}

      {(method === "Google Play" || method === "Amazon") && (
        <input className="modern-input" type="email" placeholder="Email for gift card (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
      )}

      <button className="btn large glow" onClick={submitRequest} disabled={submitting}>
        {submitting ? "Submitting..." : "Request Withdrawal"}
      </button>
    </section>
  );
}
