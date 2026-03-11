import React from 'react';
import { toast } from 'react-toastify';

const Navbar = ({ account, onDisconnect, role, onConnect, onRegister, onAdmin }) => {
  const handleDisconnect = () => {
    onDisconnect();
    toast.info('Wallet disconnected');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <h2>🏥 DPDP Health Consent</h2>
          <span className="compliance-badge">DPDP Act 2023 Compliant</span>
        </div>

        <div className="navbar-info">
          {account ? (
            <div className="wallet-info">
              <span className="account-address">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              {role && (
                <span className="role-badge">
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
              )}
              <button className="disconnect-btn" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="navbar-actions" style={{ display: 'flex', gap: '1rem' }}>
              <button className="secondary-btn" onClick={onRegister} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Org Registration</button>
              <button className="secondary-btn" onClick={onAdmin} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Admin</button>
              <button className="primary-btn" onClick={onConnect} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Connect Wallet</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
