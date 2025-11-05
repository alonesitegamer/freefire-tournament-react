// In src/pages/Contact.jsx

import React from 'react';
import './Contact.css'; // We'll create this file next

const Contact = () => {
  return (
    <div className="contact-container">
      <div className="contact-card">
        <h1>Contact Us</h1>
        <p className="contact-intro">
          Have a question or a problem with a top-up or withdrawal? We're here
          to help!
        </p>

        <h2>Support Email (Best Way)</h2>
        <p>
          For the fastest response, please email us directly. If you have a
          payment issue, **please include your Transaction ID** and your
          registered email address.
        </p>
        
        {/* Make sure this is the email you check! */}
        <a 
          href="mailto:priyankabairagi036@gmail.com" 
          className="contact-email-link"
        >
          priyankabairagi036@gmail.com
        </a>

        <h2>Response Time</h2>
        <p>
          We are a small team and will do our best to respond to all inquiries
          within **24-48 hours**.
        </p>
      </div>
    </div>
  );
};

export default Contact;
