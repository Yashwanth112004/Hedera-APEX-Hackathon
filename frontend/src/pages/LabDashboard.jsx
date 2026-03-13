import React, { useState } from 'react';
import { toast } from 'react-toastify';
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

const LabDashboard = ({ medicalRecordsContract, walletMapperContract }) => {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData] = useState({
    patientAddress: '',
    category: '',
    testType: '',
    reportData: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

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
        type: uploadData.testType,
        clinicalData: uploadData.reportData,
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
      setUploadData({ patientAddress: '', category: '', testType: '', reportData: '' });
      setSelectedFile(null);
      toast.success(`Securely Mapped On-Chain! CID: ${ipfsCid.slice(0, 8)}...`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to encrypt and anchor report on-chain');
    }
  };

  const dashboardCards = [
    { title: 'Uploaded Reports', value: 0, icon: '📤', color: 'var(--status-approved)' },
    { title: 'Authorized Records', value: 0, icon: '🔐', color: 'var(--status-info)' },
    { title: 'Pending Uploads', value: 0, icon: '⏳', color: 'var(--status-pending)' },
    { title: 'Access History', value: 0, icon: '🔍', color: 'var(--medical-secondary)' }
  ];

  const [recentReports, setRecentReports] = useState([]);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Lab Dashboard</h2>
        <div className="dashboard-actions">
          <button
            className="primary-btn"
            onClick={() => setShowUploadForm(true)}
          >
            Upload New Report
          </button>
        </div>
      </div>

      <div className="dashboard-cards">
        {dashboardCards.map((card, index) => (
          <div key={index} className="dashboard-card" style={{ borderColor: card.color }}>
            <div className="card-icon" style={{ backgroundColor: 'var(--panel-bg)', color: card.color, boxShadow: 'var(--shadow-3d)' }}>
              {card.icon}
            </div>
            <div className="card-content">
              <h3>{card.title}</h3>
              <p className="card-value">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-section">
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
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No recent lab reports found.</td>
                </tr>
              ) : (
                recentReports.map((report) => (
                  <tr key={report.id}>
                    <td><span title={report.cid} style={{ cursor: 'pointer', borderBottom: '1px dotted' }}>CID: {report.cid.slice(0, 8)}...</span></td>
                    <td>{report.patient.slice(0, 6)}...{report.patient.slice(-4)}</td>
                    <td>{report.type}</td>
                    <td>{report.date}</td>
                    <td>
                      <span className={`status-badge ${report.status === 'Completed' ? 'active' : 'pending'}`}>
                        {report.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="view-btn">Encrypted</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Authorized Patient Records</h3>
        <div className="authorized-records">
          <div className="record-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No authorized patient records found on-chain.
          </div>
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
    </div>
  );
};

export default LabDashboard;
