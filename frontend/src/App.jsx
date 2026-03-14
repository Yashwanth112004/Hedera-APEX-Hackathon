import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { WALLET_MAPPER_ADDRESS, WALLET_MAPPER_ABI } from "./utils/idMappingHelper";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import MedicalBackground from "./components/MedicalBackground";

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

      // Fix: Normalize address to checksum to prevent isAdmin lookup failures
      const safeWallet = ethers.getAddress(wallet);

      const roleContract = new ethers.Contract(RBAC_CONTRACT_ADDRESS, roleABI, provider);
      const isSystemAdmin = await roleContract.isAdmin(safeWallet);

      if (!isSystemAdmin) {
        toast.error("Access Denied: Wallet is not a registered administrator");
        return;
      }

      setAccount(safeWallet);
      setRole("admin");
      toast.success("Admin Portal Accessed Successfully");
    } catch (err) {
      console.error(err);
      toast.error("Admin connection failed: " + (err.message || "Unknown error"));
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
      <ToastContainer position="top-right" theme="dark" />
      {!account ? (
        <>
          <Navbar
            account={account}
            onDisconnect={disconnectWallet}
            role={role}
            onConnect={connectWallet}
            onRegister={() => setShowRoleForm(true)}
            onAdmin={connectAdmin}
          />
          <div className="landing-page animate-fade-in" style={{ padding: '80px 0 0 0', maxWidth: '100%', margin: '0', position: 'relative', overflow: 'hidden' }}>
            <MedicalBackground />
            
            {/* Professional Hero Section */}
            <div className="hero-section" style={{ 
              background: 'radial-gradient(circle at top, #fff 0%, #f8faff 100%)', 
              borderBottom: '1px solid var(--border-light)', 
              padding: '8rem 2rem', 
              textAlign: 'center',
              position: 'relative'
            }}>
              <div className="glass-panel" style={{ 
                maxWidth: '1200px', 
                margin: '0 auto', 
                padding: '4rem 2rem',
                background: 'rgba(255, 255, 255, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.8)'
              }}>
                <div className="status-badge" style={{ display: 'inline-flex', padding: '0.6rem 1.5rem', background: '#F0FDFA', color: '#0D9488', borderRadius: '30px', marginBottom: '2.5rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid #CCFBF1', letterSpacing: '0.1em' }}>
                  ✚ 24/7 BLOCKCHAIN SECURED ACCESS
                </div>
                <h1 className="hero-title" style={{ 
                  color: '#1E3A8A', 
                  fontSize: '5.2rem', 
                  marginBottom: '1.5rem', 
                  fontWeight: '900',
                  lineHeight: '1.1',
                  letterSpacing: '-0.04em'
                }}>
                  Patient-Centric <br/> <span style={{ color: '#14B8A6' }}>Data Governance</span>
                </h1>
                <p className="hero-subtitle" style={{ fontSize: '1.5rem', color: '#475569', maxWidth: '850px', margin: '0 auto', lineHeight: '1.6', fontWeight: '500' }}>
                  Empowering the future of clinical data privacy. Securely manage your medical history with immutable blockchain consent, in total alignment with the <span style={{ color: '#1E3A8A', fontWeight: '700' }}>DPDP Act 2023.</span>
                </p>
                <div style={{ marginTop: '3.5rem', display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                  <button className="primary-btn" onClick={connectWallet} style={{ borderRadius: '50px', background: 'var(--medical-primary)' }}>
                     Access Patient Portal
                  </button>
                  <button className="secondary-btn" onClick={() => setShowRoleForm(true)} style={{ borderRadius: '50px', background: 'white' }}>
                     Organization Registration
                  </button>
                </div>
              </div>
            </div>

            {/* Features Area */}
            <div className="dashboard-grid" style={{ maxWidth: '1400px', margin: '0 auto', padding: '4rem 2rem' }}>
              <div className="feature-card" style={{ borderLeft: '6px solid #1E40AF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: '#EFF6FF', padding: '1rem', borderRadius: '12px' }}>🛡️</div>
                  <h3 style={{ fontSize: '1.6rem', color: '#1E40AF' }}>Notice & Consent</h3>
                </div>
                <p style={{ color: '#64748B', lineHeight: '1.8', fontSize: '1.05rem' }}>Itemized consent management under Section 5 & 6. Our ledger ensures clinical providers cannot access your records without your explicit digital authorization.</p>
                <span style={{ color: '#1E40AF', fontWeight: '700', fontSize: '0.8rem' }}>LEARN MORE →</span>
              </div>

              <div className="feature-card" style={{ borderLeft: '6px solid #DC2626' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: '#FEF2F2', padding: '1rem', borderRadius: '12px' }}>🗑️</div>
                  <h3 style={{ fontSize: '1.6rem', color: '#DC2626' }}>Right to Erasure</h3>
                </div>
                <p style={{ color: '#64748B', lineHeight: '1.8', fontSize: '1.05rem' }}>Full Section 12 compliance. Exercise your right to be forgotten. Trigger 1-click ledger-anchored requests to purge your clinical footprint across the network.</p>
                <span style={{ color: '#DC2626', fontWeight: '700', fontSize: '0.8rem' }}>EXERCISE RIGHT →</span>
              </div>

              <div className="feature-card" style={{ borderLeft: '6px solid #059669' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: '#ECFDF5', padding: '1rem', borderRadius: '12px' }}>🔍</div>
                  <h3 style={{ fontSize: '1.6rem', color: '#059669' }}>Audit Hierarchy</h3>
                </div>
                <p style={{ color: '#64748B', lineHeight: '1.8', fontSize: '1.05rem' }}>Real-time transparency for data interactions. Fiduciaries are held accountable through an irreversible Hedera blockchain audit trail of all access events.</p>
                <span style={{ color: '#059669', fontWeight: '700', fontSize: '0.8rem' }}>VIEW TRAIL →</span>
              </div>
            </div>
          </div>
        </>
      ) : showContextSelection ? (
        <div className="context-selection-screen animate-fade-in" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ maxWidth: '900px', width: '90%', padding: '4rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '800' }}>Identity Verified</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '3.5rem', fontSize: '1.1rem' }}>
              Authentication successful for <code>{account.slice(0, 10)}...{account.slice(-8)}</code>. <br/>
              Please select the clinical portal you wish to access:
            </p>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {availableRoles.map(r => (
                <button 
                  key={r} 
                  className="glass-panel floating-card" 
                  onClick={() => { setRole(r.toLowerCase()); setShowContextSelection(false); }} 
                  style={{ 
                    padding: '3rem 1.5rem', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    transition: 'all 0.4s ease',
                    border: '1px solid var(--glass-border)',
                    background: 'rgba(255,255,255,0.03)'
                  }}
                >
                  <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))' }}>
                    {r === "Patient" ? "👤" : r === "Hospital" ? "🏥" : r === "Admin" ? "🛡️" : r === "Doctor" ? "🩺" : r === "Lab" ? "🧪" : "🏢"}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--medical-primary)' }}>{r} Portal</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secure Access</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <Navbar 
            account={account} 
            role={role} 
            onDisconnect={disconnectWallet} 
            onConnect={connectWallet}
            onRegister={() => setShowRoleForm(true)}
            onAdmin={connectAdmin}
          />
          <div className="app-body" style={{ marginTop: '80px' }}>
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