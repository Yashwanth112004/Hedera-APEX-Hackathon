import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { QRCodeCanvas } from 'qrcode.react';
import { fetchFromPinata, decryptData } from '../utils/ipfsHelper';
import { normalizeAddress, generateLocalShortID } from '../utils/idMappingHelper';

const PatientDashboard = ({
  account,
  consents,
  onGrantConsent,
  onRevokeConsent,
  onEraseConsent,
  onLoadConsents,
  consentContract, // Needed to fetch/approve requests directly
  medicalRecordsContract,
  walletMapperContract
}) => {
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [formData, setFormData] = useState({
    hospitalAddress: '',
    purpose: '',
    dataCategories: 'medical_records',
    duration: '86400'
  });

  // IPFS Decryption State
  const [ipfsCid, setIpfsCid] = useState('');
  const [decryptedRecord, setDecryptedRecord] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [myRecords, setMyRecords] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [shortId, setShortId] = useState('');
  const [isRegisteringId, setIsRegisteringId] = useState(false);
  const [myPrescriptions, setMyPrescriptions] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [selectedCids, setSelectedCids] = useState([]);

  // Fetch On-Chain Data
  React.useEffect(() => {
    const loadPatientData = async () => {
      if (!account) return;
      const normalizedAccount = normalizeAddress(account);

      const provider = new ethers.BrowserProvider(window.ethereum);

      if (medicalRecordsContract) {
        try {
          const recordsReadContract = medicalRecordsContract.connect(provider);
          const records = await recordsReadContract.getPatientRecords(normalizedAccount);
          setMyRecords(records);

          // Fetch Global Prescription Queue and filter by patient wallet
          const allPrescriptions = await recordsReadContract.getPendingPrescriptions();
          const filteredRx = allPrescriptions.filter(rx => normalizeAddress(rx.patient) === normalizedAccount);
          setMyPrescriptions(filteredRx);
        } catch { console.error("Could not fetch MedicalRecords"); }
      }
      if (consentContract) {
        try {
          const consentReadContract = consentContract.connect(provider);
          const requests = await consentReadContract.getPendingRequests(normalizedAccount);
          setPendingRequests(requests);
        } catch { console.error("Could not fetch Pending Requests"); }
      }
      if (walletMapperContract) {
        try {
          const mapperReadContract = walletMapperContract.connect(provider);
          const id = await mapperReadContract.getShortIDFromWallet(normalizedAccount);
          if (id) setShortId(id);
        } catch { console.error("Could not fetch Short ID"); }
      }
    };

    loadPatientData();
  }, [medicalRecordsContract, consentContract, walletMapperContract, account]);

  const handleRegisterShortId = async () => {
    if (!walletMapperContract || !account) return;
    const normalizedAccount = normalizeAddress(account);
    
    try {
      setIsRegisteringId(true);
      
      // Attempt generation with retry logic
      let generatedId = "";
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        generatedId = generateLocalShortID(normalizedAccount);
        
        // Quick check if ID exists locally or some other sanity check could go here
        try {
          const tx = await walletMapperContract.registerShortID(generatedId, { gasLimit: 500000 });
          toast.info(`Registering ID: ${generatedId}. Please confirm in HashPack...`);
          await tx.wait();
          
          setShortId(generatedId);
          toast.success(`Short ID '${generatedId}' is now yours!`);
          return; // Success!
        } catch (err) {
          // Check for "already taken" revert string if possible, or just retry
          const errMsg = err.message || "";
          if (errMsg.includes("taken") && attempts < maxAttempts - 1) {
            attempts++;
            continue;
          }
          if (errMsg.includes("already has a Short ID")) {
            toast.warning("Your wallet is already registered. Refreshing...");
            // Trigger refresh
            const id = await walletMapperContract.getShortIDFromWallet(normalizedAccount);
            if (id) setShortId(id);
            return;
          }
          throw err; // Re-throw if it's a different error
        }
      }
    } catch (err) {
      console.error("Short ID Registration Error:", err);
      toast.error(err.reason || err.message || "Registration failed. Try again.");
    } finally {
      setIsRegisteringId(false);
    }
  };

  const handleApproveRequest = (requestId) => {
    if (!consentContract) return;
    const allCids = [
      ...myRecords.map(r => r.cid),
      ...myPrescriptions.map(p => p.cid)
    ];

    if (allCids.length > 0) {
      setSelectedRequestId(requestId);
      setShowSelectionModal(true);
      setSelectedCids([]); // reset
    } else {
      // If no records, just approve normally with empty hash
      executeApproval(requestId, "");
    }
  };

  const executeApproval = async (requestId, dataHash) => {
    try {
      toast.info("Approving request & linking data...");
      const tx = await consentContract.approveRequest(requestId, dataHash, 86400, { gasLimit: 1000000 });
      await tx.wait();
      toast.success("Request Approved & Records Linked!");
      setShowSelectionModal(false);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      if (onLoadConsents) onLoadConsents();
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve request.");
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!consentContract) return;
    try {
      const tx = await consentContract.rejectRequest(requestId, { gasLimit: 1000000 });
      await tx.wait();
      toast.success("Request Rejected");
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch {
      toast.error("Failed to reject request.");
    }
  };

  const handleGrantConsent = async (e) => {
    e.preventDefault();
    if (!formData.hospitalAddress || !formData.purpose) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await onGrantConsent(formData.hospitalAddress, formData.purpose);
      setShowGrantForm(false);
      setFormData({ hospitalAddress: '', purpose: '', dataCategories: 'medical_records', duration: '86400' });
      toast.success('Consent granted successfully');
    } catch {
      toast.error('Failed to grant consent');
    }
  };

  const handleRevokeConsent = async (index) => {
    try {
      await onRevokeConsent(index);
      toast.success('Consent revoked successfully');
    } catch {
      toast.error('Failed to revoke consent');
    }
  };

  const handleEraseConsent = async (index) => {
    try {
      await onEraseConsent(index);
      toast.success('Consent erased successfully');
    } catch {
      toast.error('Failed to erase consent');
    }
  };

  const handleDecryptRecord = async (cidToDecrypt) => {
    const targetCid = typeof cidToDecrypt === 'string' ? cidToDecrypt : ipfsCid;
    if (!targetCid) {
      toast.error("Please provide a valid IPFS CID");
      return;
    }

    try {
      setIsDecrypting(true);
      setIpfsCid(targetCid); // Keep sync
      toast.info("Fetching your encrypted data from IPFS...");
      const cipherText = await fetchFromPinata(targetCid);

      toast.info("Decrypting with your secure keys...");
      await new Promise(r => setTimeout(r, 800)); // UI Delay

      const rawData = decryptData(cipherText);
      setDecryptedRecord(rawData);
      toast.success("Health Record Decrypted successfully!");
    } catch (error) {
      toast.error(error.message || "Failed to decrypt. Ensure this is a valid DPDP health record.");
      setDecryptedRecord(null);
    } finally {
      setIsDecrypting(false);
    }
  };

  // Updated icons to use emojis more fitting the vibrant theme or generic texts
  const dashboardCards = [
    { title: 'My Health Records', value: myRecords.length, icon: '📋', color: 'var(--medical-primary)' },
    { title: 'Active Prescriptions', value: myPrescriptions.length, icon: '💊', color: 'var(--medical-teal)' },
    { title: 'Active Consents', value: consents.filter(c => c.isActive).length, icon: '✅', color: 'var(--status-approved)' },
    { title: 'Pending Requests', value: pendingRequests.length, icon: '⏳', color: 'var(--status-pending)' }
  ];

  return (
    <div className="patient-dashboard animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--medical-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Patient Health Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Securely manage your clinical data and privacy consents.</p>
        </div>
        <div className="dashboard-actions">
          <button
            className="primary-btn"
            onClick={() => setShowGrantForm(true)}
            style={{ borderRadius: '50px', padding: '0.8rem 1.8rem' }}
          >
            Grant New Consent
          </button>
          <button
            className="secondary-btn"
            onClick={() => setShowQR(true)}
            style={{ borderRadius: '50px', padding: '0.8rem 1.8rem' }}
          >
            Share ID QR
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
        <div className="glass-panel floating-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--medical-primary)', marginBottom: '0.25rem' }}>Digital Identity</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{account}</p>
            </div>
          </div>
          
          <div style={{ marginTop: '1rem' }}>
            {shortId ? (
              <div style={{ background: 'var(--grad-teal)', padding: '1.2rem', borderRadius: '16px', color: 'white', textAlign: 'center', boxShadow: '0 8px 20px rgba(20, 184, 166, 0.2)' }}>
                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8, marginBottom: '0.25rem' }}>Verified Patient ID</p>
                <h2 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '2px', color: 'white', margin: 0 }}>{shortId}</h2>
              </div>
            ) : (
              <button 
                className="primary-btn" 
                onClick={handleRegisterShortId} 
                disabled={isRegisteringId}
                style={{ width: '100%', borderRadius: '16px', padding: '1rem' }}
              >
                {isRegisteringId ? "Securing..." : "Generate Patient ID"}
              </button>
            )}
          </div>
        </div>

        {dashboardCards.map((card, index) => (
          <div key={index} className="dashboard-card floating-card" style={{ borderTop: `4px solid ${card.color}`, padding: '1.5rem 2rem' }}>
            <div className="card-icon" style={{ backgroundColor: `${card.color}10`, color: card.color }}>
              {card.icon}
            </div>
            <div className="card-content">
              <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{card.title}</h3>
              <p className="card-value" style={{ fontSize: '1.8rem', fontWeight: '800' }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-section glass-panel">
        <h3>Inbound Access Requests</h3>
        {pendingRequests.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No pending requests from providers.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {pendingRequests.map(req => (
              <div key={req.id.toString()} className="floating-card" style={{ borderColor: 'var(--medical-primary)40' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Provider: {req.provider.slice(0, 8)}...{req.provider.slice(-4)}</div>
                <h4 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>{req.purpose}</h4>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="primary-btn" style={{ flex: 1 }} onClick={() => handleApproveRequest(req.id)}>Approve</button>
                  <button className="secondary-btn" style={{ flex: 1, color: '#EF4444', borderColor: '#EF444420' }} onClick={() => handleRejectRequest(req.id)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-section glass-panel" style={{ marginTop: '2rem' }}>
        <h3>My Consents</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Hospital</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Expiry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {consents.map((consent, index) => (
                <tr key={index}>
                  <td>#{index}</td>
                  <td>{consent.dataFiduciary.slice(0, 6)}...{consent.dataFiduciary.slice(-4)}</td>
                  <td>{consent.purpose}</td>
                  <td>
                    <span className={`status-badge ${consent.isActive ? 'active' : 'revoked'}`}>
                      {consent.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td>{new Date(Number(consent.expiry) * 1000).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      {consent.isActive && (
                        <button
                          className="revoke-btn"
                          onClick={() => handleRevokeConsent(index)}
                          title="Revoke active consent"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        className="erase-btn"
                        onClick={() => handleEraseConsent(index)}
                        title="Right to Erasure (DPDP Act 2023)"
                      >
                        Erase Data
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-section glass-panel" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3>Master Health Records</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              All secure medical data cryptographically linked to your identity.
            </p>
          </div>
          {shortId && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Account Link:</span>
              <div style={{ fontWeight: 'bold', color: 'var(--medical-primary)' }}>Short ID: {shortId}</div>
            </div>
          )}
        </div>

        {myRecords.length === 0 && myPrescriptions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
            <p>No health records or prescriptions found for this wallet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Origin / ID</th>
                  <th>IPFS CID</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {/* Consolidate both records and prescriptions */}
                {[
                  ...myRecords.map(r => ({ 
                    id: r.id, 
                    patient: r.patient, 
                    provider: r.provider, 
                    cid: r.cid, 
                    recordType: r.recordType, 
                    timestamp: r.timestamp,
                    category: 'Record' 
                  })),
                  ...myPrescriptions.map(p => ({ 
                    id: p.recordId, 
                    patient: p.patient, 
                    patientName: p.patientName, 
                    cid: p.cid, 
                    recordType: 'Prescription', 
                    category: 'Prescription' 
                  }))
                ].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)).map((item, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{item.category === 'Prescription' ? '💊' : '📄'}</span>
                        {item.recordType}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {item.category === 'Prescription' ? `RX #${item.id.toString()}` : `From: ${item.provider.slice(0, 6)}...${item.provider.slice(-4)}`}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          {item.cid?.slice(0, 8) || "N/A"}...
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(item.cid); toast.success("CID copied!"); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                          title="Copy Full CID"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {item.timestamp ? new Date(Number(item.timestamp) * 1000).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="primary-btn"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => handleDecryptRecord(item.cid)}
                        disabled={isDecrypting && ipfsCid === item.cid}
                      >
                        {isDecrypting && ipfsCid === item.cid ? "..." : "🔓 Decrypt"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>External CID Lookup</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Directly decrypt records shared via IPFS hash (CID).
          </p>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input
              type="text"
              className="glass-input"
              placeholder="Paste IPFS CID (e.g., Qm...)"
              value={ipfsCid}
              onChange={(e) => setIpfsCid(e.target.value)}
              style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)' }}
            />
            <button className="secondary-btn" onClick={() => handleDecryptRecord(ipfsCid)} disabled={isDecrypting}>
              {isDecrypting ? "Decrypting..." : "Decrypt External CID"}
            </button>
          </div>
        </div>

        {decryptedRecord && (
          <div style={{ marginTop: '2rem', padding: '2rem', backgroundColor: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--medical-primary)', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <h4 style={{ color: 'var(--medical-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
                <span>🔓</span> Decrypted Health Record
              </h4>
              <button 
                className="close-btn" 
                onClick={() => setDecryptedRecord(null)}
                style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Category</div>
                <div style={{ fontWeight: '600' }}>{decryptedRecord.category || decryptedRecord.type || "Medical Record"}</div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Type</div>
                <div style={{ fontWeight: '600' }}>{decryptedRecord.type || decryptedRecord.recordType || "N/A"}</div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', gridColumn: 'span 2' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Clinical Data / Observation</div>
                <div style={{ color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {decryptedRecord.clinicalData || decryptedRecord.medication || "No summary provided"}
                  {decryptedRecord.dosage && `\nDosage: ${decryptedRecord.dosage}`}
                  {decryptedRecord.duration && `\nDuration: ${decryptedRecord.duration}`}
                </div>
              </div>
              {decryptedRecord.fileData && (
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Attached Documents</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '1.5rem' }}>📄</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{decryptedRecord.fileName || "medical_report.pdf"}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Secure Digital Asset</div>
                    </div>
                    <a 
                      href={decryptedRecord.fileData} 
                      download={decryptedRecord.fileName || "report"} 
                      className="secondary-btn"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      Download
                    </a>
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
              Decrypted at: {new Date().toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {showGrantForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Grant Consent</h3>
              <button className="close-btn" onClick={() => setShowGrantForm(false)}>×</button>
            </div>
            <form onSubmit={handleGrantConsent} className="modal-body">
              <div className="form-group">
                <label>Hospital Address *</label>
                <input
                  type="text"
                  value={formData.hospitalAddress}
                  onChange={(e) => setFormData({ ...formData, hospitalAddress: e.target.value })}
                  placeholder="0x..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Purpose of Data Use (DPDP Purpose Limitation) *</label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="e.g., Medical Treatment"
                  required
                />
              </div>
              <div className="form-group">
                <label>Data Categories</label>
                <select
                  value={formData.dataCategories}
                  onChange={(e) => setFormData({ ...formData, dataCategories: e.target.value })}
                >
                  <option value="medical_records">Medical Records</option>
                  <option value="lab_results">Lab Results</option>
                  <option value="prescriptions">Prescriptions</option>
                  <option value="all">All Health Data</option>
                </select>
              </div>
              <div className="form-group">
                <label>Consent Duration (seconds)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="86400 (24 hours)"
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Grant Consent</button>
                <button type="button" className="secondary-btn" onClick={() => setShowGrantForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSelectionModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Link Records to Access Request</h3>
              <button className="close-btn" onClick={() => setShowSelectionModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Select the records you want the provider to see immediately upon your approval.
              </p>
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  ...myRecords.map(r => ({ cid: r.cid, type: r.recordType, cat: 'Record' })),
                  ...myPrescriptions.map(p => ({ cid: p.cid, type: 'Prescription', cat: 'Prescription' }))
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`glass-panel ${selectedCids.includes(item.cid) ? 'active-gradient' : ''}`}
                    style={{ padding: '1rem', cursor: 'pointer', border: selectedCids.includes(item.cid) ? '1px solid var(--medical-primary)' : '1px solid var(--glass-border)' }}
                    onClick={() => {
                      setSelectedCids(prev => 
                        prev.includes(item.cid) ? prev.filter(c => c !== item.cid) : [...prev, item.cid]
                      );
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem' }}>{item.cat === 'Prescription' ? '💊' : '📄'} {item.type}</span>
                      <input type="checkbox" checked={selectedCids.includes(item.cid)} readOnly />
                    </div>
                    <code style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{item.cid.slice(0, 16)}...</code>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button 
                  className="primary-btn" 
                  onClick={() => executeApproval(selectedRequestId, selectedCids.join(','))}
                  disabled={selectedCids.length === 0}
                >
                  Confirm & Link {selectedCids.length} Records
                </button>
                <button 
                  className="secondary-btn" 
                  onClick={() => executeApproval(selectedRequestId, "")}
                >
                  Approve Without Linking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQR && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Your QR Code</h3>
              <button className="close-btn" onClick={() => setShowQR(false)}>×</button>
            </div>
            <div className="modal-body qr-modal">
              <div className="qr-container">
                <QRCodeCanvas
                  value={account}
                  size={256}
                  level="H"
                />
                <p>Share this QR code with healthcare providers to grant them access to your wallet address</p>
                <p className="wallet-address">{account}</p>
              </div>
              <div className="modal-actions">
                <button className="secondary-btn" onClick={() => setShowQR(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
