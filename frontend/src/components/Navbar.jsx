import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const Navbar = ({ account, onDisconnect, role, onConnect, onRegister, onAdmin }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <nav className={`navbar elite-navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Left: Brand */}
        <div className="navbar-left">
          <div className="navbar-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="brand-logo">🏥</div>
            <div className="brand-text">
              <h2>DocKnock</h2>
            </div>
          </div>
        </div>

        {/* Center: Functional Links (Clean & Essential) */}
        {!account && (
          <div className="navbar-center">
            <div className="nav-links">
              <div className="nav-link-item" onClick={onRegister}>
                <span className="link-text">Register Org</span>
              </div>
              <div className="nav-link-item" onClick={onAdmin}>
                <span className="link-text">Administration</span>
              </div>
            </div>
          </div>
        )}

        {/* Right: Modern Action Cluster */}
        <div className="navbar-right">
          <button className="theme-toggle-minimal" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {!account ? (
            <div className="navbar-actions">
              <button className="connect-wallet-gradient-btn" onClick={onConnect}>
                <span className="btn-glow"></span>
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="wallet-connected-group">
              <div className="role-tag">{role || 'Patient'}</div>
              <div className="wallet-connected-chip" onClick={onDisconnect}>
                <div className="status-dot"></div>
                <span className="address-short">
                  {account.slice(0, 5)}...{account.slice(-4)}
                </span>
                <span className="disconnect-hint">Logout</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
