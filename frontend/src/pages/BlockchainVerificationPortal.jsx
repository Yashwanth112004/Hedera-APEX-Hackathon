import React, { useState } from 'react';
import { ShieldCheck, Search, CheckCircle2, AlertTriangle, FileText, Cpu, Clock, Hash, Lock, Database } from 'lucide-react';
import { verifyRecordAgainstHCS, HEDERA_HCS_TOPIC_ID, getHCSAuditLogs } from '../utils/hcsService';
import CryptoJS from 'crypto-js';

const BlockchainVerificationPortal = () => {
  const [query, setQuery] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [fileHash, setFileHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = (searchTarget) => {
    const target = searchTarget || query;
    if (!target.trim()) return;

    setIsVerifying(true);
    setTimeout(() => {
      const result = verifyRecordAgainstHCS(target.trim());
      setVerificationResult(result);
      setIsVerifying(false);
    }, 600);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const binary = event.target.result;
      const wordArray = CryptoJS.lib.WordArray.create(binary);
      const sha256 = CryptoJS.SHA256(wordArray).toString();
      setFileHash(sha256);
      setQuery(sha256);
      handleVerify(sha256);
    };
    reader.readAsArrayBuffer(file);
  };

  const recentHcsLogs = getHCSAuditLogs().slice(0, 5);

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '2rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: '28px',
        padding: '3rem 2.5rem',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.3)'
      }}>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '680px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            padding: '6px 14px',
            borderRadius: '100px',
            fontSize: '0.78rem',
            fontWeight: '700',
            color: '#38BDF8',
            marginBottom: '1.25rem'
          }}>
            <ShieldCheck size={16} />
            <span>HEDERA CONSENSUS SERVICE • TOPIC 0.0.4891024</span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 1rem 0', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Cryptographic Integrity & Blockchain Verification Portal
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
            Verify tamper-proof authenticity for any diagnostic lab report, prescription, or clinical record. Cryptographically matches off-chain SHA-256 hashes against immutable Hedera Hashgraph timestamps.
          </p>
        </div>
      </div>

      {/* Verification Input Box */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        padding: '2rem',
        border: '1.5px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
          Verify Record Hash or IPFS Content ID (CID)
        </h3>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1,
            minWidth: '280px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#F8FAFC',
            border: '1.5px solid #CBD5E1',
            borderRadius: '14px',
            padding: '12px 16px'
          }}>
            <Search size={20} color="#64748B" />
            <input
              type="text"
              placeholder="Paste IPFS CID (e.g. QmXoypiz...) or SHA-256 Record Hash..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                width: '100%',
                fontSize: '0.95rem',
                color: '#0F172A'
              }}
            />
          </div>
          <button
            onClick={() => handleVerify()}
            disabled={isVerifying}
            style={{
              padding: '12px 28px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              color: '#FFFFFF',
              fontWeight: '800',
              fontSize: '0.95rem',
              border: 'none',
              cursor: isVerifying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
            }}
          >
            {isVerifying ? 'Verifying on Hedera HCS...' : 'Verify Cryptographic Integrity'}
          </button>
        </div>

        {/* Drag & Drop / File Hash Alternative */}
        <div style={{
          border: '2px dashed #CBD5E1',
          borderRadius: '16px',
          padding: '1.5rem',
          textAlign: 'center',
          backgroundColor: '#F8FAFC'
        }}>
          <FileText size={32} color="#64748B" style={{ margin: '0 auto 8px auto' }} />
          <p style={{ margin: '0 0 6px 0', fontWeight: '700', color: '#334155', fontSize: '0.92rem' }}>
            Or upload original medical report PDF/JSON to calculate client-side hash
          </p>
          <input
            type="file"
            onChange={handleFileUpload}
            style={{ fontSize: '0.82rem', color: '#64748B' }}
          />
          {fileHash && (
            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#0284C7', fontFamily: 'monospace' }}>
              Calculated SHA-256: {fileHash}
            </div>
          )}
        </div>
      </div>

      {/* Verification Result Display */}
      {verificationResult && (
        <div style={{
          backgroundColor: verificationResult.verified ? '#F0FDF4' : '#FEF2F2',
          border: `1.5px solid ${verificationResult.verified ? '#86EFAC' : '#FCA5A5'}`,
          borderRadius: '24px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.05)',
          animation: 'fadeIn 0.4s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                backgroundColor: verificationResult.verified ? '#16A34A' : '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF'
              }}>
                <CheckCircle2 size={30} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: '900', color: verificationResult.verified ? '#14532D' : '#7F1D1D', margin: 0 }}>
                    {verificationResult.verified ? '100% Cryptographic Integrity Verified' : 'Integrity Verification Failed'}
                  </h3>
                  <span style={{
                    backgroundColor: '#16A34A',
                    color: 'white',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    padding: '3px 10px',
                    borderRadius: '100px'
                  }}>
                    SCORE: {verificationResult.score}%
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: verificationResult.verified ? '#166534' : '#991B1B', margin: '4px 0 0 0' }}>
                  Proof verified on Hedera Consensus Service Topic <code>{verificationResult.hcsTopic}</code>
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '12px',
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: '700',
              color: '#334155'
            }}>
              Hedera aBFT Finality: &lt; 2.1s
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            backgroundColor: '#FFFFFF',
            padding: '1.25rem',
            borderRadius: '16px',
            border: '1px solid #E2E8F0'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>HCS TOPIC ID</span>
              <strong style={{ fontSize: '0.95rem', color: '#0F172A', fontFamily: 'monospace' }}>{verificationResult.hcsTopic || HEDERA_HCS_TOPIC_ID}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>CONSENSUS TIMESTAMP</span>
              <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>
                {verificationResult.consensusTimestamp ? new Date(verificationResult.consensusTimestamp).toLocaleString() : 'N/A'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>SEQUENCE NUMBER</span>
              <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>
                {verificationResult.sequenceNumber ? `#${verificationResult.sequenceNumber}` : 'N/A'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>RUNNING HASH PROOF</span>
              <strong style={{ fontSize: '0.78rem', color: '#0284C7', fontFamily: 'monospace' }}>
                {verificationResult.runningHash ? `${verificationResult.runningHash.substring(0, 18)}...` : 'N/A'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Live HCS Topic Feed Preview */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        padding: '2rem',
        border: '1.5px solid #E2E8F0'
      }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0F172A', marginBottom: '1rem' }}>
          Live HCS Topic 0.0.4891024 Immutable Mirror Feed
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentHcsLogs.map((log, i) => (
            <div
              key={i}
              onClick={() => {
                setQuery(log.merkleRoot || log.actor);
                handleVerify(log.merkleRoot || log.actor);
              }}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F1F5F9'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  backgroundColor: '#E0F2FE',
                  color: '#0369A1',
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  Seq #{log.sequenceNumber}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E293B' }}>
                  {log.eventType}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {log.details.substring(0, 60)}...
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                {new Date(log.consensusTimestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BlockchainVerificationPortal;
