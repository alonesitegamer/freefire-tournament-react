// src/components/PrivacyPolicy.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./PrivacyPolicy.css";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="legal-wrapper">

      {/* Header / Banner */}
      <div className="legal-header">
        <button className="legal-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-subtitle">
          Last Updated • <span>05-Nov-2025</span> <br />
          Effective Date • <span>05-Nov-2025</span>
        </p>
      </div>

      {/* Card Container */}
      <div className="legal-card">

        {/* Content */}
        <p className="legal-text">
          This Privacy Policy describes the policies of Imperial X eSports,
          GHOSPUR, West Bengal 743289, India. Email:
          priyankabairagi036@gmail.com.  
          This governs how your data is collected, stored, protected, and used
          when using our website.
        </p>

        <ol className="legal-list">

          <li>
            <h2>Information We Collect</h2>
            <p className="legal-text">We collect the following personal data:</p>
            <ol className="legal-sublist">
              <li>Name</li>
              <li>Email</li>
              <li>Payment Info</li>
            </ol>
          </li>

          <li>
            <h2>How We Collect Information</h2>
            <p className="legal-text">We collect information when:</p>
            <ol className="legal-sublist">
              <li>You submit forms</li>
              <li>You interact with the website</li>
              <li>We gather from public sources</li>
            </ol>
          </li>

          <li>
            <h2>How We Use Your Information</h2>
            <p className="legal-text">Your information is used for:</p>
            <ol className="legal-sublist">
              <li>Marketing / Promotion</li>
              <li>Account Creation</li>
              <li>Payment Processing</li>
              <li>Support</li>
              <li>Security & Site Protection</li>
            </ol>
          </li>

          <li>
            <h2>How We Share Your Information</h2>
            <p className="legal-text">
              We only share your data with third parties such as:
            </p>
            <ol className="legal-sublist">
              <li>Ads Services</li>
              <li>Analytics</li>
              <li>Payment Recovery</li>
              <li>Data Processing Partners</li>
            </ol>
          </li>

          <li>
            <h2>Data Retention</h2>
            <p className="legal-text">
              We retain data for 90 days to 2 years after inactivity or as
              required by law.
            </p>
          </li>

          <li>
            <h2>Your Rights</h2>
            <p className="legal-text">
              You may request access, modification, or deletion of your data by
              emailing:  
              <strong> priyankabairagi036@gmail.com </strong>
            </p>
          </li>

          <li>
            <h2>Cookies</h2>
            <p className="legal-text">
              Learn more in our{" "}
              <a href="https://freefire-tournament-react.vercel.app/">
                Cookie Policy
              </a>.
            </p>
          </li>

          <li>
            <h2>Security</h2>
            <p className="legal-text">
              We use industry-standard measures but cannot guarantee 100%
              security due to inherent risks of the internet.
            </p>
          </li>

          <li>
            <h2>Grievance Officer</h2>
            <p className="legal-text">
              Email your concerns to:  
              <strong> priyankabairagi036@gmail.com </strong>
            </p>
          </li>

        </ol>

        <p className="legal-footer-note">
          Privacy Policy generated with{" "}
          <a
            target="_blank"
            href="https://www.cookieyes.com/?utm_source=PP&utm_medium=footer&utm_campaign=UW"
            rel="noopener noreferrer"
          >
            CookieYes
          </a>.
        </p>

      </div>
    </div>
  );
}
