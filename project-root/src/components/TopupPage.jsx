import React, { useState } from "react";
import { secureApi } from "../utils/apiClient";

export default function TopupPage() {
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState(50);
  const [showQR, setShowQR] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function selectAmount(value) {
    setSelected(value);
    setAmount(String(value));
    setShowQR(false);
  }

  function onPay() {
    const amt = Number(amount) || selected;
    if (!Number.isInteger(amt) || amt < 20) return alert("Minimum top-up ₹20");
    setShowQR(true);
  }

  async function confirmPayment() {
    const amt = Number(amount) || selected;
    if (!Number.isInteger(amt) || amt < 20) return alert("Minimum top-up ₹20");
    if (!upiId.trim()) return alert("Enter payer UPI ID (for verification)");

    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await secureApi("/api/economy", {
        method: "POST",
        body: JSON.stringify({ action: "topup", amount: amt, upiId: upiId.trim(), idempotencyKey }),
      });
      alert("Top-up request submitted. Admin will verify the payment before crediting coins.");
      setShowQR(false);
      setAmount("");
      setUpiId("");
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to submit top-up.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel glow-panel payment-page">
      <h3>Top-up Coins</h3>
      <p className="modern-subtitle">1 ₹ = 10 coins | Minimum ₹20</p>

      <div className="amount-options">
        {[20, 50, 100, 200].map((value) => (
          <button key={value} className={`amount-btn ${selected === value ? "selected" : ""}`} onClick={() => selectAmount(value)}>
            ₹{value} <div style={{ fontSize: 12, color: "var(--muted)" }}>{value * 10} coins</div>
          </button>
        ))}
      </div>

      <input
        className="modern-input"
        type="number"
        min="20"
        step="1"
        placeholder="Or enter custom amount ₹"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      {!showQR && <button className="btn large glow" onClick={onPay}>Pay</button>}

      {showQR && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <img src="/qr.jpg" alt="Payment QR code" className="qr-code-image" />
          <p className="muted-small">Scan the QR and send the exact amount. Then enter the payer UPI ID.</p>
          <input className="modern-input" placeholder="Payer UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn large glow" onClick={confirmPayment} disabled={submitting}>
              {submitting ? "Submitting..." : "I paid — Submit"}
            </button>
            <button className="btn large ghost" onClick={() => setShowQR(false)} disabled={submitting}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
