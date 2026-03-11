import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { QRCodeCanvas } from 'qrcode.react';
import { fetchFromPinata, decryptData } from '../utils/ipfsHelper';
import { generateLocalShortID } from '../utils/idMappingHelper';

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

  // Fetch On-Chain Data
  React.useEffect(() => {
    const loadPatientData = async () => {
      if (!account) return;

      const provider = new ethers.BrowserProvider(window.ethereum);

      if (medicalRecordsContract) {
        try {
          const recordsReadContract = medicalRecordsContract.connect(provider);
          const records = await recordsReadContract.getPatientRecords(account);
          setMyRecords(records);

          // Fetch Global Prescription Queue and filter by patient wallet
          const allPrescriptions = await recordsReadContract.getPendingPrescriptions();
          const filteredRx = allPrescriptions.filter(rx => rx.patient.toLowerCase() === account.toLowerCase());
          setMyPrescriptions(filteredRx);
        } catch { console.error("Could not fetch MedicalRecords"); }
      }
      if (consentContract) {
        try {
          const consentReadContract = consentContract.connect(provider);
          const requests = await consentReadContract.getPendingRequests(account);
          setPendingRequests(requests);
        } catch { console.error("Could not fetch Pending Requests"); }
      }
      if (walletMapperContract) {
        try {
          const mapperReadContract = walletMapperContract.connect(provider);
          const id = await mapperReadContract.getShortIDFromWallet(account);
          if (id) setShortId(id);
        } catch { console.error("Could not fetch Short ID"); }
      }
    };

    loadPatientData();
  }, [medicalRecordsContract, consentContract, walletMapperContract, account]);

  const handleRegisterShortId = async () => {
    if (!walletMapperContract || !account) return;
    try {
      setIsRegisteringId(true);
      const generatedId = generateLocalShortID(account);
      if (!generatedId) throw new Error("Could not generate ID");
      
      const tx = await walletMapperContract.registerShortID(generatedId, { gasLimit: 500000 });
      toast.info(`Registering Short ID: ${generatedId}... Confirm in Wallet`);
      await tx.wait();
      
      setShortId(generatedId);
      toast.success("Short ID Registered Successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to register Short ID. It might be taken.");
    } finally {
      setIsRegisteringId(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    if (!consentContract) return;
    try {
      // Default to granting a 24-hour consent via the new flow
      const tx = await consentContract.approveRequest(requestId, "Approved via Patient Portal", 86400, { gasLimit: 1000000 });
      await tx.wait();
      toast.success("Provider Request Approved!");

      // Refresh list locally
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      if (onLoadConsents) onLoadConsents();
    } catch {
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
    { title: 'My Health Records', value: myRecords.length, icon: '📋', color: 'var(--primary-color)' },
    { title: 'Active Prescriptions', value: myPrescriptions.length, icon: '💊', color: '#14b8a6' },
    { title: 'Active Consents', value: consents.filter(c => c.isActive).length, icon: '✅', color: 'var(--success-color)' },
    { title: 'Pending Requests', value: pendingRequests.length, icon: '⏳', color: 'var(--warning-color)' }
  ];

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            Patient Dashboard
            {shortId ? (
              <span style={{ fontSize: '1rem', background: 'var(--primary-color)', padding: '0.2rem 0.8rem', borderRadius: '12px', color: '#fff' }}>
                ID: {shortId}
              </span>
            ) : (
              <button 
                className="secondary-btn" 
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
                onClick={handleRegisterShortId}
                disabled={isRegisteringId}
              >
                {isRegisteringId ? "Registering..." : "Create Short ID"}
              </button>
            )}
          </h2>
        </div>
        <div className="dashboard-actions">
          <button
            className="primary-btn"
            onClick={() => setShowGrantForm(true)}
          >
            Grant New Consent
          </button>
          <button
            className="secondary-btn"
            onClick={() => setShowQR(true)}
          >
            Generate QR Code
          </button>
          <button
            className="refresh-btn"
            onClick={onLoadConsents}
          >
            Refresh
          </button>
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

      <div className="dashboard-section glass-panel">
        <h3>Inbound Access Requests</h3>
        {pendingRequests.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>No pending requests from providers.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {pendingRequests.map(req => (
              <div key={req.id.toString()} style={{ padding: '1.5rem', border: '1px solid var(--accent-color)', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>From Fiduciary: {req.provider.slice(0, 6)}...{req.provider.slice(-4)}</div>
                <h4 style={{ marginBottom: '1rem' }}>{req.purpose}</h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="primary-btn" style={{ flex: 1, padding: '0.5rem' }} onClick={() => handleApproveRequest(req.id)}>Approve</button>
                  <button className="revoke-btn" style={{ flex: 1, padding: '0.5rem' }} onClick={() => handleRejectRequest(req.id)}>Reject</button>
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
        <h3>Active Prescriptions</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Medications prescribed by your doctors pending dispensation at a pharmacy.
        </p>

        {myPrescriptions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No active prescriptions found for your wallet.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Prescription ID</th>
                  <th>Status</th>
                  <th>IPFS CID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {myPrescriptions.map((rx, i) => (
                  <tr key={i}>
                    <td><span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>💊</span>#{rx.recordId.toString()}</span></td>
                    <td><span className="status-badge success">{rx.isDispensed ? 'Dispensed' : 'Pending'}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          {rx.cid.slice(0, 10)}...{rx.cid.slice(-10)}
                        </span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(rx.cid); toast.success("CID copied to clipboard!"); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0' }}
                          title="Copy CID"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        className="primary-btn"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => handleDecryptRecord(rx.cid)}
                        disabled={isDecrypting && ipfsCid === rx.cid}
                      >
                        {isDecrypting && ipfsCid === rx.cid ? "Decrypting..." : "Decrypt Data"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dashboard-section glass-panel" style={{ marginTop: '2rem' }}>
        <h3>My Encrypted Records (IPFS)</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Your securely mapped medical data. Share the CID hash with your provider or decrypt it instantly.
        </p>

        {myRecords.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No encrypted records have been mapped to your wallet yet.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Record Type</th>
                  <th>IPFS CID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {myRecords.map((rec, i) => (
                  <tr key={i}>
                    <td><span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>📄</span>{rec.recordType}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          {rec.cid.slice(0, 10)}...{rec.cid.slice(-10)}
                        </span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(rec.cid); toast.success("CID copied to clipboard!"); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0' }}
                          title="Copy CID"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        className="primary-btn"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => handleDecryptRecord(rec.cid)}
                        disabled={isDecrypting && ipfsCid === rec.cid}
                      >
                        {isDecrypting && ipfsCid === rec.cid ? "Decrypting..." : "Decrypt Data"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            className="glass-input"
            placeholder="Or paste an external IPFS CID directly (e.g., Qm...)"
            value={ipfsCid}
            onChange={(e) => setIpfsCid(e.target.value)}
            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)' }}
          />
          <button className="secondary-btn" onClick={() => handleDecryptRecord(ipfsCid)} disabled={isDecrypting}>
            {isDecrypting ? "Decrypting..." : "Decrypt External CID"}
          </button>
        </div>

        {decryptedRecord && (
          <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ color: '#22C55E', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔓</span> Secure Personal Health Record
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem', color: 'var(--text-secondary)' }}>
              <strong>Facility Ref:</strong> <span>{decryptedRecord.type} Provider</span>
              <strong>Record Type:</strong> <span>{decryptedRecord.type}</span>
              <strong>Clinical Data:</strong> <span style={{ color: 'var(--text-color)', lineHeight: '1.5' }}>{decryptedRecord.clinicalData}</span>
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
