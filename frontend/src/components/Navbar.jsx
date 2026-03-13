import React from 'react';
import { toast } from 'react-toastify';
import { Sun, Moon, Hospital } from 'lucide-react';

const Navbar = ({ account, onDisconnect, role, onConnect, onRegister, onAdmin, theme, onToggleTheme }) => {
  const handleDisconnect = () => {
    onDisconnect();
    toast.info('Wallet disconnected');
  };

  return (
    <nav className="navbar" style={{ 
      position: 'sticky',
      top: '1rem',
      margin: '0 2rem',
      zIndex: 1000,
      background: 'var(--glass-bg)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--glass-shadow)',
      borderRadius: '20px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
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
            background: 'var(--grad-medical)', 
            padding: '10px', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(15, 76, 129, 0.2)',
            transform: 'rotate(-2deg)'
          }}>
            <Hospital size={28} color="white" />
          </div>
          <div>
            <h2 style={{ 
              fontSize: '1.4rem', 
              margin: 0, 
              color: 'var(--medical-primary)', /* Solid deep blue for readability */
              fontWeight: '800', 
              letterSpacing: '-0.04em',
              lineHeight: 1
            }}>
              HEDERA<span style={{ color: 'var(--medical-secondary)' }}>CONSENT</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{ 
                width: '6px', 
                height: '6px', 
                background: 'var(--status-approved)', 
                borderRadius: '50%',
                boxShadow: '0 0 8px var(--status-approved)' 
              }}></span>
              <span className="compliance-badge" style={{ 
                fontSize: '0.7rem', 
                textTransform: 'uppercase', 
                fontWeight: '800',
                letterSpacing: '0.08em', 
                color: 'var(--text-secondary)'
              }}>
                DPDP Act 2023 Compliant
              </span>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="navbar-info">
          {account ? (
            <div className="wallet-info" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
              <button 
                onClick={onToggleTheme}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
                className="theme-toggle-btn"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={22} color="#0F4C81" /> : <Sun size={22} color="#22D3EE" />}
              </button>

              <div style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                padding: '6px 16px', 
                borderRadius: '12px', 
                border: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </p>
                  {role && (
                    <p style={{ fontSize: '0.65rem', margin: 0, fontWeight: '900', textTransform: 'uppercase', color: 'var(--medical-secondary)', letterSpacing: '0.05em' }}>
                      {role}
                    </p>
                  )}
                </div>
              </div>

              <button 
                className="disconnect-btn" 
                onClick={handleDisconnect}
                style={{
                  background: 'var(--status-rejected)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                  cursor: 'pointer'
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="navbar-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                onClick={onToggleTheme}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                {theme === 'light' ? <Moon size={22} color="#0F4C81" /> : <Sun size={22} color="#22D3EE" />}
              </button>
              <button 
                className="secondary-btn" 
                onClick={onRegister} 
                style={{ 
                  padding: '0.7rem 1.4rem', 
                  fontSize: '0.9rem', 
                  borderRadius: '12px', 
                  fontWeight: '800',
                  background: 'var(--btn-secondary-bg)',
                  border: '1px solid var(--btn-secondary-border)',
                  color: 'var(--btn-secondary-text)' 
                }}
              >
                Org Registration
              </button>
              <button 
                className="secondary-btn" 
                onClick={onAdmin} 
                style={{ 
                  padding: '0.7rem 1.4rem', 
                  fontSize: '0.9rem', 
                  borderRadius: '12px', 
                  fontWeight: '800',
                  background: 'var(--btn-secondary-bg)',
                  border: '1px solid var(--btn-secondary-border)',
                  color: 'var(--btn-secondary-text)' 
                }}
              >
                Admin
              </button>
              <button 
                className="primary-btn" 
                onClick={onConnect} 
                style={{ 
                  padding: '0.7rem 1.4rem', 
                  fontSize: '0.9rem', 
                  borderRadius: '12px', 
                  background: 'var(--grad-medical)', 
                  color: 'white', 
                  border: 'none', 
                  fontWeight: '800',
                  boxShadow: '0 8px 20px rgba(15, 76, 129, 0.25)' 
                }}
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
