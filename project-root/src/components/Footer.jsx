import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css'; // We'll create this file next for basic styling

const Footer = () => {
  return (
    <footer className="footer-container">
      <div className="footer-links">
        {/* Your new link is here */}
        <Link to="/privacy-policy" className="footer-link">Privacy Policy</Link>
        
        {/* I've added placeholders for the pages you will create next */}
        <Link to="/terms-of-service" className="footer-link">Terms of Service</Link>
        <Link to="/about" className="footer-link">About</Link>
        <Link to="/contact" className="footer-link">Contact</Link>
      </div>
      <div className="footer-copyright">
        © 2025 Imperial x eSports. All Rights Reserved.
      </div>
    </footer>
  );
};

export default Footer;
