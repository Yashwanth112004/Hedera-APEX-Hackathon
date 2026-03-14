import React from 'react';
import { toast } from 'react-toastify';
import { Sun, Moon, Hospital } from 'lucide-react';

const Navbar = ({ account, onDisconnect, role, onConnect, onRegister, onAdmin }) => {
  const handleDisconnect = () => {
    onDisconnect();
    toast.info('Wallet disconnected');
  };

  return (
    <nav className="navbar" style={{ 
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      zIndex: 1000,
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-light)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
      transition: 'all 0.3s ease'
    }}>
      <div className="navbar-container" style={{ 
        padding: '0 2rem', 
        height: '80px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        {/* Brand Section */}
        <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div style={{ 
            background: 'var(--grad-teal)', 
            padding: '12px', 
            borderRadius: '14px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(20, 184, 166, 0.2)',
          }}>
            <Hospital size={26} color="white" />
          </div>
          <div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              margin: 0, 
              color: 'var(--medical-primary)',
              fontWeight: '800', 
              letterSpacing: '-0.03em',
              lineHeight: 1
            }}>
              Hedera<span style={{ color: 'var(--medical-secondary)' }}>Consent</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <div className="status-indicator">
                <span className="dot" style={{ backgroundColor: 'var(--medical-primary)', boxShadow: '0 0 8px var(--medical-primary)' }}></span>
              </div>
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: '600',
                color: 'var(--text-muted)',
                letterSpacing: '0.02em'
              }}>
                Web3 Data Governance
              </span>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="navbar-info">
          {account ? (
            <div className="wallet-info" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>

              <div className="glass-panel" style={{ 
                padding: '8px 16px', 
                borderRadius: '12px', 
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: 0, color: 'var(--text-muted)' }}>
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </p>
                  {role && (
                    <span className="role-badge" style={{ fontSize: '0.65rem', background: 'var(--grad-teal)' }}>
                      {role}
                    </span>
                  )}
                </div>
              </div>

              <button 
                className="secondary-btn" 
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="navbar-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                className="secondary-btn" 
                onClick={onRegister}
              >
                Org Registration
              </button>
              <button 
                className="secondary-btn" 
                onClick={onAdmin}
              >
                Admin
              </button>
              <button 
                className="primary-btn" 
                onClick={onConnect}
                style={{ borderRadius: '50px' }}
              >
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
