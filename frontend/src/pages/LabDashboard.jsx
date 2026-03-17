import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { encryptData, uploadToPinata } from '../utils/ipfsHelper';
import { resolveWalletAddress } from '../utils/idMappingHelper';

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
    sensitivity: 'Medium'
  });
  const [selectedFile, setSelectedFile] = useState(null);

  // Org Registration State
  const [showOrgRegForm, setShowOrgRegForm] = useState(false);
  const [reqOrgName, setReqOrgName] = useState("");
  const [reqWallet, setReqWallet] = useState("");
  const [reqRole, setReqRole] = useState("2");

  const [recentReports, setRecentReports] = useState([]);

  // Consent & Access State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestData, setRequestData] = useState({ patientWallet: '', purpose: '', scope: 'Lab Reports' });
  const [viewDataSettings, setViewDataSettings] = useState({ scope: 'Lab Reports', purpose: 'Diagnostic Review' });
  const [scannedPatient, setScannedPatient] = useState('');
  const [interactionHistory, setInteractionHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const loadHistory = async () => {
      if (!auditLogContract || !account) return;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const readAudit = auditLogContract.connect(provider);
        const logs = await readAudit.getLogs();

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
          if (r.provider.toLowerCase() === account.toLowerCase()) {
            allReports.push({
              id: r.id.toString(),
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
    if (!uploadData.patientAddress || !uploadData.category || !uploadData.testType || !uploadData.reportData) {
      toast.error('Please fill all required fields');
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
        clinicalData: uploadData.reportData,
        sensitivity: uploadData.sensitivity, // TAGGING
        fileData: fileDataBase64,
        fileName: selectedFile ? selectedFile.name : null,
        timestamp: new Date().toISOString()
      });

      toast.info("Uploading cipher text to IPFS network...");
      const ipfsCid = await uploadToPinata(encryptedPayload, `${uploadData.testType} - ${uploadData.patientAddress.slice(0, 6)}`);

      toast.info("Mapping Record to Wallet On-Chain...");
      if (medicalRecordsContract) {
        const tx = await medicalRecordsContract.addRecord(targetWallet, ipfsCid, uploadData.testType, { gasLimit: 1000000 });
        await tx.wait();
      } else {
        toast.warning("MedicalRecords mapping failed: Contract unreachable.");
      }

      setRecentReports(prev => [
        { id: prev.length + 1, patient: targetWallet, type: uploadData.testType, category: uploadData.category, date: new Date().toISOString().split('T')[0], status: 'Completed', cid: ipfsCid },
        ...prev
      ]);

      setShowUploadForm(false);
      setUploadData({ patientAddress: '', category: '', testType: '', reportData: '', sensitivity: 'Medium' });
      setSelectedFile(null);
      toast.success(`Securely Mapped On-Chain! CID: ${ipfsCid.slice(0, 8)}...`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to encrypt and anchor report on-chain');
    }
  };

  const handleRequestConsent = async (e) => {
    e.preventDefault();
    try {
      await onRequestConsent(requestData.patientWallet, requestData.purpose);
      setShowRequestModal(false);
    } catch { toast.error("Request failed"); }
  };

  const handleAccessPatientData = async () => {
    if (!requestData.patientWallet) {
      toast.error("Please enter a patient wallet");
      return;
    }
    try {
      const success = await onAccessPatientData(requestData.patientWallet, viewDataSettings.scope, viewDataSettings.purpose);
      if (success) {
        setScannedPatient(requestData.patientWallet);
        toast.success("Authorized records fetched");
        syncLabActivity();
      }
    } catch { toast.error("Access denied"); }
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
    { title: 'Uploaded Reports', value: 0, icon: '📤', color: 'var(--status-approved)' },
    { title: 'Authorized Records', value: 0, icon: '🔐', color: 'var(--status-info)' },
    { title: 'Pending Uploads', value: 0, icon: '⏳', color: 'var(--status-pending)' },
    { title: 'Access History', value: 0, icon: '🔍', color: 'var(--medical-secondary)' }
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
          <button
            className="primary-btn"
            onClick={() => setShowRequestModal(true)}
          >
            Request Lab Access
          </button>
          <button
            className="secondary-btn"
            onClick={() => setShowOrgRegForm(true)}
          >
            Other Org Registration
          </button>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No recent lab reports found.</td>
                </tr>
              ) : (
                recentReports.map((report) => (
                  <tr key={report.id}>
                    <td><code title={report.cid} style={{ cursor: 'pointer', color: 'var(--medical-primary)' }}>{report.cid.slice(0, 12)}...</code></td>
                    <td>{report.patient.slice(0, 8)}...</td>
                    <td>{report.type}</td>
                    <td>{report.date}</td>
                    <td>
                      <span className={`status-badge active`}>
                        {report.status}
                      </span>
                    </td>
                    <td>
                      <button className="secondary-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>View</button>
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

      {showUploadForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Upload Lab Report</h3>
              <button className="close-btn" onClick={() => setShowUploadForm(false)}>×</button>
            </div>
            <form onSubmit={handleUploadReport} className="modal-body">
              <div className="form-group">
                <label>Patient Address *</label>
                <input
                  type="text"
                  value={uploadData.patientAddress}
                  onChange={(e) => setUploadData({ ...uploadData, patientAddress: e.target.value })}
                  placeholder="0x..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Test Category *</label>
                <select
                  value={uploadData.category}
                  onChange={(e) => setUploadData({ ...uploadData, category: e.target.value, testType: '' })}
                  required
                >
                  <option value="">Select category</option>
                  {Object.keys(labTestRegistry).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Test Type *</label>
                <select
                  value={uploadData.testType}
                  onChange={(e) => setUploadData({ ...uploadData, testType: e.target.value })}
                  required
                  disabled={!uploadData.category}
                >
                  <option value="">Select test type</option>
                  {uploadData.category && labTestRegistry[uploadData.category].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Report Data *</label>
                <textarea
                  value={uploadData.reportData}
                  onChange={(e) => setUploadData({ ...uploadData, reportData: e.target.value })}
                  placeholder="Enter report details or upload file..."
                  rows="4"
                  required
                />
              </div>
              <div className="form-group">
                <label>Data Sensitivity (DPDP Rating) *</label>
                <select className="glass-input" value={uploadData.sensitivity} onChange={e => setUploadData({ ...uploadData, sensitivity: e.target.value })}>
                  <option value="Low">Low (Routine Results)</option>
                  <option value="Medium">Medium (Specialized Labs)</option>
                  <option value="High">High (Genetic, HIV, Sensitive)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Upload File</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.png,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
                {selectedFile && <span style={{ fontSize: '0.8rem', color: 'var(--status-approved)' }}>{selectedFile.name} selected</span>}
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Upload Report</button>
                <button type="button" className="secondary-btn" onClick={() => setShowUploadForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
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
