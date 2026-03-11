import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

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
    const commonProps = { account, consentContract, registryContract, auditLogContract, accessContract, medicalRecordsContract };
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
            onConnect={connectWallet}
            onRegister={() => setShowRoleForm(true)}
            onAdmin={connectAdmin}
          />
          <div className="landing-page" style={{ padding: '4rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="landing-header animate-fade-in" style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h1 className="app-title" style={{ fontSize: '3.5rem', marginBottom: '1rem', background: 'linear-gradient(45deg, var(--primary-color), #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Decentralized Health Consent
              </h1>
              <p className="app-description" style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
                Empowering patients with absolute control over their medical data through immutable, blockchain-backed governance in strict compliance with the Digital Personal Data Protection (DPDP) Act 2023.
              </p>
            </div>

            <div className="dpdp-features-grid animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', animationDelay: '0.2s' }}>
              <div className="feature-card glass-panel" style={{ padding: '2.5rem', borderTop: '4px solid #3B82F6' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><span>🛡️</span> Notice & Consent</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Section 5 & 6 specifies that data processing requires explicit, itemized consent. Our smart contracts guarantee that fiduciaries cannot access clinical data without cryptographically verifiable consent tokens issued by the patient.</p>
              </div>

              <div className="feature-card glass-panel" style={{ padding: '2.5rem', borderTop: '4px solid #EF4444' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><span>🗑️</span> Right to Erasure</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Under Section 12, Data Principals have the right to request deletion of their data. Patients can trigger an immediate on-chain "Erasure Request" event, legally mandating the fiduciary to purge medical records.</p>
              </div>

              <div className="feature-card glass-panel" style={{ padding: '2.5rem', borderTop: '4px solid #10B981' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><span>🔍</span> Immutable Audit</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Section 8 requires Fiduciaries to maintain security safeguards. The Hedera ledger acts as an undisputed, tamper-proof audit trail for every single piece of accessed medical data, accessible instantly by Data Protection Officers.</p>
              </div>
            </div>
          </div>
        </>
      ) : showContextSelection ? (
        <div className="context-selection-screen">
          <div className="glass-panel" style={{ maxWidth: '800px', margin: '4rem auto', textAlign: 'center', padding: '4rem' }}>
            <h2>Identity Verified</h2>
            <p style={{ marginBottom: '3rem' }}>Logged in as {account.slice(0, 6)}...{account.slice(-4)}. Select your portal:</p>
            <div className="context-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
              {availableRoles.map(r => (
                <button key={r} className="context-card glass-panel" onClick={() => { setRole(r.toLowerCase()); setShowContextSelection(false); }} style={{ padding: '2.5rem 1.5rem', cursor: 'pointer' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                    {r === "Patient" ? "👤" : r === "Hospital" ? "🏥" : r === "Admin" ? "🛡️" : r === "Doctor" ? "🩺" : "🏢"}
                  </div>
                  <h3>{r} Portal</h3>
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