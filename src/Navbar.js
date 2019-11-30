import React from 'react';
import './App.css';
import { Link } from 'react-router-dom'

const Navbar = props => {
  return (
    <header>
      <img src="logo.svg" className="icon" alt="logo" />
      <Link to="/avatars">
        <nav className="selected" style={{"cursor": "pointer"}}>
          <span>Avatars</span>
        </nav>
      </Link>
      <a href="https://docs.exokit.org/"><nav><span className="header-link">Documentation</span></nav></a>
      <Link to="/browser">
        <nav>
          <span className="header-link">Browser</span>
        </nav>
      </Link>
      <a href="https://discord.gg/UgZDFZW"><nav><span className="coming-soon">Exoland
          <p className="coming-soon-sub">Coming soon!</p>
      </span></nav></a>

      <form className="login-form phase-1" id="login-form">
        <div className="phase-content">
          <div className="login-notice" id="login-notice"></div>
          <div className="login-error" id="login-error"></div>
        </div>
        <div className="phase-content phase-1-content">
          <input type="email" placeholder="your@email.com" id="login-email" />
          <input type="submit" value="Log in" className="button highlight" />
        </div>
        <div className="phase-content phase-2-content">
          <input type="text" placeholder="Verification code" id="login-verification-code" />
          <input type="submit" value="Verify" className="button highlight" />
        </div>
        <div className="phase-content phase-3-content">
          <button className="user-button id=user-button">
            <img src="exobot.png" alt="Exobot" />
            <span className="name" id="login-email-static">a@modules.io</span>
          </button>
          <input type="button" value="Load avatar" className="button highlight" id="load-avater" />
          <input type="button" value="Save avatar" className="button highlight" id="save-avater" />
          <input type="submit" value="Log out" className="button highlight" />
        </div>
        <div className="phase-content phaseless-content">
          <div>Working...</div>
        </div>
      </form>
    </header>
  );
}
export default Navbar;