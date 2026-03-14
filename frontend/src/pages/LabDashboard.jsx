import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { encryptData, uploadToPinata } from '../utils/ipfsHelper';
import { resolveWalletAddress } from '../utils/idMappingHelper';

const LabDashboard = ({ medicalRecordsContract, walletMapperContract }) => {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData] = useState({
    patientAddress: '',
    reportType: '',
    reportData: ''
  });

  const handleUploadReport = async (e) => {
    e.preventDefault();
    if (!uploadData.patientAddress || !uploadData.reportType || !uploadData.reportData) {
      toast.error('Please fill all fields');
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
      toast.info("Encrypting sensitive health data...");
      const encryptedPayload = encryptData({
        patientRef: targetWallet,
        type: uploadData.reportType,
        clinicalData: uploadData.reportData,
        timestamp: new Date().toISOString()
      });

      toast.info("Uploading cipher text to IPFS network...");
      const ipfsCid = await uploadToPinata(encryptedPayload, `${uploadData.reportType} - ${uploadData.patientAddress.slice(0, 6)}`);

      toast.info("Mapping Record to Wallet On-Chain...");
      if (medicalRecordsContract) {
        const tx = await medicalRecordsContract.addRecord(targetWallet, ipfsCid, uploadData.reportType, { gasLimit: 1000000 });
        await tx.wait();
      } else {
        toast.warning("MedicalRecords mapping failed: Contract unreachable.");
      }

      setRecentReports(prev => [
        { id: prev.length + 1, patient: targetWallet, type: uploadData.reportType, date: new Date().toISOString().split('T')[0], status: 'Completed', cid: ipfsCid },
        ...prev
      ]);

      setShowUploadForm(false);
      setUploadData({ patientAddress: '', reportType: '', reportData: '' });
      toast.success(`Securely Mapped On-Chain! CID: ${ipfsCid.slice(0, 8)}...`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to encrypt and anchor report on-chain');
    }
  };

  const dashboardCards = [
    { title: 'Uploaded Reports', value: 0, icon: '📤', color: '#22C55E' },
    { title: 'Authorized Records', value: 0, icon: '🔐', color: '#2563EB' },
    { title: 'Pending Uploads', value: 0, icon: '⏳', color: '#F59E0B' },
    { title: 'Access History', value: 0, icon: '🔍', color: '#8B5CF6' }
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
            <div className="card-icon" style={{ backgroundColor: card.color + '20', color: card.color }}>
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
                <label>Report Type *</label>
                <select
                  value={uploadData.reportType}
                  onChange={(e) => setUploadData({ ...uploadData, reportType: e.target.value })}
                  required
                >
                  <option value="">Select report type</option>
                  <option value="blood_test">Blood Test</option>
                  <option value="xray">X-Ray</option>
                  <option value="mri">MRI Scan</option>
                  <option value="ct_scan">CT Scan</option>
                  <option value="ultrasound">Ultrasound</option>
                  <option value="pathology">Pathology Report</option>
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
                <input type="file" accept=".pdf,.jpg,.png,.doc,.docx" />
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
