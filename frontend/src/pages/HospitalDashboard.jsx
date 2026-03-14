import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Scanner } from '@yudiel/react-qr-scanner';

const HospitalDashboard = ({
  onRegisterHospital,
  onAccessPatientData
}) => {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedAddress, setScannedAddress] = useState('');
  const [registerData, setRegisterData] = useState({
    hospitalName: '',
    license: ''
  });

  const handleRegisterHospital = async (e) => {
    e.preventDefault();
    if (!registerData.hospitalName || !registerData.license) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      await onRegisterHospital(registerData.hospitalName, registerData.license);
      setShowRegisterForm(false);
      setRegisterData({ hospitalName: '', license: '' });
      toast.success('Hospital registered successfully');
    } catch {
      toast.error('Failed to register hospital');
    }
  };

  const handleScan = (result) => {
    if (result && result.length > 0) {
      setScannedAddress(result[0].rawValue);
      setShowScanner(false);
      toast.success('QR code scanned successfully');
    }
  };

  const handleAccessData = async () => {
    if (!scannedAddress) {
      toast.error('Please scan a patient QR code first');
      return;
    }

    try {
      await onAccessPatientData(scannedAddress);
      toast.success('Patient data accessed successfully');
    } catch {
      toast.error('Failed to access patient data');
    }
  };

  const dashboardCards = [
    { title: 'Patient Requests', value: 0, icon: '👥', color: 'var(--medical-secondary)' },
    { title: 'Uploaded Records', value: 0, icon: '📤', color: 'var(--status-approved)' },
    { title: 'Approved Consents', value: 0, icon: '✅', color: 'var(--medical-primary)' },
    { title: 'Access Logs', value: 0, icon: '🔍', color: 'var(--medical-aqua)' }
  ];

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--medical-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Hospital Enterprise Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Secure institutional data governance and patient event verification.</p>
        </div>
        <div className="dashboard-actions">
          <button
            className="primary-btn"
            onClick={() => setShowRegisterForm(true)}
          >
            Register Hospital
          </button>
          <button
            className="secondary-btn"
            onClick={() => setShowScanner(true)}
          >
            Scan Patient QR
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        {dashboardCards.map((card, index) => (
          <div key={index} className="dashboard-card floating-card" style={{ borderTop: `4px solid ${card.color}` }}>
            <div className="card-icon" style={{ backgroundColor: `${card.color}10`, color: card.color }}>
              {card.icon}
            </div>
            <div className="card-content">
              <h3>{card.title}</h3>
              <p className="card-value">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-section glass-panel">
        <h3>Patient Data Access</h3>
        {scannedAddress ? (
          <div className="floating-card" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Scanned Patient Address</p>
              <code style={{ fontSize: '1.1rem', color: 'var(--medical-primary)' }}>{scannedAddress}</code>
            </div>
            <button
              className="primary-btn"
              onClick={handleAccessData}
            >
              Access Patient Data
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', cursor: 'pointer' }} onClick={() => setShowScanner(true)}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Scan a patient QR code to access their data</p>
            <button className="secondary-btn">Open Scanner</button>
          </div>
        )}
      </div>

      <div className="dashboard-section glass-panel">
        <h3>Recent Access Logs</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Access Type</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No recent access logs found on-chain.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {showRegisterForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Register Hospital</h3>
              <button className="close-btn" onClick={() => setShowRegisterForm(false)}>×</button>
            </div>
            <form onSubmit={handleRegisterHospital} className="modal-body">
              <div className="form-group">
                <label>Hospital Name *</label>
                <input
                  type="text"
                  value={registerData.hospitalName}
                  onChange={(e) => setRegisterData({ ...registerData, hospitalName: e.target.value })}
                  placeholder="Enter hospital name"
                  required
                />
              </div>
              <div className="form-group">
                <label>License ID *</label>
                <input
                  type="text"
                  value={registerData.license}
                  onChange={(e) => setRegisterData({ ...registerData, license: e.target.value })}
                  placeholder="Enter license number"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Register</button>
                <button type="button" className="secondary-btn" onClick={() => setShowRegisterForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScanner && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Scan Patient QR Code</h3>
              <button className="close-btn" onClick={() => setShowScanner(false)}>×</button>
            </div>
            <div className="modal-body scanner-modal">
              <div className="scanner-container">
                <Scanner
                  constraints={{ facingMode: "environment" }}
                  formats={["qr_code"]}
                  onScan={handleScan}
                />
                <p>Position the QR code within the frame</p>
              </div>
              <div className="modal-actions">
                <button className="secondary-btn" onClick={() => setShowScanner(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalDashboard;
