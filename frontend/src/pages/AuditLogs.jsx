import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const AuditLogs = ({ auditLogContract, fiduciaryFilter }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    if (!auditLogContract) return;
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const readContract = auditLogContract.connect(provider);
      const blockchainLogs = await readContract.getLogs();
      const formattedLogs = blockchainLogs.map((log, index) => ({
        id: index + 1,
        patientAddress: log.dataPrincipal,
        hospitalAddress: log.dataFiduciary,
        action: log.action,
        purpose: log.purpose,
        timestamp: new Date(Number(log.timestamp) * 1000).toISOString(),
        txHash: 'On-Chain Record',
        status: 'Success'
      }));
      const finalLogs = fiduciaryFilter 
        ? formattedLogs.filter(l => l.hospitalAddress.toLowerCase() === fiduciaryFilter.toLowerCase())
        : formattedLogs;
        
      setLogs(finalLogs.reverse()); // Show newest first
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [auditLogContract]);

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' ||
      (filter === 'success' && log.status === 'Success') ||
      (filter === 'failed' && log.status === 'Failed') ||
      (filter === 'consent' && log.action.includes('Consent')) ||
      (filter === 'access' && log.action.includes('Access'));

    const matchesSearch = searchTerm === '' ||
      log.patientAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.hospitalAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.purpose.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const statusColors = { Success: 'var(--status-approved)', Failed: 'var(--status-rejected)' };

  const getActionColor = (action) => {
    if (action.includes('Consent')) return 'var(--medical-primary)';
    if (action.includes('Access')) return 'var(--medical-aqua)';
    return 'var(--text-secondary)';
  };

  const exportLogs = () => {
    const csvContent = [
      ['ID', 'Patient Address', 'Data Fiduciary', 'Action', 'Purpose', 'Timestamp', 'Status'],
      ...filteredLogs.map(log => [log.id, log.patientAddress, log.hospitalAddress, log.action, log.purpose, log.timestamp, log.status])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h2>Compliance Audit Trail</h2>
          <p style={{ color: 'var(--text-muted)' }}>Immutable ledger records of all patient data interactions and consent lifecycle events.</p>
        </div>
        <div className="dashboard-actions">
          <button className="secondary-btn" onClick={fetchLogs} disabled={loading}>
            {loading ? "..." : "Sync Audit Logs"}
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, width: '200px' }}>
            <label>Context Filter</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="glass-input">
              <option value="all">All Logs</option>
              <option value="access">Data Access</option>
              <option value="consent">Consent Actions</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label>Search Identity or Purpose</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input"
              placeholder="Enter wallet address (0x...) or purpose"
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Log ID</th>
                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Data Principal</th>
                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Data Fiduciary</th>
                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Action</th>
                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Purpose</th>
                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Time (UTC)</th>
                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Ledger</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Querying Blockchain Infrastructure...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>No compliant audit records found.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td><span style={{ fontWeight: '600', color: 'var(--text-main)' }}>#{log.id}</span></td>
                    <td><code style={{ fontSize: '0.85rem', background: '#F1F5F9', color: '#0F172A', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #CBD5E1' }}>{truncateAddress(log.patientAddress)}</code></td>
                    <td><code style={{ fontSize: '0.85rem', background: '#F1F5F9', color: '#0F172A', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #CBD5E1' }}>{truncateAddress(log.hospitalAddress)}</code></td>
                    <td>
                      <span className="role-badge" style={{ background: getActionColor(log.action).includes('var') ? getActionColor(log.action) : 'var(--medical-primary)', fontSize: '0.75rem' }}>
                        {log.action}
                      </span>
                    </td>
                    <td><span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '500' }}>{log.purpose}</span></td>
                    <td><span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>{formatDate(log.timestamp)}</span></td>
                    <td style={{ color: 'var(--medical-primary)', fontWeight: 'bold', fontSize: '0.8rem' }}>✓ Hedera</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <button className="primary-btn" onClick={exportLogs}>Export Compliance Report (CSV)</button>
      </div>
    </div>
  );
};

export default AuditLogs;
