import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { encryptData, uploadToPinata, fetchFromPinata, decryptData } from '../utils/ipfsHelper';
import { resolveWalletAddress } from '../utils/idMappingHelper';
import { getSafePatientConsents } from '../utils/consentHelper';

const labTestRegistry = {
  "Blood Tests": [
    "Complete Blood Count (CBC)", "Hemoglobin", "Hematocrit", "Red Blood Cell Count",
    "White Blood Cell Count", "Platelet Count", "Mean Corpuscular Volume (MCV)",
    "Mean Corpuscular Hemoglobin (MCH)", "Mean Corpuscular Hemoglobin Concentration (MCHC)",
    "Red Cell Distribution Width (RDW)"
  ],
  "Metabolic Panel": [
    "Basic Metabolic Panel (BMP)", "Comprehensive Metabolic Panel (CMP)", "Blood Glucose",
    "Blood Urea Nitrogen (BUN)", "Creatinine", "Electrolytes Panel", "Sodium", "Potassium",
    "Chloride", "Bicarbonate", "Calcium", "Magnesium", "Phosphate"
  ],
  "Lipid Profile": [
    "Total Cholesterol", "HDL Cholesterol", "LDL Cholesterol", "Triglycerides", "VLDL", "Non-HDL Cholesterol"
  ],
  "Liver Function Tests": [
    "ALT (Alanine Aminotransferase)", "AST (Aspartate Aminotransferase)", "ALP (Alkaline Phosphatase)",
    "Bilirubin Total", "Bilirubin Direct", "Albumin", "Total Protein", "Gamma GT"
  ],
  "Kidney Function Tests": [
    "Creatinine", "Urea", "Glomerular Filtration Rate (GFR)", "Uric Acid"
  ],
  "Coagulation Tests": [
    "Prothrombin Time (PT)", "INR", "Activated Partial Hover Time (aPTT)", "D-Dimer", "Fibrinogen"
  ],
  "Urine Tests": [
    "Urinalysis", "Urine Culture", "Urine Protein", "Urine Creatinine", "Urine Glucose",
    "Urine Ketones", "Urine Microscopy", "Urine Pregnancy Test"
  ],
  "Microbiology Tests": [
    "Blood Culture", "Urine Culture", "Sputum Culture", "Stool Culture", "Throat Swab Culture",
    "COVID-19 PCR", "Influenza PCR", "HIV Test", "Hepatitis B Test", "Hepatitis C Test",
    "Tuberculosis Test", "Malaria Test", "Dengue Test", "Typhoid Test"
  ],
  "Imaging / Radiology": [
    "X-Ray", "CT Scan", "MRI Scan", "Ultrasound", "PET Scan", "Mammography",
    "Bone Density Scan", "Angiography", "Fluoroscopy"
  ],
  "Pathology / Biopsy": [
    "Biopsy Report", "Histopathology", "Cytology", "Pap Smear", "Tumor Marker Test"
  ],
  "Genetic Tests": [
    "DNA Sequencing", "BRCA Genetic Test", "Carrier Screening", "Prenatal Genetic Testing", "Pharmacogenomics Testing"
  ],
  "Cardiology Tests": [
    "ECG / EKG", "Echocardiogram", "Holter Monitor Test", "Stress Test", "Cardiac Enzyme Test", "Troponin Test", "BNP Test"
  ],
  "Endocrinology Tests": [
    "Thyroid Panel", "TSH", "T3", "T4", "HbA1c", "Insulin Test", "Cortisol Test", "Growth Hormone Test", "Vitamin D Test", "Vitamin B12 Test"
  ],
  "Toxicology Tests": [
    "Drug Screening", "Alcohol Level Test", "Heavy Metal Test", "Lead Test", "Arsenic Test", "Mercury Test"
  ],
  "Allergy & Immunology": [
    "Allergy Panel", "IgE Test", "Autoimmune Panel", "ANA Test", "CRP Test", "ESR Test", "Rheumatoid Factor"
  ]
};

const LabDashboard = ({
  account,
  onRequestConsent,
  onAccessPatientData,
  medicalRecordsContract,
  walletMapperContract,
  consentContract,
  auditLogContract
}) => {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData] = useState({
    patientAddress: '',
    category: '',
    testType: '',
    reportData: '',
    sensitivity: 'Medium',
    authorizedDoctor: '',
    billAmount: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

  // Org Registration State
  const [showOrgRegForm, setShowOrgRegForm] = useState(false);
  const [reqOrgName, setReqOrgName] = useState("");
  const [reqWallet, setReqWallet] = useState("");
  const [reqRole, setReqRole] = useState("2");

  const [recentReports, setRecentReports] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestData, setRequestData] = useState({ patientWallet: '', purpose: '', requesterName: '', scope: 'Lab Reports' });
  const [viewDataSettings, setViewDataSettings] = useState({ scope: 'Lab Reports', purpose: 'Diagnostic Review' });
  const [scannedPatient, setScannedPatient] = useState('');


  React.useEffect(() => {
    const loadHistory = async () => {
      if (!auditLogContract || !account) return;
      try {
        const hapi = hapiProvider || new ethers.BrowserProvider(window.ethereum);
        const readAudit = auditLogContract.connect(hapi);
        let logs = [];
        try {
          logs = await readAudit.getLogs();
        } catch (logErr) {
          console.warn("LabDashboard: getLogs() failed, falling back to Event Filtering...");
          // Fallback: Query events from the last 10,000 blocks
          const filter = readAudit.filters.DataAccessed(null, account);
          const events = await readAudit.queryFilter(filter, -10000);
            logs = events.map(ev => ({
              dataPrincipal: ev?.args?.[0],
              dataFiduciary: ev?.args?.[1],
              action: "Data Accessed",
              purpose: ev?.args?.[2],
              timestamp: ev?.args?.[3]
            }));
        }

        const normalizedLab = account.toLowerCase();
        const uniquePatients = new Set();
        logs.forEach(log => {
          if (log.dataFiduciary.toLowerCase() === normalizedLab) {
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
      } catch (err) {
        console.error("Failed to fetch lab history:", err);
      }
    };
    loadHistory();
  }, [auditLogContract, account]);

  React.useEffect(() => {
    if (interactionHistory.length > 0) {
      syncLabActivity();
    }
  }, [interactionHistory]);

  const syncLabActivity = async () => {
    if (!consentContract || !medicalRecordsContract || interactionHistory.length === 0) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const readMedical = medicalRecordsContract.connect(provider);
      const allReports = [];

      for (const item of interactionHistory) {
        const records = await readMedical.getPatientRecords(item.wallet);
        records.forEach(r => {
            if (r.provider?.toLowerCase() === account?.toLowerCase()) {
              allReports.push({
                id: r?.id?.toString() || Math.random().toString(),
                patient: item.wallet,
                shortId: item.shortId,
                type: r.recordType,
                category: "Lab Report",
                date: "On-Chain",
                status: 'Completed',
                cid: r.cid
              });
            }
        });
      }
      setRecentReports(allReports);
    } catch (err) {
      console.error("Lab sync failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadReport = async (e) => {
    e.preventDefault();
    if (!uploadData.patientAddress || !uploadData.category || !uploadData.testType || !uploadData.reportData || !uploadData.authorizedDoctor) {
      toast.error('Please fill all required fields, including Authorized Doctor Name');
      return;
    }

    let targetWallet = uploadData.patientAddress;
    try {
      targetWallet = await resolveWalletAddress(uploadData.patientAddress, walletMapperContract);
    } catch (e) {
      toast.error(e.message);
      return;
    }

    try {
      let fileDataBase64 = null;
      if (selectedFile) {
        toast.info("Reading file content...");
        fileDataBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      }

      toast.info("Encrypting sensitive health data...");
      const encryptedPayload = encryptData({
        patientRef: targetWallet,
        category: uploadData.category,
        testType: uploadData.testType,
        clinicalData: `[Authorized Doctor: ${uploadData.authorizedDoctor}]\n\n${uploadData.reportData}`,
        sensitivity: uploadData.sensitivity, // TAGGING
        fileData: fileDataBase64,
        fileName: selectedFile ? selectedFile.name : null,
        timestamp: new Date().toISOString()
      });

      toast.info("Uploading cipher text to IPFS network...");
      const ipfsCid = await uploadToPinata(encryptedPayload, `${uploadData.testType} - ${uploadData.patientAddress?.slice(0, 6) || 'Unknown'}`);

      toast.info("Mapping Record to Wallet On-Chain...");
      if (medicalRecordsContract) {
        const billAmountNum = uploadData.billAmount ? BigInt(uploadData.billAmount) : 0n;
        const tx = await medicalRecordsContract.addRecord(targetWallet, ipfsCid, uploadData.testType, billAmountNum, { gasLimit: 1000000 });
        await tx.wait();
      } else {
        toast.warning("MedicalRecords mapping failed: Contract unreachable.");
      }

      setRecentReports(prev => [
        { id: prev.length + 1, patient: targetWallet, type: uploadData.testType, category: uploadData.category, date: new Date().toISOString().split('T')[0], status: 'Completed', cid: ipfsCid },
        ...prev
      ]);

      setShowUploadForm(false);
      setUploadData({ patientAddress: '', category: '', testType: '', reportData: '', sensitivity: 'Medium', authorizedDoctor: '' });
      setSelectedFile(null);
      toast.success(`Securely Mapped On-Chain! CID: ${ipfsCid?.slice(0, 8) || 'N/A'}...`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to encrypt and anchor report on-chain');
    }
  };

  const handleRequestConsent = async (e) => {
    e.preventDefault();
    if (!requestData.requesterName) {
      toast.error("Please provide a Requester Name");
      return;
    }
    const fullPurpose = `[${requestData.requesterName}] ${requestData.purpose}`;
    try {
      await onRequestConsent(requestData.patientWallet, fullPurpose);
      setShowRequestModal(false);
      setRequestData({ ...requestData, purpose: '', requesterName: '' });
    } catch { toast.error("Request failed"); }
  };

  const fetchAuthorizedRecords = async (targetWallet) => {
    setLoading(true);
    try {
      if (medicalRecordsContract && consentContract) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const readMedical = medicalRecordsContract.connect(provider);
        const readConsent = consentContract.connect(provider);

        const records = await readMedical.getPatientRecords(targetWallet);
        const formatted = (records || []).map(r => ({
          id: r?.id?.toString() || Math.random().toString(),
          type: r.recordType,
          status: "Authorized",
          cid: r.cid,
          provider: r.provider,
          patient: targetWallet
        }));

        setActiveConsents(formatted);
      } else {
        toast.error("Contracts not loaded");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch records. Patient may not have granted access.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccessPatientData = async () => {
    if (!requestData.patientWallet) {
      toast.error("Please enter a patient wallet");
      return;
    }
    setLoading(true);
    let targetWallet = requestData.patientWallet;
    try {
      targetWallet = await resolveWalletAddress(requestData.patientWallet, walletMapperContract);
    } catch (e) {
      toast.error(e.message);
      setLoading(false);
      return;
    }

    try {
      // First, trigger access log on-chain
      const success = await onAccessPatientData(targetWallet, viewDataSettings.scope, viewDataSettings.purpose);
      if (success) {
        setScannedPatient(targetWallet);
        toast.success("Identity verified, mapping records...");
        await fetchAuthorizedRecords(targetWallet);
        syncLabActivity();
      }
    } catch { toast.error("Access denied"); }
    finally { setLoading(false); }
  };

  const handleDecryptRecord = async (targetCid = null, patientMeta = null) => {
    const cidToUse = targetCid || ipfsCid;
    if (!cidToUse) {
      toast.error("Please provide a valid IPFS CID");
      return;
    }
    try {
      setIsDecrypting(true);
      setDecryptedRecord(null);
      toast.info("Fetching encrypted payload from IPFS nodes...");

      const cipherText = await fetchFromPinata(cidToUse);
      toast.info("Decrypting ciphertext with local key...");
      await new Promise(r => setTimeout(r, 600));

      const rawData = decryptData(cipherText);
      setDecryptedRecord({
        ...rawData,
        patientWallet: patientMeta?.wallet || scannedPatient || "Unknown"
      });
      toast.success("Data successfully decrypted!");

      if (auditLogContract && scannedPatient && ethers.isAddress(scannedPatient)) {
        const nowSecs = Math.floor(Date.now() / 1000);
        await auditLogContract.logDataAccessed(scannedPatient, account, "IPFS Record Decryption", nowSecs, { gasLimit: 1000000 });
      }
    } catch (error) {
      toast.error(error.message || "Failed to decrypt record.");
      setDecryptedRecord(null);
    } finally {
      setIsDecrypting(false);
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
    { title: 'Total Anchored Reports', value: recentReports.length, icon: '📜', color: 'var(--medical-primary)' },
    { title: 'Verified Test Subjects', value: interactionHistory.length, icon: '👥', color: 'var(--medical-secondary)' },
    { title: 'High Sensitivity Data', value: recentReports.filter(r => r.type?.toLowerCase().includes('genetic') || r.type?.toLowerCase().includes('hiv')).length, icon: '🛡️', color: 'var(--status-rejected)' }
  ];


  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--medical-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Diagnostic Laboratory Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Secure diagnostic data management and blockchain-anchored reports.</p>
        </div>
        <div className="dashboard-actions">
          {/* <button className="secondary-btn" onClick={() => {
            setReqWallet(account);
            setShowOrgRegForm(true);
          }}>
            Register Organisation
          </button> */}
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

      <div className="dashboard-section glass-panel">
        <h3>Recent Lab Reports</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Patient</th>
                <th>Report Type</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!recentReports || recentReports.length === 0) ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No recent lab reports found.</td>
                </tr>
              ) : (
                recentReports.map((report) => (
                  <tr key={report?.id || Math.random()}>
                    <td><code title={report?.cid || 'N/A'} style={{ cursor: 'pointer', color: 'var(--medical-primary)' }}>{report?.cid?.slice(0, 12) || 'N/A'}...</code></td>
                    <td>{report?.patient?.slice(0, 8) || 'N/A'}...</td>
                    <td>{report?.type || 'Record'}</td>
                    <td>{report?.date === "On-Chain" ? "⛓️ Immutable" : report?.date || 'N/A'}</td>
                    <td>
                      <span className={`status-badge active`}>
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-section glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3>Patient Record Retrieval</h3>
          <button className="primary-btn" onClick={() => setShowUploadForm(true)}>+ New Report</button>
        </div>

        <div className="floating-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Patient Wallet / ID</label>
              <input
                className="glass-input"
                placeholder="0x... or Patient ID"
                value={requestData.patientWallet}
                onChange={(e) => setRequestData({ ...requestData, patientWallet: e.target.value })}
              />
            </div>
            <button className="secondary-btn" onClick={handleAccessPatientData} style={{ height: '45px' }}>Verify & Fetch</button>
          </div>

          {scannedPatient && (
            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem' }}>Data Scope</label>
                <select className="glass-input" value={viewDataSettings.scope} onChange={(e) => setViewDataSettings({ ...viewDataSettings, scope: e.target.value })}>
                  <option value="Lab Reports">Lab Reports Only</option>
                  <option value="All">All Health Data</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem' }}>Purpose</label>
                <input className="glass-input" value={viewDataSettings.purpose} onChange={(e) => setViewDataSettings({ ...viewDataSettings, purpose: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-section glass-panel" style={{ borderLeft: '6px solid var(--medical-accent)' }}>
        <h3>IPFS Decryption Engine</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Fetch patient data requested after consent is verified.
        </p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            className="glass-input"
            placeholder="Enter IPFS CID (e.g., Qm...)"
            value={ipfsCid}
            onChange={(e) => setIpfsCid(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="primary-btn" onClick={() => handleDecryptRecord()} disabled={isDecrypting}>
            {isDecrypting ? "Decrypting..." : "Fetch & Decrypt"}
          </button>
        </div>

        {decryptedRecord && (
          <div className="floating-card" style={{ marginTop: '2rem', borderColor: 'var(--medical-primary)' }}>
            <h4 style={{ color: 'var(--medical-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span>🔓</span> Decrypted Health Record
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1.5rem', fontSize: '0.95rem' }}>
              <strong style={{ color: 'var(--text-muted)' }}>Patient ID:</strong> <span style={{ color: 'var(--medical-primary)', fontWeight: 'bold' }}>{decryptedRecord.patientWallet}</span>
              <strong style={{ color: 'var(--text-muted)' }}>Record Type:</strong> <span>{decryptedRecord.type}</span>
              <strong style={{ color: 'var(--text-muted)' }}>Clinical Data:</strong> <span style={{ lineHeight: '1.6' }}>{decryptedRecord.clinicalData}</span>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-section glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3>Authorized Health Records</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Patient medical history authorized for your view.</p>
          </div>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record Type</th>
                <th>Status</th>
                <th>IPFS Hash</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeConsents.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}>No records fetched or patient missing consent. Use the Access block above.</td></tr>
              ) : (
                (activeConsents || []).map(c => (
                  <tr key={c?.id || Math.random()}>
                    <td>{c?.type || 'Record'}</td>
                    <td><span className="status-badge active">{c?.status || 'Active'}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-secondary)' }}>{c?.cid?.slice(0, 12) || 'N/A'}...</td>
                    <td>
                      <button className="secondary-btn" onClick={() => {
                        setIpfsCid(c.cid);
                        handleDecryptRecord(c.cid, { wallet: c.patient });
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                      }}>
                        Decrypt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showUploadForm && (
        <div className="modal-overlay">
          <div className="glass-panel modal" style={{ maxWidth: '650px', width: '95%', padding: '2.5rem' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
              <h2 style={{ color: 'var(--medical-primary)', fontWeight: '800' }}>📤 Secure Report Anchorage</h2>
              <button className="close-btn" onClick={() => setShowUploadForm(false)}>×</button>
            </div>
            <form onSubmit={handleUploadReport}>
              <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group">
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient ID / Wallet</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={uploadData.patientAddress}
                    onChange={(e) => setUploadData({ ...uploadData, patientAddress: e.target.value })}
                    placeholder="0x... or Short ID"
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Sensitivity</label>
                  <select className="glass-input" value={uploadData.sensitivity} onChange={e => setUploadData({ ...uploadData, sensitivity: e.target.value })}>
                    <option value="Low">🟢 Low (Routine)</option>
                    <option value="Medium">🟡 Medium (Specialized)</option>
                    <option value="High">🔴 High (Genetic/Sensitive)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Authorized Doctor Name</label>
                <input
                  type="text"
                  className="glass-input"
                  value={uploadData.authorizedDoctor}
                  onChange={(e) => setUploadData({ ...uploadData, authorizedDoctor: e.target.value })}
                  placeholder="e.g. Dr. John Doe"
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bill Amount / Service Fee (HBAR)</label>
                <input
                  type="number"
                  className="glass-input"
                  value={uploadData.billAmount}
                  onChange={(e) => setUploadData({ ...uploadData, billAmount: e.target.value })}
                  placeholder="Enter fee amount (e.g. 500)"
                />
              </div>

              <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registry Category</label>
                  <select
                    className="glass-input"
                    value={uploadData.category}
                    onChange={(e) => setUploadData({ ...uploadData, category: e.target.value, testType: '' })}
                    required
                  >
                    <option value="">Select category...</option>
                    {Object.keys(labTestRegistry).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnostic Test Type</label>
                  <select
                    className="glass-input"
                    value={uploadData.testType}
                    onChange={(e) => setUploadData({ ...uploadData, testType: e.target.value })}
                    required
                    disabled={!uploadData.category}
                  >
                    <option value="">Select test type...</option>
                    {uploadData.category && labTestRegistry[uploadData.category].map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Summary & Findings</label>
                <textarea
                  className="glass-input"
                  value={uploadData.reportData}
                  onChange={(e) => setUploadData({ ...uploadData, reportData: e.target.value })}
                  placeholder="Enter structured diagnostic findings..."
                  rows="4"
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supporting Documentation</label>
                <div
                  className="floating-card"
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    border: '2px dashed var(--glass-border)',
                    background: 'rgba(255,255,255,0.02)',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="file"
                    accept=".pdf,.jpg,.png,.doc,.docx"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {selectedFile ? <span style={{ color: 'var(--medical-primary)', fontWeight: '700' }}>{selectedFile.name}</span> : "Click or drag to upload report document (PDF, JPG, DOC)"}
                  </p>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '2.5rem' }}>
                <button type="submit" className="primary-btn" disabled={loading} style={{ flex: 2 }}>
                  {loading ? "Anchoring on Chain..." : "🔒 Finalize & Anchor Report"}
                </button>
                <button type="button" className="secondary-btn" onClick={() => setShowUploadForm(false)} style={{ flex: 1 }}>
                  Abort
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingReport && (
        <div className="modal-overlay">
          <div className="glass-panel modal" style={{ maxWidth: '600px', width: '90%', padding: '2.5rem' }}>
            <div className="modal-header">
              <h3>On-Chain Report Metadata</h3>
              <button className="close-btn" onClick={() => setViewingReport(null)}>×</button>
            </div>
            <div className="floating-card" style={{ background: 'rgba(255,255,255,0.05)', marginTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>IPFS Content Identifier (CID)</span>
                  <p style={{ margin: '0.5rem 0', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--medical-primary)', wordBreak: 'break-all' }}>{viewingReport.cid}</p>
                </div>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient Mapping</span>
                  <p style={{ margin: '0.5rem 0', fontFamily: 'monospace', fontSize: '1rem' }}>{viewingReport.patient}</p>
                </div>
                <div style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Test Classification</span>
                  <p style={{ margin: '0.5rem 0', fontSize: '1.1rem', fontWeight: '700' }}>{viewingReport.type}</p>
                </div>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '2rem' }}>
              <button className="primary-btn" style={{ width: '100%' }} onClick={() => setViewingReport(null)}>Close View</button>
            </div>
          </div>
        </div>
      )}

      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Request Diagnostic Access</h3>
              <button className="close-btn" onClick={() => setShowRequestModal(false)}>×</button>
            </div>
            <form onSubmit={handleRequestConsent} className="modal-body">
              <div className="form-group">
                <label>Patient Address / ID *</label>
                <input
                  type="text"
                  value={requestData.patientWallet}
                  onChange={(e) => setRequestData({ ...requestData, patientWallet: e.target.value })}
                  placeholder="0x... or Short ID"
                  required
                />
              </div>
              <div className="form-group">
                <label>Requester Name / Lab ID *</label>
                <input
                  type="text"
                  value={requestData.requesterName}
                  onChange={(e) => setRequestData({ ...requestData, requesterName: e.target.value })}
                  placeholder="e.g. City Diagnostic Center"
                  required
                />
              </div>
              <div className="form-group">
                <label>Purpose of Access *</label>
                <input
                  type="text"
                  value={requestData.purpose}
                  onChange={(e) => setRequestData({ ...requestData, purpose: e.target.value })}
                  placeholder="e.g., Blood Panel Analysis"
                  required
                />
              </div>
              <div className="form-group">
                <label>Requested Scope</label>
                <select value={requestData.scope} disabled>
                  <option value="Lab Reports">Lab Reports Only</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Send Request</button>
                <button type="button" className="secondary-btn" onClick={() => setShowRequestModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOrgRegForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Register Organisation</h3>
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
    </div>
  );
};

export default LabDashboard;
