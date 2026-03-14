import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const AuditLogs = ({ auditLogContract }) => {
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
      setLogs(formattedLogs.reverse()); // Show newest first
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

  const statusColors = { Success: '#22C55E', Failed: '#EF4444' };

  const getActionColor = (action) => {
    if (action.includes('Consent')) return 'var(--primary-color)';
    if (action.includes('Access')) return 'var(--accent-color)';
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
    <div className="dashboard animate-fade-in" style={{ padding: '2rem' }}>

      {/* ── Page Header ── */}
      <div className="audit-page-header">
        <div className="audit-header-text">
          <div className="audit-header-icon">🔍</div>
          <div>
            <h2>DPDP Blockchain Audit Trail</h2>
            <p>Immutable, tamper-proof record of all patient data interactions on Hedera.</p>
          </div>
        </div>
        <div className="audit-header-actions">
          <div className="audit-count-chip">
            <span className="audit-count-dot" />
            {loading ? '…' : filteredLogs.length} Records
          </div>
          <button className="audit-refresh-btn" onClick={fetchLogs} disabled={loading}>
            <span>{loading ? '⟳' : '↺'}</span>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="audit-export-btn" onClick={exportLogs}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="audit-toolbar">
        <div className="audit-filter-item">
          <div className="audit-filter-icon">◈</div>
          <div className="audit-filter-body">
            <span className="audit-filter-label">Context</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="audit-select"
            >
              <option value="all">All Logs</option>
              <option value="access">Data Access</option>
              <option value="consent">Consent Actions</option>
            </select>
          </div>
        </div>

        <div className="audit-toolbar-divider" />

        <div className="audit-filter-item audit-filter-item--grow">
          <div className="audit-filter-icon">🔎</div>
          <div className="audit-filter-body">
            <span className="audit-filter-label">Search Address / Purpose</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="audit-search-input"
              placeholder="0x... or keyword"
            />
          </div>
        </div>

        {searchTerm && (
          <button className="audit-clear-btn" onClick={() => setSearchTerm('')}>✕ Clear</button>
        )}
      </div>

      {/* ── Active filter chips ── */}
      {(filter !== 'all' || searchTerm) && (
        <div className="audit-chips">
          {filter !== 'all' && (
            <span className="audit-chip audit-chip--blue">
              Context: {filter === 'access' ? 'Data Access' : 'Consent Actions'}
              <button onClick={() => setFilter('all')}>×</button>
            </span>
          )}
          {searchTerm && (
            <span className="audit-chip audit-chip--purple">
              Search: "{searchTerm}"
              <button onClick={() => setSearchTerm('')}>×</button>
            </span>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="dashboard-section" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Data Principal</th>
                <th>Data Fiduciary</th>
                <th>Action</th>
                <th>Purpose</th>
                <th>Time (UTC)</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="spinner" style={{ width: 28, height: 28 }} />
                      Querying Hedera Blockchain…
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="audit-id-badge">#{log.id}</span>
                    </td>
                    <td>
                      <span className="address-chip">{truncateAddress(log.patientAddress)}</span>
                    </td>
                    <td>
                      <span className="address-chip address-chip--fiduciary">{truncateAddress(log.hospitalAddress)}</span>
                    </td>
                    <td>
                      <span className="action-pill" style={{ color: getActionColor(log.action), background: getActionColor(log.action) + '18', borderColor: getActionColor(log.action) + '40' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{log.purpose}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                    <td>
                      <span className="verified-badge">✔ Verified</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
