import React, { useState } from 'react';

const RegulatorDashboard = () => {
  const [selectedTab, setSelectedTab] = useState('overview');

  // Initialize state with mock data instead of using useEffect
  const mockAuditLogs = [
    {
      id: 1,
      patient: '0x1234...5678',
      hospital: 'City General Hospital',
      action: 'Consent Granted',
      timestamp: '2024-03-07 10:30:00',
      status: 'Compliant'
    },
    {
      id: 2,
      patient: '0x8765...4321',
      hospital: 'Medical Center',
      action: 'Data Accessed',
      timestamp: '2024-03-07 09:15:00',
      status: 'Compliant'
    },
    {
      id: 3,
      patient: '0x2468...1357',
      hospital: 'Regional Hospital',
      action: 'Consent Revoked',
      timestamp: '2024-03-07 08:45:00',
      status: 'Compliant'
    }
  ];

  const mockViolations = [
    {
      id: 1,
      hospital: 'Unauthorized Access Clinic',
      violation: 'Accessed patient data without consent',
      severity: 'High',
      date: '2024-03-06',
      status: 'Under Investigation'
    },
    {
      id: 2,
      hospital: 'Data Processing Lab',
      violation: 'Failed to erase data on request',
      severity: 'Medium',
      date: '2024-03-05',
      status: 'Resolved'
    }
  ];

  const [auditLogs] = useState(mockAuditLogs);
  const [violations] = useState(mockViolations);

  const dashboardCards = [
    { title: 'Total Consents', value: 1247, icon: '📋', color: 'var(--primary-color)' },
    { title: 'Active Consents', value: 892, icon: '✅', color: 'var(--success-color)' },
    { title: 'Audit Logs', value: auditLogs.length, icon: '🔍', color: 'var(--accent-color)' },
    { title: 'Violations', value: violations.length, icon: '⚠️', color: 'var(--danger-color)' }
  ];

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'High': return '#EF4444';
      case 'Medium': return '#F59E0B';
      case 'Low': return '#22C55E';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Compliant': return '#22C55E';
      case 'Under Investigation': return '#F59E0B';
      case 'Resolved': return '#2563EB';
      default: return '#6B7280';
    }
  };

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <h2>Regulator Dashboard</h2>
        <div className="compliance-indicator">
          <span className="blockchain-verified">✓ Blockchain Verified</span>
          <span className="dpdp-compliant">✓ DPDP Act 2023 Compliant</span>
        </div>
      </div>

      <div className="dashboard-cards">
        {dashboardCards.map((card, index) => (
          <div key={index} className="dashboard-card glass-panel" style={{ color: card.color }}>
            <div className="card-icon" style={{ backgroundColor: `rgba(255,255,255,0.05)`, color: card.color }}>
              {card.icon}
            </div>
            <div className="card-content">
              <h3>{card.title}</h3>
              <p className="card-value">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${selectedTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${selectedTab === 'consents' ? 'active' : ''}`}
          onClick={() => setSelectedTab('consents')}
        >
          All Consents
        </button>
        <button
          className={`tab-btn ${selectedTab === 'audit' ? 'active' : ''}`}
          onClick={() => setSelectedTab('audit')}
        >
          Audit Logs
        </button>
        <button
          className={`tab-btn ${selectedTab === 'violations' ? 'active' : ''}`}
          onClick={() => setSelectedTab('violations')}
        >
          Violations
        </button>
      </div>

      {selectedTab === 'overview' && (
        <div className="dashboard-section glass-panel">
          <h3>Compliance Overview</h3>
          <div className="compliance-grid">
            <div className="compliance-card">
              <h4>Consent Management</h4>
              <div className="compliance-metric">
                <span className="metric-label">Consent Rate:</span>
                <span className="metric-value">94.2%</span>
              </div>
              <div className="compliance-metric">
                <span className="metric-label">Average Duration:</span>
                <span className="metric-value">45 days</span>
              </div>
            </div>
            <div className="compliance-card">
              <h4>Data Access</h4>
              <div className="compliance-metric">
                <span className="metric-label">Authorized Access:</span>
                <span className="metric-value">1,247</span>
              </div>
              <div className="compliance-metric">
                <span className="metric-label">Unauthorized Attempts:</span>
                <span className="metric-value">3</span>
              </div>
            </div>
            <div className="compliance-card">
              <h4>Erasure Requests</h4>
              <div className="compliance-metric">
                <span className="metric-label">Requests Received:</span>
                <span className="metric-value">47</span>
              </div>
              <div className="compliance-metric">
                <span className="metric-label">Processed:</span>
                <span className="metric-value">45</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'consents' && (
        <div className="dashboard-section glass-panel">
          <h3>All Consent Records</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Consent ID</th>
                  <th>Patient</th>
                  <th>Hospital</th>
                  <th>Purpose</th>
                  <th>Granted</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>#001</td>
                  <td>0x1234...5678</td>
                  <td>City General Hospital</td>
                  <td>Medical Treatment</td>
                  <td>2024-03-01</td>
                  <td>2024-06-01</td>
                  <td><span className="status-badge active">Active</span></td>
                </tr>
                <tr>
                  <td>#002</td>
                  <td>0x8765...4321</td>
                  <td>Medical Center</td>
                  <td>Emergency Care</td>
                  <td>2024-02-15</td>
                  <td>2024-05-15</td>
                  <td><span className="status-badge active">Active</span></td>
                </tr>
                <tr>
                  <td>#003</td>
                  <td>0x2468...1357</td>
                  <td>Regional Hospital</td>
                  <td>Research Study</td>
                  <td>2024-01-10</td>
                  <td>2024-02-10</td>
                  <td><span className="status-badge revoked">Expired</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTab === 'audit' && (
        <div className="dashboard-section glass-panel">
          <h3>Audit Logs</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Hospital</th>
                  <th>Action</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>#{log.id}</td>
                    <td>{log.patient}</td>
                    <td>{log.hospital}</td>
                    <td>{log.action}</td>
                    <td>{log.timestamp}</td>
                    <td>
                      <span className="status-badge" style={{ backgroundColor: getStatusColor(log.status) + '20', color: getStatusColor(log.status) }}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTab === 'violations' && (
        <div className="dashboard-section glass-panel">
          <h3>Access Violations</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Hospital</th>
                  <th>Violation</th>
                  <th>Severity</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((violation) => (
                  <tr key={violation.id}>
                    <td>#{violation.id}</td>
                    <td>{violation.hospital}</td>
                    <td>{violation.violation}</td>
                    <td>
                      <span
                        className="severity-badge"
                        style={{ backgroundColor: getSeverityColor(violation.severity) + '20', color: getSeverityColor(violation.severity) }}
                      >
                        {violation.severity}
                      </span>
                    </td>
                    <td>{violation.date}</td>
                    <td>
                      <span className="status-badge" style={{ backgroundColor: getStatusColor(violation.status) + '20', color: getStatusColor(violation.status) }}>
                        {violation.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegulatorDashboard;
