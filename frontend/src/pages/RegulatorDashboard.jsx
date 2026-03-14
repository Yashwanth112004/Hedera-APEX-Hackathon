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
    { title: 'Total Consents', value: 1247, icon: '📋', color: 'var(--medical-primary)' },
    { title: 'Active Consents', value: 892, icon: '✅', color: 'var(--status-approved)' },
    { title: 'Audit Logs', value: auditLogs.length, icon: '🔍', color: 'var(--medical-aqua)' },
    { title: 'Violations', value: violations.length, icon: '⚠️', color: 'var(--status-rejected)' }
  ];

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'High': return 'var(--status-rejected)';
      case 'Medium': return 'var(--status-pending)';
      case 'Low': return 'var(--status-approved)';
      default: return 'var(--text-secondary)';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Compliant': return 'var(--status-approved)';
      case 'Under Investigation': return 'var(--status-pending)';
      case 'Resolved': return 'var(--status-info)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--medical-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Compliance Regulator Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Real-time compliance monitoring and blockchain-anchored audit trails.</p>
        </div>
        <div className="compliance-indicator" style={{ display: 'flex', gap: '1rem' }}>
          <span className="role-badge" style={{ background: 'var(--grad-teal)', fontSize: '0.75rem' }}>✓ Blockchain Verified</span>
          <span className="role-badge" style={{ background: 'var(--grad-blue)', fontSize: '0.75rem' }}>✓ DPDP Act 2023 Compliant</span>
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

      <div className="dashboard-tabs" style={{ marginBottom: '2rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '12px', display: 'inline-flex', gap: '0.5rem' }}>
        <button
          className={`tab-btn ${selectedTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedTab('overview')}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: selectedTab === 'overview' ? 'var(--grad-teal)' : 'transparent', color: selectedTab === 'overview' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.3s ease' }}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${selectedTab === 'consents' ? 'active' : ''}`}
          onClick={() => setSelectedTab('consents')}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: selectedTab === 'consents' ? 'var(--grad-teal)' : 'transparent', color: selectedTab === 'consents' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.3s ease' }}
        >
          All Consents
        </button>
        <button
          className={`tab-btn ${selectedTab === 'audit' ? 'active' : ''}`}
          onClick={() => setSelectedTab('audit')}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: selectedTab === 'audit' ? 'var(--grad-teal)' : 'transparent', color: selectedTab === 'audit' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.3s ease' }}
        >
          Audit Logs
        </button>
        <button
          className={`tab-btn ${selectedTab === 'violations' ? 'active' : ''}`}
          onClick={() => setSelectedTab('violations')}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: selectedTab === 'violations' ? 'var(--grad-teal)' : 'transparent', color: selectedTab === 'violations' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.3s ease' }}
        >
          Violations
        </button>
      </div>

      {selectedTab === 'overview' && (
        <div className="dashboard-section glass-panel">
          <h3 style={{ marginBottom: '1.5rem' }}>Compliance Overview</h3>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="floating-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ color: 'var(--medical-primary)', marginBottom: '1rem' }}>Consent Management</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Consent Rate:</span>
                <span style={{ color: 'var(--status-approved)', fontWeight: 'bold' }}>94.2%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Average Duration:</span>
                <span style={{ fontWeight: '500' }}>45 days</span>
              </div>
            </div>
            <div className="floating-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ color: 'var(--medical-primary)', marginBottom: '1rem' }}>Data Access</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Authorized Access:</span>
                <span style={{ fontWeight: 'bold' }}>1,247</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Unauthorized Attempts:</span>
                <span style={{ color: 'var(--status-rejected)' }}>3</span>
              </div>
            </div>
            <div className="floating-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ color: 'var(--medical-primary)', marginBottom: '1rem' }}>Erasure Requests</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Requests Received:</span>
                <span style={{ fontWeight: 'bold' }}>47</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Processed:</span>
                <span style={{ color: 'var(--status-approved)' }}>45</span>
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
