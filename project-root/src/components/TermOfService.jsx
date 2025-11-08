// In src/components/TermOfService.jsx

import React from 'react';
// THIS IMPORT IS NOW FIXED to match your file name "TermOfService.css"
import './TermOfService.css'; 

const TermsOfService = () => {
  return (
    <div className="tos-container">
      <h1>Terms of Service</h1>
      <p>Last Updated: 05-Nov-2025</p>

      <p>
        Please read these Terms of Service ("Terms", "Terms of Service") carefully
        before using the https://freefire-tournament-react.vercel.app/ website
        (the "Service") operated by Imperial x eSports ("us", "we", or "our").
      </p>

      <p>
        Your access to and use of the Service is conditioned on your acceptance
        of and compliance with these Terms. These Terms apply to all visitors,
        users, and others who access or use the Service.
      </p>

      <h2>1. Accounts</h2>
      <p>
        When you create an account with us, you must provide us with information
        that is accurate, complete, and current at all times. Failure to do so
        constitutes a breach of the Terms, which may result in immediate
        termination of your account on our Service.
      </p>
      <p>
        You are responsible for safeguarding the password that you use to access
        the Service and for any activities or actions under your password.
      </p>

      {/* THIS IS YOUR CUSTOM SECTION */}
      <h2>2. App Currency, Top-Ups, and Withdrawals</h2>
      
      <h3>2.1. In-App Currency</h3>
      <p>
        Our Service uses an in-app currency called "coins." The value of this
        currency is set at <strong>10 coins = 1 Rupee (INR)</strong>. This rate is
        subject to change, but the value at the time of top-up or withdrawal
        will be honored.
      </p>
      
      <h3>2.2. Account Top-Up (Manual UPI)</h3>
      <p>
        All account top-ups are processed <strong>manually</strong> via UPI (Unified Payments
        Interface).
      </p>
      <ul>
        <li>
          To add funds, you must scan the provided QR code and complete your
          payment.
        </li>
        <li>
          After payment, you <strong>must</strong> send your transaction ID and registered
          account email to <strong>priyankabairagi036@gmail.com</strong> as proof of payment.
        </li>
        <li>
          Please allow up to <strong>24 hours</strong> for the coins to be manually credited
          to your account after we have verified the payment. We are not
          responsible for delays if you provide incorrect information.
        </li>
      </ul>

      <h3>2.3. Withdrawals</h3>
      <ul>
        <li>The minimum withdrawal amount is <strong>50 Rupees</strong> (equivalent to 500 coins).</li>
        <li>
          Withdrawals are processed to your provided UPI ID or as a Redeem Code.
        </li>
        <li>
          All withdrawal requests are processed manually. Please allow
          <strong>3-5 business days</strong> for your request to be reviewed and funds to
          be sent.
        </li>
      </ul>

      <h3>2.4. Rewarded Advertisements</h3>
      <p>
        Users may earn coins by voluntarily watching rewarded advertisements.
        Coins earned in this manner are subject to the same terms and
        withdrawal rules as purchased coins.
      </p>

      <h2>3. Account Termination</h2>
      <p>
        We reserve the right to suspend or terminate any user account without
        notice for any violation of these Terms, including but not limited to,
        attempting to cheat, defraud, or exploit the currency or rewarded ad
        system.
      </p>

      <h2>4. Links To Other Web Sites</h2>
      <p>
        Our Service will contain links to third-party web sites or services that
        are not owned or controlled by Imperial x eSports, particularly
        advertisements.
      </p>
      <p>
        We have no control over, and assume no responsibility for, the
        content, privacy policies, or practices of any third-party web sites or
        services.
      </p>

      <h2>5. Changes</h2>
      <p>
        We reserve the right, at our sole discretion, to modify or replace
        these Terms at any time. We will provide notice of any changes by
        posting the new Terms of Service on this page.
      </p>

      <h2>6. Contact Us</h2>
      <p>
        If you have any questions about these Terms, please contact us at
        <strong>priyankabairagi036@gmail.com</strong>.
      </p>
    </div>
  );
};

export default TermsOfService;
