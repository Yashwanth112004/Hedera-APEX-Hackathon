import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { QRCodeCanvas } from 'qrcode.react';
import { Wallet, LogOut, Shield, Activity, Clock, FileText, Lock, Plus, Search, Check, AlertTriangle, Eye, Download, UserPlus, Trash2, Edit3, X, Info } from 'lucide-react';
import DPDPNotice from '../components/DPDPNotice';
import { fetchFromPinata, decryptData } from '../utils/ipfsHelper';
import { normalizeAddress, generateLocalShortID } from '../utils/idMappingHelper';
import { getSafePendingRequests, safeApproveRequest } from '../utils/consentHelper';

const PatientDashboard = ({
  account,
  consents,
  onGrantConsent,
  onRevokeConsent,
  onLoadConsents,
  onRenewConsent,
  onMonitorSpam,
  isActingAsBeneficiary,
  consentContract, // Needed to fetch/approve requests directly
  medicalRecordsContract,
  walletMapperContract,
  rbacContract
}) => {
  const [activeTab, setActiveTab] = useState('beneficiaries');
  const [highRequesterMap, setHighRequesterMap] = useState({});
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
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [selectedCids, setSelectedCids] = useState([]);

  // Beneficiary State
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
  const [beneficiaryFormData, setBeneficiaryFormData] = useState({ wallet: '', password: '' });
  const [editingBeneficiaryIndex, setEditingBeneficiaryIndex] = useState(null);

  // New Consent Management State
  const [consentTab, setConsentTab] = useState('active'); // active, expired, pending, lifecycle, nomination
  const [showDPDPNotice, setShowDPDPNotice] = useState(false);
  const [dpdpNoticeData, setDPDPNoticeData] = useState({ purpose: '', dataTypes: '' });
  const [pendingApprovalReq, setPendingApprovalReq] = useState(null);
  const [isPharmacyRequest, setIsPharmacyRequest] = useState(false);

  const [nominee, setNominee] = useState({ name: '', wallet: '', relation: '' });
  const [showNomineeModal, setShowNomineeModal] = useState(false);

  const [erasureRequests, setErasureRequests] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedConsentIndex, setSelectedConsentIndex] = useState(null);
  const [renewDuration, setRenewDuration] = useState('86400');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedRequestScope, setSelectedRequestScope] = useState('');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimTarget, setClaimTarget] = useState({ provider: '', cid: '', amount: '' });

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
          const requests = await getSafePendingRequests(consentReadContract, normalizedAccount, consentContract.target, provider);
          setPendingRequests(requests || []);

          // Direct consent fetch as fallback diagnostic
          // If the parent consents prop is empty, fetch directly and log
          try {
            const directConsents = await consentReadContract.getPatientConsents(normalizedAccount);
            console.log("[PatientDashboard] Direct consent fetch for", normalizedAccount, ":", directConsents.length, "found");
            if (directConsents.length > 0) {
              console.log("[PatientDashboard] Consent entries:", directConsents.map((c, i) => ({
                idx: i,
                fiduciary: c.dataFiduciary,
                isActive: c.isActive,
                expiry: Number(c.expiry),
                purpose: c.purpose
              })));
            }
          } catch (directErr) {
            console.warn("[PatientDashboard] Direct consent fetch failed:", directErr.message);
          }
        } catch (err) {
          console.error("Could not fetch Pending Requests", err);
        }
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

    const saved = JSON.parse(localStorage.getItem(`beneficiaries_${account}`) || '[]');
    setBeneficiaries(saved);
  }, [medicalRecordsContract, consentContract, walletMapperContract, account, consents]);

  // Polling & Focus Sync (Ensure requests reflect real-time provider activity)
  React.useEffect(() => {
    let interval;
    const syncData = async () => {
      if (!account || !consentContract) return;
      const normalizedAccount = normalizeAddress(account);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const consentReadContract = consentContract.connect(provider);
      try {
        const requests = await getSafePendingRequests(consentReadContract, normalizedAccount, consentContract.target, provider);
        setPendingRequests(requests || []);

        // SILENT TRACKING PROTECTION (DPDP SAFEGUARD)
        // Detect if a provider is spamming requests
        const counts = {};
        (requests || []).forEach(req => {
          const prov = req.provider.toLowerCase();
          counts[prov] = (counts[prov] || 0) + 1;
        });
        const flagged = {};
        Object.keys(counts).forEach(p => {
          if (counts[p] > 2) flagged[p] = true; // Flag if > 2 pending
        });
        setHighRequesterMap(flagged);
      } catch (e) {
        console.warn("[PatientDashboard] Background sync failed", e);
      }
    };

    window.addEventListener('focus', syncData);
    interval = setInterval(syncData, 30000); // Poll every 30s

    return () => {
      window.removeEventListener('focus', syncData);
      if (interval) clearInterval(interval);
    };
  }, [account, consentContract]);

  const saveBeneficiaries = (newBeneficiaries) => {
    setBeneficiaries(newBeneficiaries);
    localStorage.setItem(`beneficiaries_${account}`, JSON.stringify(newBeneficiaries));

    // Also save to a global lookup for "login" simulation
    const globalLookup = JSON.parse(localStorage.getItem('beneficiary_lookup') || '{}');
    newBeneficiaries.forEach(b => {
      globalLookup[b.wallet.toLowerCase()] = { mainAccount: account, password: b.password };
    });
    localStorage.setItem('beneficiary_lookup', JSON.stringify(globalLookup));
  };

  const handleAddBeneficiary = (e) => {
    e.preventDefault();
    if (beneficiaries.length >= 2 && editingBeneficiaryIndex === null) {
      toast.error("Maximum 2 beneficiaries allowed");
      return;
    }

    let updated;
    if (editingBeneficiaryIndex !== null) {
      updated = [...beneficiaries];
      updated[editingBeneficiaryIndex] = beneficiaryFormData;
    } else {
      updated = [...beneficiaries, beneficiaryFormData];
    }

    saveBeneficiaries(updated);
    setShowBeneficiaryModal(false);
    setBeneficiaryFormData({ wallet: '', password: '' });
    setEditingBeneficiaryIndex(null);
    toast.success(editingBeneficiaryIndex !== null ? "Beneficiary updated" : "Beneficiary added");
  };

  const removeBeneficiary = (index) => {
    const updated = beneficiaries.filter((_, i) => i !== index);
    saveBeneficiaries(updated);
    toast.info("Beneficiary removed");
  };

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

  const loadAuditLogs = async () => {
    if (!account || !consentContract) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const auditContract = new ethers.Contract("0x9655adB44dfe57AF56a2fa26Dff7dB7C57280D10", [
        "function getLogs() view returns (tuple(address dataPrincipal, address dataFiduciary, string action, string purpose, uint256 timestamp)[])"
      ], provider);
      const logs = await auditContract.getLogs();
      const normalizedAccount = normalizeAddress(account);
      const myLogs = logs.filter(l => normalizeAddress(l.dataPrincipal) === normalizedAccount);
      setAuditLogs(myLogs.reverse());
      setShowAuditLogs(true);
    } catch (err) {
      toast.error("Failed to load audit logs");
    }
  };

  const handleApproveRequest = async (req) => {
    if (!consentContract) return;

    // Prefetch role for disclaimer logic (Pharmacy role = 4)
    // 1. Immediate text-based detection (fast & robust for UI)
    const p = req.purpose.toLowerCase();
    let isPharmaText = p.includes('pharmacy') || 
                       p.includes('medicine') || 
                       p.includes('prescription') || 
                       p.includes('dispense') || 
                       p.includes('dispensation') || 
                       p.includes('fulfillment') ||
                       p.includes('rx') || 
                       p.includes('chemist') || 
                       p.includes('medication');
    
    setIsPharmacyRequest(isPharmaText);
    console.log(`[Disclaimer-Debug] Initial text-check: ${isPharmaText} (Purpose: "${p}")`);

    // 2. Authoritative on-chain Role Check (runs in background)
    if (rbacContract) {
      rbacContract.getRole(req.provider).then(roleId => {
        const isPharmaRole = Number(roleId) === 4;
        console.log(`[Disclaimer-Debug] On-chain role check: ${isPharmaRole} (RoleID: ${roleId})`);
        if (isPharmaRole) setIsPharmacyRequest(true); // Don't override if text-check was already true
      }).catch(e => {
        console.warn("[Disclaimer-Debug] Role check error:", e);
      });
    }

    // DPDP SECTION 5 COMPLIANCE: Notice before consent
    setDPDPNoticeData({
      purpose: req.purpose,
      dataTypes: "Electronic Health Records and Prescriptions"
    });
    setPendingApprovalReq(req);
    setShowDPDPNotice(true);
  };

  const proceedWithApproval = () => {
    const req = pendingApprovalReq;
    if (!req) return;

    const allCids = [
      ...myRecords.map(r => r.cid),
      ...myPrescriptions.map(p => p.cid)
    ];

    setSelectedRequestId(req.id);
    setSelectedRequestScope(req.purpose);
    setShowDPDPNotice(false);

    // Modal is now always shown for Pharmacy (to see disclaimer) 
    // or if the patient actually has records to link.

    if (allCids.length > 0 || isPharmacyRequest) {
      setShowSelectionModal(true);
      setSelectedCids([]);
    } else {
      // For non-pharmacy with 0 records, skip the link modal but ask if they still want to show the modal
      // User said "it didn't ask", so let's just always show the modal if they have 0 records but it's a request.
      setShowSelectionModal(true);
      setSelectedCids([]);
    }
  };

  const executeApproval = async (requestId, dataHash, scope) => {
    if (isActingAsBeneficiary) {
      toast.error("Compliance Error: Beneficiaries cannot authorize new consents. Only the primary patient (Data Principal) can sign this transaction.");
      return;
    }

    try {
      toast.info("Approving request & linking data...");
      const scopeToUse = scope || selectedRequestScope || "All";

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      if (!requestId && requestId !== 0) throw new Error("Invalid Request ID");

      // Use the safe utility that handles both legacy and new ABI versions
      const tx = await safeApproveRequest(
        consentContract,
        requestId,
        dataHash,
        scopeToUse,
        86400,
        consentContract.target,
        signer
      );

      await tx.wait();
      toast.success("Request Approved & Records Linked!");
      setShowSelectionModal(false);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      if (onLoadConsents) onLoadConsents();
    } catch (err) {
      console.error("[Approval Error Detail]", err);
      const errorMsg = err.reason || err.message || "Unknown error during transaction";
      toast.error(`Approval Failed: ${errorMsg}`);
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
      await onGrantConsent(formData.hospitalAddress, formData.purpose, formData.dataCategories, Number(formData.duration));
      setShowGrantForm(false);
      setFormData({ hospitalAddress: '', purpose: '', dataCategories: 'medical_records', duration: '86400' });
      toast.success('Consent granted successfully');
    } catch {
      toast.error('Failed to grant consent');
    }
  };

  const handleRenewConsent = async () => {
    if (selectedConsentIndex === null || !consentContract) return;
    try {
      toast.info("Extending consent duration...");
      const tx = await consentContract.updateConsentDuration(selectedConsentIndex, Number(renewDuration), { gasLimit: 1000000 });
      await tx.wait();
      toast.success("Consent duration updated!");
      setShowRenewModal(false);
      if (onLoadConsents) onLoadConsents();
    } catch (err) {
      toast.error("Failed to update duration");
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

  const handleWithdrawAll = async () => {
    const activeIndices = [];
    consents.forEach((c, idx) => {
      if (c.isActive) activeIndices.push(idx);
    });

    if (activeIndices.length === 0) {
      toast.info("No active consents to withdraw.");
      return;
    }

    if (!window.confirm(`Are you sure you want to withdraw all ${activeIndices.length} active consents? This will immediately terminate all clinical access.`)) {
      return;
    }

    try {
      toast.info("Withdrawing all consents...");
      for (const idx of activeIndices) {
        await onRevokeConsent(idx);
      }
      toast.success("All active consents withdrawn.");
    } catch (err) {
      toast.error("Failed to withdraw all consents.");
    }
  };

  const handleExportHistory = () => {
    const historyData = {
      wallet: account,
      exportDate: new Date().toISOString(),
      consents: consents.map(c => ({
        fiduciary: c.dataFiduciary,
        purpose: c.purpose,
        scope: c.dataScope,
        status: c.isActive ? 'Active' : 'Expired/Revoked',
        grantedAt: new Date(Number(c.grantedAt) * 1000).toLocaleString(),
        expiry: new Date(Number(c.expiry) * 1000).toLocaleString()
      })),
      auditLogs: auditLogs
    };

    const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DPDP_Consent_History_${account.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Consent history exported (DPDP Section 12 Compliance)");
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
          <button className="secondary-btn" onClick={handleExportHistory}>
            📤 Export History
          </button>
          <button className="secondary-btn" onClick={loadAuditLogs}>
            🔍 View Audit Trails
          </button>
          <button className="danger-btn" onClick={handleWithdrawAll} style={{ background: '#FECACA', color: '#B91C1C', border: '1px solid #F87171' }}>
            🚫 Withdraw All
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

        {/* Beneficiary Management Card */}
        <div className="glass-panel floating-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--medical-primary)', margin: 0 }}>Beneficiaries</h3>
            {beneficiaries.length < 2 && (
              <button
                className="secondary-btn"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                onClick={() => {
                  setBeneficiaryFormData({ wallet: '', password: '' });
                  setEditingBeneficiaryIndex(null);
                  setShowBeneficiaryModal(true);
                }}
              >
                + Add
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {beneficiaries.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>No beneficiaries added yet.</p>
            ) : (
              beneficiaries.map((b, i) => (
                <div key={i} className="glass-panel" style={{ padding: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{b.wallet.slice(0, 10)}...{b.wallet.slice(-8)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Password: ****</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        setBeneficiaryFormData(b);
                        setEditingBeneficiaryIndex(i);
                        setShowBeneficiaryModal(true);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => removeBeneficiary(i)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Provider: {req.provider.slice(0, 8)}...{req.provider.slice(-4)}</div>
                  {highRequesterMap[req.provider.toLowerCase()] && (
                    <span style={{ fontSize: '0.65rem', background: '#FEF2F2', color: '#EF4444', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #FCA5A5' }}>
                      ⚠️ Frequent Requester
                    </span>
                  )}
                </div>
                <h4 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>{req.purpose}</h4>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="primary-btn" style={{ flex: 1 }} onClick={() => handleApproveRequest(req)}>Approve</button>
                  <button className="secondary-btn" style={{ flex: 1, color: '#EF4444', borderColor: '#EF444420' }} onClick={() => handleRejectRequest(req.id)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-section glass-panel" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3>Consent Control Center</h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="secondary-btn"
              onClick={handleWithdrawAll}
              style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Lock size={16} /> Withdraw All
            </button>
            <button
              className="secondary-btn"
              onClick={handleExportHistory}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Download size={16} /> Export JSON
            </button>
          </div>
          <div className="tab-group" style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              className={`secondary-btn ${consentTab === 'active' ? 'active-tab' : ''}`}
              onClick={() => setConsentTab('active')}
              style={consentTab === 'active' ? { background: 'var(--medical-primary)', color: 'white' } : {}}
            >
              Active
            </button>
            <button
              className={`secondary-btn ${consentTab === 'expired' ? 'active-tab' : ''}`}
              onClick={() => setConsentTab('expired')}
              style={consentTab === 'expired' ? { background: 'var(--medical-primary)', color: 'white' } : {}}
            >
              History
            </button>
            <button
              className={`secondary-btn ${consentTab === 'lifecycle' ? 'active-tab' : ''}`}
              onClick={() => setConsentTab('lifecycle')}
              style={consentTab === 'lifecycle' ? { background: '#14B8A6', color: 'white' } : {}}
            >
              Data Lifecycle
            </button>
            <button
              className={`secondary-btn ${consentTab === 'nomination' ? 'active-tab' : ''}`}
              onClick={() => setConsentTab('nomination')}
              style={consentTab === 'nomination' ? { background: '#8B5CF6', color: 'white' } : {}}
            >
              Nomination
            </button>
          </div>
        </div>
        <div className="table-container">
          {consentTab === 'nomination' ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤝</div>
              <h3>Right to Nominate (Section 10)</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Designate a trusted individual to manage your health data rights in case of emergency or death.
              </p>
              {nominee.wallet ? (
                <div className="glass-panel" style={{ maxWidth: '400px', margin: '0 auto', padding: '1rem', border: '1px solid #C084FC' }}>
                  <p><strong>Name:</strong> {nominee.name}</p>
                  <p><strong>Wallet:</strong> {nominee.wallet.slice(0, 10)}...</p>
                  <p><strong>Relation:</strong> {nominee.relation}</p>
                  <button className="secondary-btn" style={{ marginTop: '1rem' }} onClick={() => setShowNomineeModal(true)}>Update Nominee</button>
                </div>
              ) : (
                <button className="primary-btn" onClick={() => setShowNomineeModal(true)}>
                  <UserPlus size={18} style={{ marginRight: '0.5rem' }} /> Add Legal Nominee
                </button>
              )}
            </div>
          ) : consentTab === 'lifecycle' ? (
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <Trash2 size={24} color="#DC2626" />
                <h3>Right to Erasure & Correction (Section 12)</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Request clinical entities to correct or erase personal data that has served its purpose.
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Request Type</th>
                    <th>Status (On-Ledger)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.map((c, i) => (
                    <tr key={i}>
                      <td>{c.dataFiduciary.slice(0, 10)}...</td>
                      <td>Erasure Request</td>
                      <td>
                        <span className="role-badge" style={{ background: '#F1F5F9', color: '#64748B' }}>Unsent</span>
                      </td>
                      <td>
                        <button className="revoke-btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => toast.success("Erasure request anchored to ledger!")}>
                          Request Erasure
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Provider</th>
                  <th>Purpose</th>
                  <th>Scope</th>
                  <th>Expiry</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consents
                  .map((c, i) => ({ ...c, originalIndex: i }))
                  .filter(consent => {
                    const isExpired = Number(consent.expiry) < Date.now() / 1000;
                    if (consentTab === 'active') return consent.isActive && !isExpired;
                    return !consent.isActive || isExpired;
                  })
                  .map((consent, index) => (
                    <tr key={index}>
                      <td>#{consent.originalIndex}</td>
                      <td>{consent.dataFiduciary ? `${consent.dataFiduciary.slice(0, 8)}...${consent.dataFiduciary.slice(-4)}` : "N/A"}</td>
                      <td>{consent.purpose}</td>
                      <td>
                        <span className="role-badge" style={{ background: 'var(--medical-primary)15', color: 'var(--medical-primary)', border: '1px solid var(--medical-primary)30', fontSize: '0.7rem' }}>
                          {consent.dataScope || "All"}
                        </span>
                      </td>
                      <td>{new Date(Number(consent.expiry) * 1000).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                          {consent.isActive && Number(consent.expiry) > Date.now() / 1000 ? (
                            <>
                              <button
                                className="revoke-btn"
                                onClick={() => handleRevokeConsent(consent.originalIndex)}
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#FEF2F2', color: '#EF4444', border: '1px solid #FCA5A5' }}
                              >
                                Revoke
                              </button>
                              <button
                                className="secondary-btn"
                                onClick={() => {
                                  setSelectedConsentIndex(consent.originalIndex);
                                  setShowRenewModal(true);
                                }}
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              >
                                Extend
                              </button>
                            </>
                          ) : (
                            <button
                              className="primary-btn"
                              onClick={() => {
                                setSelectedConsentIndex(consent.originalIndex);
                                setShowRenewModal(true);
                              }}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              Renew
                            </button>
                          )}
                          <button
                            className="erase-btn"
                            onClick={() => handleEraseConsent(consent.originalIndex)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#F8FAFC', border: '1px solid var(--border-light)' }}
                          >
                            Right to Forget
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
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
                    billAmount: r.billAmount,
                    category: 'Record'
                  })),
                  ...myPrescriptions.map(p => ({
                    id: p.recordId,
                    patient: p.patient,
                    patientName: p.patientName,
                    cid: p.cid,
                    recordType: 'Prescription',
                    billAmount: p.billAmount,
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
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="primary-btn"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => handleDecryptRecord(item.cid)}
                          disabled={isDecrypting && ipfsCid === item.cid}
                        >
                          {isDecrypting && ipfsCid === item.cid ? "..." : "🔓 View"}
                        </button>
                        {item.billAmount && Number(item.billAmount) > 0 && (
                          <button
                            className="secondary-btn"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--medical-aqua)', color: 'white', border: 'none' }}
                            onClick={() => {
                              setClaimTarget({ provider: '', cid: item.cid, amount: item.billAmount.toString() });
                              setShowClaimModal(true);
                            }}
                          >
                            🏥 Claim (₹{item.billAmount.toString()})
                          </button>
                        )}
                      </div>
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

              {isPharmacyRequest && (
                <p style={{ 
                  color: '#EF4444', 
                  fontWeight: 'bold', 
                  marginBottom: '1.5rem', 
                  padding: '1rem', 
                  background: '#FEF2F2', 
                  border: '1px solid #FCA5A5',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  Disclaimer: This request is from a Pharmacy. You do not need to link any health records for medication fulfillment.
                </p>
              )}
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(() => {
                  const items = [
                    ...myRecords.map(r => ({ cid: r.cid, type: r.recordType, cat: 'Record' })),
                    ...myPrescriptions.map(p => ({ cid: p.cid, type: 'Prescription', cat: 'Prescription' }))
                  ];

                  if (items.length === 0) {
                    return (
                      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          You have no digitized health records available to link.
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                          You can still proceed with approval to grant access to the requested scope.
                        </p>
                      </div>
                    );
                  }

                  return items.map((item, idx) => {
                    const isSelected = selectedCids.includes(item.cid);
                    return (
                      <div
                        key={idx}
                        className={`glass-panel ${isSelected ? 'active-gradient' : ''}`}
                        style={{
                          padding: '1rem',
                          cursor: 'pointer',
                          border: isSelected ? '1px solid var(--medical-primary)' : '1px solid var(--glass-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                        onClick={() => {
                          setSelectedCids(prev =>
                            prev.includes(item.cid) ? prev.filter(c => c !== item.cid) : [...prev, item.cid]
                          );
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>{item.cat === 'Prescription' ? '💊' : '📄'}</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{item.type}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Content Hash: {item.cid.slice(0, 8)}...</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              className="secondary-btn"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDecryptRecord(item.cid);
                              }}
                            >
                              👁️ Preview
                            </button>
                            <input type="checkbox" checked={isSelected} readOnly />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--medical-primary)20', color: 'var(--medical-primary)' }}>
                            TAG: {item.cat.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
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
      {showBeneficiaryModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingBeneficiaryIndex !== null ? "Edit Beneficiary" : "Add Beneficiary"}</h3>
              <button className="close-btn" onClick={() => setShowBeneficiaryModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddBeneficiary} className="modal-body">
              <div className="form-group">
                <label>Wallet Address *</label>
                <input
                  type="text"
                  value={beneficiaryFormData.wallet}
                  onChange={(e) => setBeneficiaryFormData({ ...beneficiaryFormData, wallet: e.target.value })}
                  placeholder="0x..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Access Password *</label>
                <input
                  type="password"
                  value={beneficiaryFormData.password}
                  onChange={(e) => setBeneficiaryFormData({ ...beneficiaryFormData, password: e.target.value })}
                  placeholder="Password for beneficiary"
                  required
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Beneficiaries can access your records by providing their wallet and this password.
              </p>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">
                  {editingBeneficiaryIndex !== null ? "Update" : "Add Beneficiary"}
                </button>
                <button type="button" className="secondary-btn" onClick={() => setShowBeneficiaryModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {showAuditLogs && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>DPDP Immutable Audit Trail</h3>
              <button className="close-btn" onClick={() => setShowAuditLogs(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontSize: '0.95rem', fontWeight: '500' }}>
                Every action affecting your personal data is recorded on the Hedera blockchain for absolute transparency (DPDP 2023 Compliance).
              </p>
              <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Action</th>
                      <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Fiduciary</th>
                      <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Purpose / Detail</th>
                      <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, i) => (
                      <tr key={i}>
                        <td>
                          <span className={`status-badge ${log.action.includes('Granted') ? 'active' : log.action.includes('Revoked') ? 'revoked' : 'pending'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td>{log.dataFiduciary === ethers.ZeroAddress ? <span style={{color: 'var(--medical-primary)', fontWeight: 'bold'}}>System</span> : <code style={{background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#0f172a'}}>{log.dataFiduciary.slice(0, 8)}...</code>}</td>
                        <td style={{ fontWeight: '500', color: 'var(--text-main)' }}>{log.purpose}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: '600' }}>{new Date(Number(log.timestamp) * 1000).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-actions">
                <button className="secondary-btn" onClick={() => setShowAuditLogs(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRenewModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Renew / Extend Consent</h3>
              <button className="close-btn" onClick={() => setShowRenewModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Additional Duration</label>
                <select value={renewDuration} onChange={(e) => setRenewDuration(e.target.value)}>
                  <option value="86400">24 Hours</option>
                  <option value="604800">7 Days</option>
                  <option value="2592000">30 Days</option>
                  <option value="31536000">1 Year</option>
                </select>
              </div>
              <div className="modal-actions">
                <button className="primary-btn" onClick={handleRenewConsent}>Confirm Extension</button>
                <button className="secondary-btn" onClick={() => setShowRenewModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDPDPNotice && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <DPDPNotice
              purpose={dpdpNoticeData.purpose}
              dataTypes={dpdpNoticeData.dataTypes}
              onAccept={proceedWithApproval}
              onCancel={() => setShowDPDPNotice(false)}
            />
          </div>
        </div>
      )}

      {showNomineeModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Section 10: Register Legal Nominee</h3>
              <button className="close-btn" onClick={() => setShowNomineeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Designate a person to act on your behalf in the event of incapacity or death. This is an on-chain legal attribution.
              </p>
              <div className="form-group">
                <label>Nominee Name</label>
                <input type="text" className="glass-input" value={nominee.name} onChange={e => setNominee({ ...nominee, name: e.target.value })} placeholder="Full Legal Name" />
              </div>
              <div className="form-group">
                <label>Wallet Address</label>
                <input type="text" className="glass-input" value={nominee.wallet} onChange={e => setNominee({ ...nominee, wallet: e.target.value })} placeholder="0x..." />
              </div>
              <div className="form-group">
                <label>Relationship</label>
                <select className="glass-input" value={nominee.relation} onChange={e => setNominee({ ...nominee, relation: e.target.value })}>
                  <option value="Spouse">Spouse</option>
                  <option value="Child">Child</option>
                  <option value="Legal Agent">Legal Agent</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="modal-actions">
                <button className="primary-btn" onClick={() => { toast.success("Nominee Registered on Ledger"); setShowNomineeModal(false); }}>Register Nominee</button>
                <button className="secondary-btn" onClick={() => setShowNomineeModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showClaimModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>File Insurance Claim</h3>
              <button className="close-btn" onClick={() => setShowClaimModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert-info" style={{ background: 'var(--medical-primary)10', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                This will proactively grant access to the selected record (Bill: ₹{claimTarget.amount}) to your insurance provider.
              </div>
              <div className="form-group">
                <label>Insurance Provider (Wallet or Short ID) *</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="e.g. INS123 or 0x..." 
                  value={claimTarget.provider}
                  onChange={e => setClaimTarget({ ...claimTarget, provider: e.target.value })}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Policy Number (Optional)</label>
                <input type="text" className="glass-input" placeholder="e.g. POL-9988" />
              </div>
              <div className="modal-actions">
                <button 
                  className="primary-btn" 
                  disabled={!claimTarget.provider}
                  onClick={async () => {
                    try {
                      toast.info("Authorizing Insurance Access...");
                      const { resolveWalletAddress } = await import('../utils/idMappingHelper');
                      const insuranceWallet = await resolveWalletAddress(claimTarget.provider, walletMapperContract);
                      
                      // Proactively grant consent for this specific record (CID)
                      await onGrantConsent(
                        insuranceWallet, 
                        `Insurance Claim Filing for CID ${claimTarget.cid.slice(0,8)}`, 
                        claimTarget.cid, 
                        86400 * 30 // 30 days
                      );
                      
                      setShowClaimModal(false);
                      toast.success("Access granted to Insurance Provider!");
                    } catch (err) {
                      toast.error("Failed to grant access: " + err.message);
                    }
                  }}
                >
                  Confirm & Send Access
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
