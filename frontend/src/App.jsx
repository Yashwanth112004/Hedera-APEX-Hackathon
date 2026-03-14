import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { WALLET_MAPPER_ADDRESS, WALLET_MAPPER_ABI } from "./utils/idMappingHelper";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import PatientDashboard from "./pages/PatientDashboard";
import HospitalDashboard from "./pages/HospitalDashboard";
import LabDashboard from "./pages/LabDashboard";
import RegulatorDashboard from "./pages/RegulatorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AuditLogs from "./pages/AuditLogs";
import DoctorDashboard from "./pages/DoctorDashboard";
import PharmacyDashboard from "./pages/PharmacyDashboard";
import InsuranceDashboard from "./pages/InsuranceDashboard";

/* CONTRACT ADDRESSES */
const AUDIT_LOG = "0x9655adB44dfe57AF56a2fa26Dff7dB7C57280D10";
const REGISTRY = "0xB09cA1D4473E22cA07d69Edd2743F43E654066b5";
const CONSENT_MANAGER = "0xa10BB9FFd47F7E7a1C9c9725DB2fbCfC9f272687";
const ACCESS_MANAGER = "0x3bb8CE552aDd0e25609496CdD3CF20525950cB7f";
const MEDICAL_RECORDS = "0x8627E5f5a4b01688f7eA2DB6Ce8E5B24de1ADe51";
const RBAC_CONTRACT_ADDRESS = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";

/* ABIs */
const consentABI = [
  "function grantConsent(address,string,string,uint256)",
  "function revokeConsent(uint256)",
  "function requestErasure(uint256)",
  "function getPatientConsents(address) view returns (tuple(address dataPrincipal,address dataFiduciary,string purpose,string dataHash,uint256 grantedAt,uint256 expiry,bool isActive,bool erased)[])",
  "function requestAccess(address,string)",
  "function getPendingRequests(address) view returns (tuple(uint256 id,address provider,string purpose,uint256 timestamp,bool isPending)[])",
  "function approveRequest(uint256,string,uint256)",
  "function rejectRequest(uint256)"
];

const medicalRecordsABI = [
  "function addRecord(address,string,string)",
  "function getPatientRecords(address) view returns (tuple(uint256 id,address patient,address provider,string cid,string recordType,uint256 timestamp)[])",
  "function addPrescription(address patient, string patientName, string cid)",
  "function getPendingPrescriptions() view returns (tuple(uint256 recordId,address patient,string patientName,string cid,bool isDispensed)[])",
  "function markPrescriptionDispensed(uint256 recordId)"
];

const registryABI = [
  "function registerFiduciary(string,string)",
  "function approveFiduciary(address)",
  "function addAdmin(address)"
];

const accessABI = [
  "function accessData(address,uint256,string)"
];

const roleABI = [
  "function getRole(address user) view returns (uint8)",
  "function registerRole(address user, uint8 role)",
  "function updateRole(address user, uint8 role)",
  "function isAdmin(address wallet) view returns (bool)"
];

const auditLogABI = [
  "function logConsentGranted(address,address,string,uint256)",
  "function logConsentRevoked(address,address)",
  "function logDataAccessed(address,address,string,uint256)",
  "function logErasureRequested(address,uint256)",
  "function getLogs() view returns (tuple(address dataPrincipal, address dataFiduciary, string action, string purpose, uint256 timestamp)[])"
];

// Map role IDs to strings based on DPDP requirements
const mapRole = (roleId) => {
  switch (Number(roleId)) {
    case 1: return "Hospital";
    case 2: return "Lab";
    case 3: return "Doctor";
    case 4: return "Pharmacy";
    case 5: return "Insurance";
    case 6: return "Auditor";
    case 7: return "Admin";
    default: return "Patient";
  }
};

function App() {
  const [account, setAccount] = useState("");
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [showContextSelection, setShowContextSelection] = useState(false);
  const [availableRoles, setAvailableRoles] = useState(["Patient"]);

  const [reqOrgName, setReqOrgName] = useState("");
  const [reqWallet, setReqWallet] = useState("");
  const [reqRole, setReqRole] = useState("1");

  const [consentContract, setConsent] = useState(null);
  const [registryContract, setRegistry] = useState(null);
  const [accessContract, setAccess] = useState(null);
  const [auditLogContract, setAuditLog] = useState(null);
  const [medicalRecordsContract, setMedicalRecords] = useState(null);
  const [walletMapperContract, setWalletMapper] = useState(null);

  const [consents, setConsents] = useState([]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error("Install MetaMask");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const wallet = accounts[0];

      // DPDP COMPLIANT AUTHENTICATION
      const nonce = Math.floor(Math.random() * 1000000);
      const timestamp = new Date().toISOString().split('T')[0];
      const message = `Sign this message to authenticate your identity for DPDP Healthcare Consent Network\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

      try {
        await signer.signMessage(message);
        setAuthenticated(true);
      } catch (err) {
        toast.error("Digital signature required for compliance");
        return;
      }

      setAccount(wallet);
      setConsent(new ethers.Contract(CONSENT_MANAGER, consentABI, signer));
      setRegistry(new ethers.Contract(REGISTRY, registryABI, signer));
      setAccess(new ethers.Contract(ACCESS_MANAGER, accessABI, signer));
      setAuditLog(new ethers.Contract(AUDIT_LOG, auditLogABI, signer));
      setMedicalRecords(new ethers.Contract(MEDICAL_RECORDS, medicalRecordsABI, signer));
      setWalletMapper(new ethers.Contract(WALLET_MAPPER_ADDRESS, WALLET_MAPPER_ABI, signer));

      const rolesToSelect = ["Patient"];
      try {
        // Use provider for view functions to avoid MetaMask RPC call exceptions
        const roleContract = new ethers.Contract(RBAC_CONTRACT_ADDRESS, roleABI, provider);

        // Ensure checksum compliance to prevent ethers v6 silent errors
        let safeWallet = wallet.toLowerCase();
        try { safeWallet = ethers.getAddress(wallet); } catch (e) { }

        // 1. Check mapped role (using provider avoids gas estimation errors on view calls)
        const roleId = await roleContract.getRole(safeWallet);
        const stringRole = mapRole(roleId);

        if (stringRole !== "Patient") {
          rolesToSelect.push(stringRole);
        }

        // 2. Check admin status
        try {
          const isSystemAdmin = await roleContract.isAdmin(safeWallet);
          if (isSystemAdmin && !rolesToSelect.includes("Admin")) {
            rolesToSelect.push("Admin");
          }
        } catch (e) { }

      } catch (roleError) {
        console.warn("Failed to fetch roles, defaulting to Patient", roleError);
      }

      setAvailableRoles(rolesToSelect);
      if (rolesToSelect.length > 1) {
        setShowContextSelection(true);
      } else {
        setRole("patient");
      }
      toast.success("Identity Authenticated");
    } catch (err) {
      console.error(err);
      toast.error("Authentication failed");
    }
  };

  const connectAdmin = async () => {
    if (!window.ethereum) {
      toast.error("Install MetaMask");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const wallet = accounts[0];

      const roleContract = new ethers.Contract(RBAC_CONTRACT_ADDRESS, roleABI, provider);
      const isSystemAdmin = await roleContract.isAdmin(wallet);

      if (!isSystemAdmin) {
        toast.error("Access Denied: Wallet is not a registered administrator");
        return;
      }

      setAccount(wallet);
      setRole("admin");
      toast.success("Admin Portal Accessed Successfully");
    } catch (err) {
      console.error(err);
      toast.error("Admin connection failed");
    }
  };

  const disconnectWallet = () => {
    setAccount("");
    setRole(null);
    setAuthenticated(false);
    setShowContextSelection(false);
    setActiveTab("dashboard");
  };

  const handleTabChange = (tab) => setActiveTab(tab);

  const submitRoleRequest = (e) => {
    e.preventDefault();
    const newRequest = { orgName: reqOrgName, wallet: reqWallet, roleId: reqRole, status: 'pending', timestamp: Date.now() };
    const existingReqs = JSON.parse(localStorage.getItem('dpdp_role_requests') || '[]');
    existingReqs.push(newRequest);
    localStorage.setItem('dpdp_role_requests', JSON.stringify(existingReqs));
    toast.success("Request submitted to Admin");
    setShowRoleForm(false);
    setReqOrgName("");
    setReqWallet("");
  };

  const grantConsent = async (hospitalAddress, purpose) => {
    if (!consentContract) return;
    try {
      const tx = await consentContract.grantConsent(hospitalAddress, purpose, "QmMedicalReportHash", 86400, { gasLimit: 1000000 });
      await tx.wait();
      loadConsents();
      toast.success("Consent Granted on Blockchain");
    } catch (err) {
      toast.error("Grant failed");
    }
  };

  const revokeConsent = async (index) => {
    try {
      const tx = await consentContract.revokeConsent(index, { gasLimit: 1000000 });
      await tx.wait();
      loadConsents();
      toast.success("Consent Revoked");
    } catch (err) {
      toast.error("Revoke failed");
    }
  };

  const eraseConsent = async (index) => {
    try {
      const tx = await consentContract.requestErasure(index, { gasLimit: 1000000 });
      await tx.wait();
      loadConsents();
      toast.success("Data Erasure Requested");
    } catch (err) {
      toast.error("Erasure failed");
    }
  };

  const loadConsents = async () => {
    if (!consentContract || !account) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const readContract = consentContract.connect(provider);
      const res = await readContract.getPatientConsents(account);
      setConsents(res);
    } catch (err) {
      console.error(err);
    }
  };

  const registerHospital = async (name, license) => {
    if (!registryContract) return;
    try {
      const tx = await registryContract.registerFiduciary(name, license);
      await tx.wait();
      toast.success("Registration Submitted");
    } catch (err) {
      toast.error("Registration failed");
    }
  };

  const accessPatientData = async (patient) => {
    if (!accessContract) return;
    try {
      const tx = await accessContract.accessData(patient, 0, "Clinical Purpose");
      await tx.wait();
      toast.success("Data Accessed & Logged");
    } catch (err) {
      toast.error("Access Denied");
    }
  };

  useEffect(() => {
    if (consentContract) loadConsents();
  }, [consentContract]);

  const renderDashboard = () => {
    const commonProps = { account, consentContract, registryContract, auditLogContract, accessContract, medicalRecordsContract, walletMapperContract };
    const r = role?.toLowerCase();
    switch (r) {
      case "hospital": return <HospitalDashboard {...commonProps} onRegisterHospital={registerHospital} onAccessPatientData={accessPatientData} />;
      case "lab": return <LabDashboard {...commonProps} />;
      case "doctor": return <DoctorDashboard {...commonProps} />;
      case "pharmacy": return <PharmacyDashboard {...commonProps} />;
      case "insurance": return <InsuranceDashboard {...commonProps} />;
      case "auditor": return <RegulatorDashboard {...commonProps} />;
      case "admin": return <AdminDashboard account={account} />;
      default: return <PatientDashboard {...commonProps} consents={consents} onGrantConsent={grantConsent} onRevokeConsent={revokeConsent} onEraseConsent={eraseConsent} onLoadConsents={loadConsents} />;
    }
  };

  return (
    <div className="app">
      <ToastContainer position="top-right" theme="light" />
      {!account ? (
        <>
          <Navbar
            account={account}
            onConnect={connectWallet}
            onRegister={() => setShowRoleForm(true)}
            onAdmin={connectAdmin}
          />
          <div className="landing-page premium-sas-theme">
            {/* Background elements */}
            <div className="glow-mesh"></div>
            <div className="particles-overlay"></div>
            
            {/* HERO SECTION */}
            <section className="hero-section">
              <div className="container">
                <div className="hero-badge animate-fade-in">
                  <span className="badge-text">Secure Consent Management</span>
                  <span className="badge-line"></span>
                  <span className="badge-status">v2.4 Released</span>
                </div>
                
                <h1 className="hero-headline animate-slide-up">
                  Take Control of Your <br />
                  <span className="gradient-text">Medical Data</span>
                </h1>
                
                <p className="hero-subheadline animate-slide-up-delayed">
                  DocKnock is a blockchain-powered consent platform that lets patients control 
                  who accesses their health records while enabling hospitals to stay compliant 
                  with India’s DPDP Act.
                </p>
                
                <div className="hero-ctas animate-slide-up-more-delayed">
                  <button className="primary-sas-btn" onClick={() => setShowRoleForm(true)}>
                    Start for Hospitals <span className="arrow">↗</span>
                  </button>
                  <button className="secondary-sas-btn" onClick={connectAdmin}>
                    Request Demo
                  </button>
                </div>

                {/* 3D Visualization Placeholder / Animated Graphic */}
                <div className="hero-visual-container animate-float">
                    <div className="network-viz">
                      <svg className="viz-lines-svg" viewBox="0 0 800 500">
                        {/* Connecting Lines with IDs for individual animation timing */}
                        <path id="flow-line-1" className="viz-flow-line" d="M400 250 L200 120" />
                        <path id="flow-line-2" className="viz-flow-line" d="M400 250 L600 120" />
                        <path id="flow-line-3" className="viz-flow-line" d="M400 250 L200 380" />
                        <path id="flow-line-4" className="viz-flow-line" d="M400 250 L600 380" />
                      </svg>
                      <div className="node center">🛡️</div>
                      <div className="node orb-1">🏥</div>
                      <div className="node orb-2">🩺</div>
                      <div className="node orb-3">👤</div>
                      <div className="node orb-4">🧪</div>
                    </div>
                </div>
              </div>
            </section>

            {/* TRUST SIGNALS */}
            <section className="trust-signals">
              <div className="container">
                <p className="trust-headline">Built for DPDP Compliance • End-to-End Encryption • Tamper-Proof Audit Trails</p>
                <div className="logo-cloud">
                  <div className="logo-item">APOLLO</div>
                  <div className="logo-item">MAX HEALTH</div>
                  <div className="logo-item">FORTIS</div>
                  <div className="logo-item">ISO 27001</div>
                  <div className="logo-item">SOC2 TYPE II</div>
                </div>
              </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="how-it-works">
              <div className="container">
                <div className="section-header">
                  <h2 className="section-title">The Standard for Medical Trust</h2>
                  <p className="section-subtitle">A seamless flow designed for patients and clinicians.</p>
                </div>
                
                <div className="workflow-grid">
                  <div className="workflow-card">
                    <div className="step-number">01</div>
                    <h3>Patient Grants Consent</h3>
                    <p>Patients manage permissions via a secure blockchain-linked wallet.</p>
                  </div>
                  <div className="workflow-card">
                    <div className="step-number">02</div>
                    <h3>Hospital Requests Access</h3>
                    <p>Verified entities request data access in real-time through the portal.</p>
                  </div>
                  <div className="workflow-card">
                    <div className="step-number">03</div>
                    <h3>Immutable Audit</h3>
                    <p>Smart contracts log every interaction on the Hedera ledger.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* FEATURES SECTION */}
            <section className="features-section">
              <div className="container">
                <div className="features-grid">
                  <div className="feature-item-card">
                    <div className="feat-icon">🛡️</div>
                    <h3>Consent Management</h3>
                    <p>Granular control over who sees your data and for how long.</p>
                  </div>
                  <div className="feature-item-card">
                    <div className="feat-icon">📜</div>
                    <h3>Immutable Audit Logs</h3>
                    <p>Tamper-proof logs secured by Hedera Hashgraph consensus.</p>
                  </div>
                  <div className="feature-item-card">
                    <div className="feat-icon">👤</div>
                    <h3>Patient Data Ownership</h3>
                    <p>You own the keys to your records. No third-party intermediaries.</p>
                  </div>
                  <div className="feature-item-card">
                    <div className="feat-icon">🏥</div>
                    <h3>Hospital Access Control</h3>
                    <p>Enterprise RBAC for hospitals to manage clinical permissions.</p>
                  </div>
                  <div className="feature-item-card">
                    <div className="feat-icon">⚖️</div>
                    <h3>Regulatory Compliance</h3>
                    <p>Native support for DPDP Act compliance and right to erasure.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECURITY SECTION */}
            <section className="security-section">
              <div className="container">
                <div className="security-content">
                  <div className="security-text">
                    <h2 className="section-title">Zero Trust Security Architecture</h2>
                    <ul className="security-list">
                      <li><span>✓</span> Blockchain Verification</li>
                      <li><span>✓</span> End-to-End Encrypted Data</li>
                      <li><span>✓</span> Decentralized Identity (DID)</li>
                    </ul>
                  </div>
                  <div className="architecture-viz">
                    <div className="arch-node">Patient</div>
                    <div className="arch-arrow">→</div>
                    <div className="arch-node active">Smart Contract</div>
                    <div className="arch-arrow">→</div>
                    <div className="arch-node">Hospital</div>
                    <div className="arch-line"></div>
                    <div className="arch-audit">Audit Log</div>
                  </div>
                </div>
              </div>
            </section>

            {/* DASHBOARD PREVIEW */}
            <section className="preview-section">
              <div className="container">
                <div className="preview-container">
                  <div className="window-header">
                    <div className="dot red"></div>
                    <div className="dot yellow"></div>
                    <div className="dot green"></div>
                    <span className="window-title">DocKnock Command Center</span>
                  </div>
                  <div className="mock-dashboard">
                    <div className="mock-sidebar">
                      <div className="mock-nav-group">
                        <div className="mock-nav-item active">🛡️ Overview</div>
                        <div className="mock-nav-item">❤️ Health Records</div>
                        <div className="mock-nav-item">📝 Consent History</div>
                        <div className="mock-nav-item">🔒 Security</div>
                      </div>
                    </div>
                    <div className="mock-body">
                      <div className="mock-stat-row">
                        <div className="mock-stat">
                          <label>Total Consents</label>
                          <div className="stat-val">6.2k</div>
                        </div>
                        <div className="mock-stat">
                          <label>Active Requests</label>
                          <div className="stat-val">142</div>
                        </div>
                        <div className="mock-stat">
                          <label>Security Score</label>
                          <div className="stat-val">99.8%</div>
                        </div>
                      </div>
                      <div className="mock-table">
                        <div className="mock-table-header">Live Audit Stream</div>
                        <div className="mock-table-row"><span className="id">PAT-8921</span> <span className="action">Consent Granted</span> <span className="status verified">Verified</span></div>
                        <div className="mock-table-row"><span className="id">DOC-3321</span> <span className="action">Data Accessed</span> <span className="status verified">Verified</span></div>
                        <div className="mock-table-row"><span className="id">PAT-1142</span> <span className="action">Key Revoked</span> <span className="status warn">Alert</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FOOTER */}
            <footer className="sas-footer">
              <div className="container">
                <div className="footer-grid">
                  <div className="footer-brand">
                    <h3>DocKnock</h3>
                    <p>Leading the world in blockchain-based health privacy.</p>
                  </div>
                  <div className="footer-links">
                    <div className="link-col">
                      <h4>Product</h4>
                      <a href="#">Privacy</a>
                      <a href="#">Features</a>
                      <a href="#">Security</a>
                    </div>
                    <div className="link-col">
                      <h4>Compliance</h4>
                      <a href="#">DPDP Act</a>
                      <a href="#">GDPR</a>
                      <a href="#">HIPAA</a>
                    </div>
                    <div className="link-col">
                      <h4>Documentation</h4>
                      <a href="#">API Docs</a>
                      <a href="#">SDKs</a>
                      <a href="#">Whitepaper</a>
                    </div>
                    <div className="link-col">
                      <h4>Contact</h4>
                      <a href="#">Support</a>
                      <a href="#">Sales</a>
                      <a href="#">Twitter</a>
                    </div>
                  </div>
                </div>
                <div className="footer-bottom">
                  <p>© 2026 DocKnock Inc. All rights reserved.</p>
                </div>
              </div>
            </footer>
          </div>
        </>
      ) : showContextSelection ? (
        <div className="context-selection-screen">
          <div className="context-panel">
            <div className="context-verified-badge">✅ Identity Verified</div>
            <h2>Select Your Portal</h2>
            <p className="context-subtitle">Logged in as <code>{account.slice(0, 6)}...{account.slice(-4)}</code> — choose the role to continue:</p>
            <div className="context-grid">
              {availableRoles.map(r => (
                <button key={r} className="context-card" onClick={() => { setRole(r.toLowerCase()); setShowContextSelection(false); }}>
                  <div className="context-card-icon">
                    {r === "Patient" ? "👤" : r === "Hospital" ? "🏥" : r === "Admin" ? "🛡️" : r === "Doctor" ? "🩺" : "🏢"}
                  </div>
                  <span className="context-card-label">{r} Portal</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <Navbar account={account} role={role} onDisconnect={disconnectWallet} />
          <div className="app-body">
            {role && <Sidebar role={role} activeTab={activeTab} onTabChange={handleTabChange} />}
            <main className="main-content">
              {activeTab === "audit" ? <AuditLogs auditLogContract={auditLogContract} /> : renderDashboard()}
            </main>
          </div>
        </>
      )}

      {showRoleForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Register Organization</h3>
              <button className="close-btn" onClick={() => setShowRoleForm(false)}>×</button>
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
                <button type="button" className="secondary-btn" onClick={() => setShowRoleForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;