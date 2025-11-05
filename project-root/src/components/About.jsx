// In src/pages/About.jsx

import React from 'react';
import './About.css'; // We'll create this file next

const About = () => {
  return (
    <div className="about-container">
      <div className="about-content">
        <h1>About Imperial x eSports</h1>
        
        <p className="about-intro">
          Welcome to Imperial x eSports, your new home for competitive gaming
          and rewards.
        </p>

        <h2>Our Mission</h2>
        <p>
          Our mission is to provide a seamless and rewarding platform for
          gamers. We built this app to create a community where you can
          compete, have fun, and earn real rewards for your skills.
        </p>

        <h2>What We Do</h2>
        <p>
          Our platform is built around a simple and transparent "coin" system
          where **10 coins = 1 Rupee (INR)**.
        </p>
        <ul>
          <li>
            <strong>Top-Up:</strong> Easily add coins to your account using our
            secure UPI top-up system.
          </li>
          <li>
            <strong>Compete:</strong> Join tournaments and matches to test your skills
            against other players. (You can add more about your app's core feature here)
          </li>
          <li>
            <strong>Get Rewarded:</strong> You can also earn coins by simply
            engaging with our app and watching rewarded ads.
          </li>
          <li>
            <strong>Withdraw:</strong> Cash out your earnings easily via UPI or
            Redeem Codes. We believe in getting your rewards to you quickly and
            securely.
          </li>
        </ul>

        <h2>Who We Are</h2>
        <p>
          We are a small, passionate team of developers and gamers who
          wanted to build a better experience for the gaming community in India.
          We're committed to improving this platform every day.
        </p>
      </div>
    </div>
  );
};

export default About;
