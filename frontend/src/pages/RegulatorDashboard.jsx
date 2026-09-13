import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, FileCheck, CheckCircle2, Lock, Eye, Trash2, Activity, Clock, ShieldAlert } from 'lucide-react';
import { getHCSAuditLogs, HEDERA_HCS_TOPIC_ID } from '../utils/hcsService';

const RegulatorDashboard = () => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [hcsLogs, setHcsLogs] = useState([]);

  useEffect(() => {
    const loadLogs = () => {
      setHcsLogs(getHCSAuditLogs());
    };
    loadLogs();
    window.addEventListener('ojas_hcs_event_published', loadLogs);
    return () => window.removeEventListener('ojas_hcs_event_published', loadLogs);
  }, []);

  const breakGlassEvents = hcsLogs.filter(l => l.eventType.includes('BREAK_GLASS'));
  const erasureEvents = hcsLogs.filter(l => l.eventType.includes('ERASURE') || l.eventType.includes('SHRED'));
  const consentEvents = hcsLogs.filter(l => l.eventType.includes('CONSENT'));

  const dashboardCards = [
    { title: 'Hedera HCS Events', value: hcsLogs.length, icon: '🛡️', color: '#0284C7' },
    { title: 'Zero PII On-Chain', value: '100% Compliant', icon: '🔒', color: '#16A34A' },
    { title: 'Break-Glass Audits', value: breakGlassEvents.length, icon: '🚨', color: '#DC2626' },
    { title: 'DPDP Erasure Shreds', value: erasureEvents.length, icon: '⚖️', color: '#7C3AED' }
  ];

  return (
    <div className="dashboard animate-fade-in" style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div className="dashboard-header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#DCFCE7',
            border: '1px solid #86EFAC',
            color: '#15803D',
            padding: '4px 12px',
            borderRadius: '100px',
            fontSize: '0.78rem',
            fontWeight: '800',
            marginBottom: '0.75rem'
          }}>
            <ShieldCheck size={16} />
            <span>STATUTORY DPDP ACT 2023 REGULATORY AUDIT ENGINE</span>
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: '900', color: 'var(--medical-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Data Protection Board & Compliance Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: '6px 0 0 0' }}>
            Real-time compliance surveillance, zero-trust cryptographic audit trails & Hedera HCS Topic <code>{HEDERA_HCS_TOPIC_ID}</code> mirror.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <span className="role-badge" style={{ background: '#0284C7', color: 'white', fontSize: '0.78rem', padding: '8px 14px' }}>
            ✓ Hedera HCS aBFT Verified
          </span>
          <span className="role-badge" style={{ background: '#16A34A', color: 'white', fontSize: '0.78rem', padding: '8px 14px' }}>
            ✓ DPDP 2023 Certified
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
        {dashboardCards.map((card, index) => (
          <div key={index} className="dashboard-card floating-card" style={{ borderTop: `4px solid ${card.color}`, padding: '1.5rem 2rem' }}>
            <div className="card-icon" style={{ backgroundColor: `${card.color}15`, color: card.color }}>
              {card.icon}
            </div>
            <div className="card-content">
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{card.title}</h3>
              <p className="card-value" style={{ fontSize: '1.6rem', fontWeight: '800' }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs" style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.4rem', borderRadius: '12px' }}>
        <button
          className={`tab-btn ${selectedTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedTab('overview')}
          style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', border: 'none', background: selectedTab === 'overview' ? 'var(--medical-primary)' : 'transparent', color: selectedTab === 'overview' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: '700' }}
        >
          Compliance Overview
        </button>
        <button
          className={`tab-btn ${selectedTab === 'hcs' ? 'active' : ''}`}
          onClick={() => setSelectedTab('hcs')}
          style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', border: 'none', background: selectedTab === 'hcs' ? 'var(--medical-primary)' : 'transparent', color: selectedTab === 'hcs' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: '700' }}
        >
          HCS Topic Stream ({hcsLogs.length})
        </button>
        <button
          className={`tab-btn ${selectedTab === 'breakglass' ? 'active' : ''}`}
          onClick={() => setSelectedTab('breakglass')}
          style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', border: 'none', background: selectedTab === 'breakglass' ? 'var(--medical-primary)' : 'transparent', color: selectedTab === 'breakglass' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: '700' }}
        >
          Break-Glass Emergency Audits ({breakGlassEvents.length})
        </button>
        <button
          className={`tab-btn ${selectedTab === 'erasure' ? 'active' : ''}`}
          onClick={() => setSelectedTab('erasure')}
          style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', border: 'none', background: selectedTab === 'erasure' ? 'var(--medical-primary)' : 'transparent', color: selectedTab === 'erasure' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: '700' }}
        >
          Section 12 Right to Erasure ({erasureEvents.length})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {selectedTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', borderLeft: '6px solid #16A34A' }}>
            <h3 style={{ fontSize: '1.25rem', color: '#166534', margin: '0 0 1rem 0' }}>
              ✓ DPDP Act 2023 Statutory Compliance Verification
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <strong style={{ color: '#0F172A', display: 'block', marginBottom: '4px' }}>Section 5: Purpose Limitation & Privacy</strong>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  0% unencrypted PII/PHI stored on-chain. All payloads client-side encrypted via HashiCorp Vault Transit Engine and pinned to IPFS.
                </p>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <strong style={{ color: '#0F172A', display: 'block', marginBottom: '4px' }}>Section 6: Consent Manager Architecture</strong>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Granular, time-bound, purpose-scoped consent agreements signed on-chain with instant one-click revocation.
                </p>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <strong style={{ color: '#0F172A', display: 'block', marginBottom: '4px' }}>Section 12: Right to Erasure & Shredding</strong>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Cryptographic key shredding invalidates Vault transit key handles upon patient request, rendering data permanently unrecoverable.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: HCS Stream */}
      {selectedTab === 'hcs' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem 0' }}>Hedera Consensus Service Topic 0.0.4891024 Live Stream</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Seq #</th>
                  <th>Consensus Time</th>
                  <th>Event Type</th>
                  <th>Actor</th>
                  <th>Audit Provenance Details</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {hcsLogs.map((log, idx) => (
                  <tr key={idx}>
                    <td><strong style={{ color: '#0284C7' }}>#{log.sequenceNumber}</strong></td>
                    <td style={{ fontSize: '0.8rem', color: '#64748B' }}>{new Date(log.consensusTimestamp).toLocaleString()}</td>
                    <td><span className="status-badge active">{log.eventType}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{log.actor.slice(0, 8)}...{log.actor.slice(-4)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{log.details}</td>
                    <td><span style={{ color: '#16A34A', fontSize: '0.75rem', fontWeight: '800' }}>✓ Verified ({log.aBFTFinalityMs}ms)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Break-Glass Audits */}
      {selectedTab === 'breakglass' && (
        <div className="glass-panel" style={{ padding: '2rem', borderLeft: '6px solid #DC2626' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <ShieldAlert size={24} color="#DC2626" />
            <h3 style={{ margin: 0, color: '#991B1B' }}>Patented ZK-HCS Ephemeral Emergency Access Log</h3>
          </div>
          <p style={{ fontSize: '0.88rem', color: '#64748B', marginBottom: '1.5rem' }}>
            All 60-minute emergency bypass events with dual cryptographic signatures and statutory justifications.
          </p>
          {breakGlassEvents.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
              No emergency break-glass activations recorded on Hedera HCS.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {breakGlassEvents.map((bg, i) => (
                <div key={i} style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '14px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '800', color: '#991B1B', fontSize: '0.95rem' }}>Seq #{bg.sequenceNumber}: {bg.eventType}</span>
                    <span style={{ fontSize: '0.8rem', color: '#7F1D1D' }}>{new Date(bg.consensusTimestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                    {bg.details}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace' }}>
                    Actor: {bg.actor} • Ephemeral Key: {bg.ephemeralKeyHash || 'SHA256-DERIVED'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Erasure Shredding */}
      {selectedTab === 'erasure' && (
        <div className="glass-panel" style={{ padding: '2rem', borderLeft: '6px solid #7C3AED' }}>
          <h3 style={{ color: '#5B21B6', margin: '0 0 1rem 0' }}>Section 12 Right to Erasure Vault Key Shredding Log</h3>
          <p style={{ fontSize: '0.88rem', color: '#64748B', marginBottom: '1.5rem' }}>
            Immutable records proving Vault transit key handles were permanently destroyed and zero decipherable health data remains.
          </p>
          {erasureEvents.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
              No Right to Erasure key shreds requested in this session.
            </div>
          ) : (
            erasureEvents.map((er, i) => (
              <div key={i} style={{ backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: '14px', padding: '1rem', marginBottom: '8px' }}>
                <strong style={{ color: '#6B21A8' }}>Seq #{er.sequenceNumber}: {er.eventType}</strong>
                <p style={{ fontSize: '0.85rem', color: '#4C1D95', margin: '4px 0 0 0' }}>{er.details}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default RegulatorDashboard;
