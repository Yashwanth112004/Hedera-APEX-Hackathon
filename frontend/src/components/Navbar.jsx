import React from 'react';
import { toast } from 'react-toastify';
import { Sun, Moon, Hospital } from 'lucide-react';

const Navbar = ({ account, onDisconnect, role, onConnect, onRegister, onAdmin, onSwitchRole }) => {
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
      background: 'linear-gradient(90deg, #E6EEE8 0%, #E6EEE8 15%, rgba(49, 80, 70, 0.95) 35%, rgba(49, 80, 70, 0.95) 100%)', 
      backdropFilter: 'blur(12px)',
      borderBottom: '2px solid rgba(168, 194, 86, 0.4)', // Stronger organic green border to separate from page bg
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
      transition: 'all 0.3s ease'
    }}>
      <div className="navbar-container" style={{ 
        padding: '0 2rem', 
        height: '92px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        {/* Brand Section */}
        <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src="/logo.jpg" 
            alt="Ojasraksha Logo" 
            style={{ 
              height: '76px', 
              objectFit: 'contain',
              filter: 'contrast(1.02) brightness(1.02)',
              marginRight: '1rem'
            }} 
          />
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
                  <p style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '800', 
                    margin: 0, 
                    color: '#FFFFFF',
                    textShadow: '0 1px 4px rgba(0,0,0,0.2)'
                  }}>
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </p>
                  {role && (
                      <span className="role-badge" style={{ 
                        fontSize: '0.7rem', 
                        padding: '4px 10px',
                        background: 'var(--medical-highlight)', 
                        color: 'var(--medical-primary)', 
                        fontWeight: '800',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }} onClick={onSwitchRole} title="Click to switch role">
                        {role.toUpperCase()} 🔄
                      </span>
                  )}
                </div>
              </div>

              {role && (
                <button 
                  className="secondary-btn" 
                  onClick={onSwitchRole}
                  style={{ 
                    padding: '8px 12px', 
                    fontSize: '0.8rem', 
                    color: '#F0F4F2', 
                    borderColor: 'rgba(240, 244, 242, 0.4)', 
                    background: 'transparent' 
                  }}
                >
                  Switch Role
                </button>
              )}

              <button 
                className="secondary-btn" 
                onClick={handleDisconnect}
                style={{ borderColor: '#FFB2B2', color: '#FFB2B2', background: 'transparent' }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="navbar-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                className="secondary-btn" 
                onClick={onAdmin}
                style={{ 
                  color: '#F0F4F2', 
                  borderColor: 'rgba(240, 244, 242, 0.4)', 
                  background: 'transparent',
                  backdropFilter: 'blur(4px)'
                }}
              >
                Admin
              </button>
              <button 
                className="primary-btn" 
                onClick={onConnect}
                style={{ 
                  borderRadius: '50px', 
                  background: 'var(--medical-highlight)', 
                  color: 'var(--medical-primary)',
                  boxShadow: '0 8px 20px rgba(168, 194, 86, 0.3)',
                  border: 'none'
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
