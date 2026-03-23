import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { getSafePendingRequests } from '../utils/consentHelper';

const HospitalDashboard = ({
  account,
  consentContract,
  registryContract,
  auditLogContract,
  accessContract,
  medicalRecordsContract,
  walletMapperContract,
  onEmergencyAccess,
  onRequestConsent
}) => {
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyJustification, setEmergencyJustification] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    patientAddress: '',
    category: 'General',
    testType: '',
    clinicalData: '',
    sensitivity: 'Medium',
    billAmount: ''
  });
  const [emergencyTarget, setEmergencyTarget] = useState("");
  const [attendingName, setAttendingName] = useState("");

  // Org Registration State
  const [showOrgRegForm, setShowOrgRegForm] = useState(false);
  const [reqOrgName, setReqOrgName] = useState("");
  const [reqWallet, setReqWallet] = useState("");
  const [reqRole, setReqRole] = useState("1");

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [requestData, setRequestData] = useState({ patientWallet: '', purpose: '', scope: 'All' });
  const [viewDataSettings, setViewDataSettings] = useState({ scope: 'All', purpose: 'Clinical Review' });
  const [claimFiles, setClaimFiles] = useState([]);

  const [interactionHistory, setInteractionHistory] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ requests: 0, uploads: 0, approved: 0, logs: 0 });

  // Data States for Emergency Retrieval
  const [emergencyRecords, setEmergencyRecords] = useState([]);
  const [linkedRecords, setLinkedRecords] = useState([]);
  const [decryptedRecord, setDecryptedRecord] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [ipfsCid, setIpfsCid] = useState('');

  React.useEffect(() => {
    const loadHistory = async () => {
      if (!auditLogContract || !account) return;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const readAudit = auditLogContract.connect(provider);
        const logs = await readAudit.getLogs();

        const normalizedHosp = account.toLowerCase();
        const uniquePatients = new Set();
        logs.forEach(log => {
          if (log.dataFiduciary.toLowerCase() === normalizedHosp) {
            uniquePatients.add(log.dataPrincipal);
          }
        });

        const historyList = [];
        for (const wallet of uniquePatients) {
          let short = "N/A";
          if (walletMapperContract) {
            try {
              const mapperRead = walletMapperContract.connect(provider);
              short = await mapperRead.getShortIDFromWallet(wallet);
            } catch (e) { console.warn("Short ID resolve failed", e); }
          }
          historyList.push({ wallet, shortId: short });
        }
        setInteractionHistory(historyList);
        setStats(prev => ({ ...prev, logs: logs.filter(l => l.dataFiduciary.toLowerCase() === normalizedHosp).length }));
      } catch (err) {
        console.error("Failed to fetch hospital history:", err);
      }
    };
    loadHistory();
  }, [auditLogContract, account]);

  React.useEffect(() => {
    if (interactionHistory.length > 0) {
      syncHospitalLogs();
    }
  }, [interactionHistory]);

  const syncHospitalLogs = async () => {
    if (!consentContract || interactionHistory.length === 0) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const readAudit = auditLogContract.connect(provider);
      const readConsent = consentContract.connect(provider);
      const allLogs = await readAudit.getLogs();

      const myLogs = (allLogs || [])
        .filter(l => l?.dataFiduciary?.toLowerCase() === account?.toLowerCase())
        .map(l => {
          const pt = (interactionHistory || []).find(h => h?.wallet?.toLowerCase() === l?.dataPrincipal?.toLowerCase());
          return {
            patient: pt ? pt.shortId : l?.dataPrincipal?.slice(0, 10) || 'N/A',
            type: l?.action || 'Event',
            timestamp: l?.timestamp ? new Date(Number(l.timestamp) * 1000).toLocaleString() : 'N/A',
            status: 'Verified'
          };
        }).reverse();

      setAccessLogs(myLogs);

      // Fetch pending requests count
      let totalPending = 0;
      for (const item of interactionHistory) {
        try {
          const pending = await getSafePendingRequests(readConsent, item.wallet, consentContract.target, provider);
          totalPending += pending.filter(r => r.provider.toLowerCase() === account.toLowerCase()).length;
        } catch (err) {
          console.error("Failed to fetch pending for", item.wallet, err);
        }
      }
      setStats(prev => ({ ...prev, requests: totalPending, logs: myLogs.length }));

    } finally {
      setLoading(false);
    }
  };

  const fetchAuthorizedRecords = async (isEmergency = false) => {
    const target = isEmergency ? emergencyTarget : "";
    if (!target) return;

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const { resolveWalletAddress } = await import('../utils/idMappingHelper');
      const targetWallet = await resolveWalletAddress(target, walletMapperContract);

      if (medicalRecordsContract) {
        toast.info(isEmergency ? "🚨 Aggregating Global Clinical Data..." : "Fetching records...");
        const readContract = medicalRecordsContract.connect(provider);
        const records = await readContract.getPatientRecords(targetWallet);

        const formatted = (records || []).map(r => ({
          id: r?.id?.toString() || Math.random().toString(),
          type: r?.recordType || 'Record',
          status: isEmergency ? "🚨 EMERGENCY" : "Authorized",
          cid: r?.cid || 'N/A',
          provider: r?.provider || 'N/A',
          billAmount: r?.billAmount ? r.billAmount.toString() : '0'
        }));

        setEmergencyRecords(formatted);

        // Fetch specifically linked/consented data
        if (consentContract) {
          const { getSafePatientConsents } = await import('../utils/consentHelper');
          const consentRead = consentContract.connect(provider);
          const cons = await getSafePatientConsents(consentRead, targetWallet, consentContract.target, provider);

          const linked = [];
          cons.forEach(c => {
            if (c.isActive && c.dataHash) {
              c.dataHash.split(',').forEach(cid => {
                if (cid.trim()) linked.push({
                  cid: cid.trim(),
                  purpose: c.purpose,
                  sharedAt: c.grantedAt
                });
              });
            }
          });
          setLinkedRecords(linked);
        }

        toast.success("Emergency context sync complete.");
      }
    } catch (err) {
      console.error("Fetch failed:", err);
      toast.error("Emergency data retrieval failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDecryptRecord = async (cid) => {
    try {
      setIsDecrypting(true);
      const { fetchFromPinata, decryptData } = await import('../utils/ipfsHelper');
      const cipher = await fetchFromPinata(cid);
      const raw = decryptData(cipher);
      setDecryptedRecord(raw);
      toast.success("Record Decrypted");
    } catch (err) {
      toast.error("Decryption failed");
    } finally {
      setIsDecrypting(false);
    }
  };



  const handleEmergencyAccess = async () => {
    if (!emergencyTarget || !emergencyJustification || !attendingName) {
      toast.error("Patient address, Justification, and Attending Name are required");
      return;
    }
    setLoading(true);
    try {
      const success = await onEmergencyAccess(emergencyTarget, emergencyJustification, attendingName);
      if (success) {
        setShowEmergencyModal(false);
        setEmergencyJustification("");
        setAttendingName("");
        setStats(prev => ({ ...prev, approved: prev.approved + 1 }));
        syncHospitalLogs();
        fetchAuthorizedRecords(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUploadRecord = async (e) => {
    e.preventDefault();
    if (!uploadData.patientAddress || !uploadData.clinicalData) {
      toast.error("Required fields missing");
      return;
    }

    try {
      setLoading(true);
      toast.info("Preparing DPDP-compliant record...");

      const { resolveWalletAddress } = await import('../utils/idMappingHelper');
      const targetWallet = await resolveWalletAddress(uploadData.patientAddress, walletMapperContract);

      // Feature: Sensitivity Tagging in IPFS payload
      const payload = {
        type: uploadData.testType || "General Medical",
        category: uploadData.category,
        clinicalData: uploadData.clinicalData,
        sensitivity: uploadData.sensitivity, // TAGGING
        provider: account,
        timestamp: new Date().toISOString()
      };

      const { encryptData, uploadToPinata } = await import('../utils/ipfsHelper');
      const encrypted = encryptData(payload);
      const cid = await uploadToPinata(encrypted, `Record: ${payload.type}`);

      const billAmountNum = uploadData.billAmount ? BigInt(uploadData.billAmount) : 0n;
      const tx = await medicalRecordsContract.addRecord(targetWallet, cid, payload.type, billAmountNum, { gasLimit: 1000000 });
      await tx.wait();

      toast.success("Record Anchored on Hedera!");
      setShowUploadModal(false);
      setStats(prev => ({ ...prev, uploads: prev.uploads + 1 }));
      syncHospitalLogs();
    } catch (err) {
      toast.error("Upload failed: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestConsent = async (e) => {
    e.preventDefault();
    if (!requestData.patientWallet || !requestData.purpose) {
      toast.error("Please fill patient wallet and purpose");
      return;
    }
    try {
      await onRequestConsent(requestData.patientWallet, requestData.purpose);
      setShowRequestModal(false);
      syncHospitalLogs();
    } catch (err) {
      toast.error("Failed to send request");
    }
  };

  const submitRoleRequest = (e) => {
    e.preventDefault();
    const newRequest = { orgName: reqOrgName, wallet: reqWallet, roleId: reqRole, status: 'pending', timestamp: Date.now() };
    const existingReqs = JSON.parse(localStorage.getItem('dpdp_role_requests') || '[]');
    existingReqs.push(newRequest);
    localStorage.setItem('dpdp_role_requests', JSON.stringify(existingReqs));
    toast.success("Organization Registration request submitted to Admin");
    setShowOrgRegForm(false);
    setReqOrgName("");
    setReqWallet("");
  };

  const dashboardCards = [
    { title: 'Access Logs', value: stats.logs, icon: '🔍', color: 'var(--medical-aqua)' }
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
        <div className="dashboard-actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="primary-btn" style={{ backgroundColor: '#EF4444' }} onClick={() => setShowEmergencyModal(true)}>
            🚨 Emergency
          </button>

          <button className="secondary-btn" onClick={() => setShowInsuranceModal(true)} style={{ background: '#3B82F6', color: 'white', border: 'none' }}>
            🏢 Request Insurance
          </button>

          <button className="secondary-btn" onClick={() => {
            setReqWallet(account);
            setShowOrgRegForm(true);
          }} style={{ marginLeft: 'auto' }}>
            Staff Registration
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        {dashboardCards.map((card, index) => (
          <div key={index} className="dashboard-card floating-card" style={{
            borderTop: `4px solid ${card.color}`,
            padding: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
            maxWidth: '450px',
            background: 'linear-gradient(to bottom right, #ffffff, #f8faff)'
          }}>
            <div className="card-icon" style={{
              backgroundColor: `${card.color}15`,
              color: card.color,
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: `0 8px 16px -4px ${card.color}30`
            }}>
              {card.icon}
            </div>
            <div className="card-content">
              <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: '500' }}>{card.title}</h3>
              <p className="card-value" style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1' }}>{card.value}</p>
              <p style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.6rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ● On-chain Verified
              </p>
            </div>
          </div>
        ))}
      </div>

      {emergencyRecords.length > 0 && (
        <div className="dashboard-section glass-panel" style={{ borderLeft: '6px solid #EF4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ color: '#EF4444' }}>🚨 EMERGENCY CLINICAL VIEW</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Aggregated clinical records authorized via Break-Glass protocol.</p>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>CID (Hash)</th>
                  <th>Provider</th>
                  <th>Bill</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(emergencyRecords || []).map((r, idx) => (
                  <tr key={idx}>
                    <td><strong>{r?.type || 'Record'}</strong></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r?.cid?.slice(0, 16) || 'N/A'}...</td>
                    <td><span style={{ fontSize: '0.8rem' }}>{r?.provider?.slice(0, 10) || 'N/A'}...</span></td>
                    <td>{r?.billAmount || '0'} HBAR</td>
                    <td>
                      <button className="primary-btn" style={{ background: '#EF4444', padding: '0.4rem 0.8rem' }} onClick={() => handleDecryptRecord(r?.cid)}>
                        🔓 Decrypt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {decryptedRecord && (
            <div className="floating-card" style={{ marginTop: '2rem', background: 'rgba(239, 68, 68, 0.05)', borderColor: '#EF4444' }}>
              <h4 style={{ color: '#EF4444', marginBottom: '1rem' }}>Clinical Data (Decrypted)</h4>
              <p><strong>Findings:</strong> {decryptedRecord.clinicalData}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type: {decryptedRecord.type} | Sensitivity: {decryptedRecord.sensitivity}</p>
              <button className="secondary-btn" onClick={() => setDecryptedRecord(null)} style={{ marginTop: '1rem' }}>Close Viewer</button>
            </div>
          )}
        </div>
      )}

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
              {(!accessLogs || accessLogs.length === 0) ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No recent access logs found on-chain.</td>
                </tr>
              ) : (
                accessLogs.map((log, idx) => (
                  <tr key={idx}>
                    <td><strong style={{ color: 'var(--medical-primary)' }}>{log?.patient || 'N/A'}</strong></td>
                    <td>{log?.type || 'Event'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{log?.timestamp || 'N/A'}</td>
                    <td><span className="status-badge active">{log?.status || 'Active'}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Formal Consent Request</h3>
              <button className="close-btn" onClick={() => setShowRequestModal(false)}>×</button>
            </div>
            <form onSubmit={handleRequestConsent} className="modal-body">
              <div className="form-group">
                <label>Patient Wallet Address *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={requestData.patientWallet}
                    onChange={(e) => setRequestData({ ...requestData, patientWallet: e.target.value })}
                    placeholder="0x..."
                    required
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Purpose of Data Retrieval *</label>
                <input
                  type="text"
                  value={requestData.purpose}
                  onChange={(e) => setRequestData({ ...requestData, purpose: e.target.value })}
                  placeholder="e.g., Emergency Surgery Review"
                  required
                />
              </div>
              <div className="form-group">
                <label>Requested Data Scope</label>
                <select
                  value={requestData.scope}
                  onChange={(e) => setRequestData({ ...requestData, scope: e.target.value })}
                >
                  <option value="All">All Health Records</option>
                  <option value="Lab Reports">Lab Reports Only</option>
                  <option value="Prescriptions">Prescriptions Only</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Send Request</button>
                <button type="button" className="secondary-btn" onClick={() => setShowRequestModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOrgRegForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Staff Registration</h3>
              <button className="close-btn" onClick={() => setShowOrgRegForm(false)}>×</button>
            </div>
            <form onSubmit={submitRoleRequest} className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  className="glass-input"
                  value={reqOrgName}
                  onChange={(e) => setReqOrgName(e.target.value)}
                  placeholder="Organization or Facility Name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Wallet Address</label>
                <input
                  type="text"
                  className="glass-input"
                  value={reqWallet}
                  onChange={(e) => setReqWallet(e.target.value)}
                  placeholder="0x..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Healthcare Role</label>
                <select
                  className="glass-input"
                  value={reqRole}
                  onChange={(e) => setReqRole(e.target.value)}
                >
                  <option value="1">Hospital</option>
                  <option value="2">Lab</option>
                  <option value="3">Doctor</option>
                  <option value="4">Pharmacy</option>
                  <option value="5">Insurance</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Submit Request</button>
                <button type="button" className="secondary-btn" onClick={() => setShowOrgRegForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmergencyModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ borderColor: '#EF4444' }}>
            <div className="modal-header">
              <h3 style={{ color: '#EF4444' }}>🚨 EMERGENCY BREAK-GLASS ACCESS</h3>
              <button className="close-btn" onClick={() => setShowEmergencyModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert-warning" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', color: '#991B1B', fontSize: '0.9rem' }}>
                <strong>WARNING:</strong> This action overrides normal consent. A permanent, immutable justification will be logged on the Hedera ledger and the patient will be notified immediately.
              </div>
              <div className="form-group">
                <label>Patient Wallet / Short ID *</label>
                <input
                  className="glass-input"
                  value={emergencyTarget}
                  onChange={(e) => setEmergencyTarget(e.target.value)}
                  placeholder="0x... or Short ID"
                />
              </div>
              <div className="form-group">
                <label>Attending Official Name *</label>
                <input
                  className="glass-input"
                  value={attendingName}
                  onChange={(e) => setAttendingName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith (Admin / ER Chief)"
                  required
                />
              </div>
              <div className="form-group">
                <label>Emergency Justification *</label>
                <textarea
                  className="glass-input"
                  rows="3"
                  placeholder="e.g. Patient unconscious in ER, immediate history required for surgery."
                  value={emergencyJustification}
                  onChange={(e) => setEmergencyJustification(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button className="primary-btn" style={{ background: '#EF4444', width: '100%' }} onClick={handleEmergencyAccess}>
                  Verify & Initiate Break-Glass
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Upload Comprehensive Health Record</h3>
              <button className="close-btn" onClick={() => setShowUploadModal(false)}>×</button>
            </div>
            <form onSubmit={handleUploadRecord} className="modal-body">
              <div className="form-group">
                <label>Patient Address / Short ID *</label>
                <input className="glass-input" value={uploadData.patientAddress} onChange={e => setUploadData({ ...uploadData, patientAddress: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Record Type / Category</label>
                <input className="glass-input" value={uploadData.testType} onChange={e => setUploadData({ ...uploadData, testType: e.target.value })} placeholder="e.g. Cardiology Summary" />
              </div>
              <div className="form-group">
                <label>Clinical Data / Findings *</label>
                <textarea className="glass-input" rows="4" value={uploadData.clinicalData} onChange={e => setUploadData({ ...uploadData, clinicalData: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Data Sensitivity (DPDP Rating) *</label>
                <select className="glass-input" value={uploadData.sensitivity} onChange={e => setUploadData({ ...uploadData, sensitivity: e.target.value })}>
                  <option value="Low">Low (Prescriptions, Vitals)</option>
                  <option value="Medium">Medium (Lab Reports, Imaging)</option>
                  <option value="High">High (Diagnosis, Psych, HIV)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Billing Amount (HBAR) / Claimable Fee</label>
                <input
                  type="number"
                  className="glass-input"
                  value={uploadData.billAmount}
                  onChange={e => setUploadData({ ...uploadData, billAmount: e.target.value })}
                  placeholder="e.g. 2500"
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn" disabled={loading}>Anchor Encrypted Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showInsuranceModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Initiate Insurance Claim Request</h3>
              <button className="close-btn" onClick={() => setShowInsuranceModal(false)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();

              const fileToBase64 = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
              });

              const insProvider = e.target.insuranceWallet.value;
              const patient = e.target.patientWallet.value;
              const surgeryType = e.target.surgeryType.value;
              const amount = e.target.claimAmount.value;
              const purpose = `Surgery Claim Review - ${surgeryType || "General"}${amount ? ` | Amount: ${amount}` : ""}`;

              if (!insProvider || !patient) {
                toast.error("Insurance Provider and Patient information required");
                return;
              }

              try {
                setLoading(true);

                let evidenceString = "";
                if (claimFiles.length > 0) {
                  toast.info(`Encoding ${claimFiles.length} files to Local Vault...`);
                  const evdIds = [];
                  const vault = JSON.parse(localStorage.getItem('hedera_evidence_vault') || '{}');

                  for (const file of claimFiles) {
                    const base64 = await fileToBase64(file);
                    const evdId = `EVD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    vault[evdId] = {
                      name: file.name,
                      type: file.type,
                      data: base64
                    };
                    evdIds.push(evdId);
                  }

                  localStorage.setItem('hedera_evidence_vault', JSON.stringify(vault));
                  evidenceString = " | Evidence: " + evdIds.join(", ");
                }

                toast.info("Sending Claim Initialization notice to Insurance...");
                const finalPurpose = purpose + evidenceString;

                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const auditWithSigner = auditLogContract.connect(signer);

                const { resolveWalletAddress } = await import('../utils/idMappingHelper');
                const patientWallet = await resolveWalletAddress(patient, walletMapperContract);
                const insuranceWallet = await resolveWalletAddress(insProvider, walletMapperContract);

                const tx = await auditWithSigner.logAccessRequested(
                  patientWallet,
                  insuranceWallet,
                  finalPurpose,
                  Math.floor(Date.now() / 1000),
                  { gasLimit: 1000000 }
                );
                await tx.wait();

                toast.success("Insurance notified via Ledger Event!");
                setShowInsuranceModal(false);
                setClaimFiles([]);
              } catch (err) {
                toast.error("Failed to notify insurance: " + err.message);
              } finally {
                setLoading(false);
              }
            }} className="modal-body">
              <div className="form-group">
                <label>Insurance Provider (Wallet or Short ID) *</label>
                <input name="insuranceWallet" className="glass-input" placeholder="0x... or INS123" required />
              </div>
              <div className="form-group">
                <label>Patient (Wallet or Short ID) *</label>
                <input name="patientWallet" className="glass-input" placeholder="0x... or PAT456" required />
              </div>
              <div className="form-group">
                <label>Claim Category / Surgery Type *</label>
                <input name="surgeryType" className="glass-input" placeholder="e.g. Cardiac Bypass" required />
              </div>
              <div className="form-group">
                <label>Total Claim Amount (INR) *</label>
                <input name="claimAmount" type="number" className="glass-input" placeholder="e.g. 150000" required />
              </div>
              <div className="form-group">
                <label>Related Evidence Files (Bills, Reports)</label>
                <input
                  type="file"
                  multiple
                  className="glass-input"
                  onChange={(e) => setClaimFiles(Array.from(e.target.files))}
                  style={{ paddingTop: '10px' }}
                />
                {claimFiles.length > 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--medical-aqua)', marginTop: '5px' }}>
                    {claimFiles.length} files selected
                  </p>
                )}
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn" disabled={loading}>Log Claim Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalDashboard;
