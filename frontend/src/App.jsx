import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { WALLET_MAPPER_ADDRESS, WALLET_MAPPER_ABI, resolveWalletAddress } from "./utils/idMappingHelper";
import { getSafePatientConsents } from "./utils/consentHelper";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import MedicalBackground from "./components/MedicalBackground";
import { LayoutGrid, ArrowRight, Activity, Shield, Globe, Lock } from "lucide-react";

import ShieldDiagram from "./components/ShieldDiagram";
import TrustBar from "./components/TrustBar";
import StandardTrust from "./components/StandardTrust";
import EnhancedFeatures from "./components/EnhancedFeatures";
import SecurityArchitecture from "./components/SecurityArchitecture";
import FloatingPortals from "./components/FloatingPortals";

import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import HospitalDashboard from "./pages/HospitalDashboard";
import LabDashboard from "./pages/LabDashboard";
import RegulatorDashboard from "./pages/RegulatorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AuditLogs from "./pages/AuditLogs";
import PharmacyDashboard from "./pages/PharmacyDashboard";
import InsuranceDashboard from "./pages/InsuranceDashboard";
import LegalCompliance from "./pages/LegalCompliance";

/* CONTRACT ADDRESSES */
const AUDIT_LOG = "0x92d2eCE8bB295b7806A900Fad7CA26Fd55814976";
const REGISTRY = "0x155Af6ECaFb48861dA7d16Fb8Af2f6ce9d6DD779";
const CONSENT_MANAGER = "0x931a878562F3c7f3D6B9Ff27f0ce01e1Cb0F4470";
const ACCESS_MANAGER = "0x62BC569E5047E6f77C3ECA6C056C9337E39bd1BD";
const MEDICAL_RECORDS = "0xd9BB8653aE2Ba8860e4B436D9FdA4c829F04ce85";
const RBAC_CONTRACT_ADDRESS = "0x0b11e9AA48bf573A8E9d1D5085b71d8c58de9968";
const HARDCODED_ADMIN = "0x04Fee3FD1B338d12FFD6dBD8d66dE1e8e0BB99cB";

/* ABIs */
const consentABI = [
  "function grantConsent(address,string,string,string,uint256)",
  "function revokeConsent(uint256)",
  "function updateConsentDuration(uint256,uint256)",
  "function requestErasure(uint256)",
  "function getPatientConsents(address) view returns (tuple(address dataPrincipal,address dataFiduciary,string purpose,string dataHash,string dataScope,uint256 grantedAt,uint256 expiry,bool isActive,bool erased)[])",
  "function requestAccess(address,string)",
  "function getPendingRequests(address) view returns (tuple(uint256 id,address provider,string purpose,uint256 timestamp,bool isPending)[])",
  "function approveRequest(uint256,string,string,uint256)",
  "function rejectRequest(uint256)"
];

const consentABIOld = [
  "function getPatientConsents(address) view returns (tuple(address dataPrincipal,address dataFiduciary,string purpose,string dataHash,uint256 grantedAt,uint256 expiry,bool isActive,bool erased)[])"
];

const medicalRecordsABI = [
  "function addRecord(address _patient, string _cid, string _recordType, uint256 _billAmount)",
  "function getPatientRecords(address) view returns (tuple(uint256 id,address patient,address provider,string cid,string recordType,uint256 timestamp,uint256 billAmount)[])",
  "function addPrescription(address patient, string patientName, string cid)",
  "function getPendingPrescriptions() view returns (tuple(uint256 recordId,address patient,string patientName,string cid,bool isDispensed,uint256 billAmount)[])",
  "function markPrescriptionDispensed(uint256 recordId, uint256 billAmount)"
];

const registryABI = [
  "function registerFiduciary(string,string)",
  "function approveFiduciary(address)",
  "function addAdmin(address)",
  "function isApproved(address) view returns (bool)"
];

const accessABI = [
  "function accessData(address,uint256,string,string)"
];

const roleABI = [
  "function getRole(address user) view returns (uint8)",
  "function registerRole(address user, uint8 role)",
  "function updateRole(address user, uint8 role)",
  "function isAdmin(address user) view returns (bool)"
];

const auditLogABI = [
  "function logConsentGranted(address,address,string,uint256)",
  "function logConsentRevoked(address,address)",
  "function logDataAccessed(address,address,string,uint256)",
  "function logAccessRequested(address,address,string,uint256)",
  "function logErasureRequested(address,uint256)",
  "function getLogs() view returns (tuple(address dataPrincipal, address dataFiduciary, string action, string purpose, uint256 timestamp)[])",
  "event DataAccessed(address indexed dataPrincipal, address indexed fiduciary, string purpose, uint256 timestamp)",
  "event AccessRequested(address indexed dataPrincipal, address indexed fiduciary, string purpose, uint256 timestamp)"
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
    default: return "Patient";
  }
};

function App() {
  const [account, setAccount] = useState("");
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [authenticated, setAuthenticated] = useState(false);
  const [showContextSelection, setShowContextSelection] = useState(false);
  const [availableRoles, setAvailableRoles] = useState(["Patient"]);

  // Beneficiary Access State
  const [actingAsAccount, setActingAsAccount] = useState("");
  const [showBeneficiaryLogin, setShowBeneficiaryLogin] = useState(false);
  const [beneficiaryLoginData, setBeneficiaryLoginData] = useState({ mainAccount: '', password: '' });

  const [consentContract, setConsent] = useState(null);
  const [registryContract, setRegistry] = useState(null);
  const [accessContract, setAccess] = useState(null);
  const [auditLogContract, setAuditLog] = useState(null);
  const [medicalRecordsContract, setMedicalRecords] = useState(null);
  const [walletMapperContract, setWalletMapper] = useState(null);
  const [rbacContract, setRBAC] = useState(null);

  const [consents, setConsents] = useState([]);
  const [notifications, setNotifications] = useState([]);

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
        localStorage.setItem('hedera_hc_authenticated', 'true');
      } catch (err) {
        toast.error("Digital signature required for compliance");
        return;
      }

      await initializeSession(signer, wallet, null);

      const rolesToSelect = ["Patient"];
      try {
        // Use provider for view functions to avoid MetaMask RPC call exceptions
        const roleContract = new ethers.Contract(RBAC_CONTRACT_ADDRESS, roleABI, provider);

        // Ensure checksum compliance to prevent ethers v6 silent errors
        let safeWallet = wallet.toLowerCase();
        try { safeWallet = ethers.getAddress(wallet); } catch (e) { }

        // 1. Check mapped role (using provider avoids gas estimation errors on view calls)
        let roleId = await roleContract.getRole(safeWallet);

        // FALLBACK: If not found on primary, check secondary RBAC (legacy/parallel)
        if (Number(roleId) === 0) {
          try {
            const legacyRBAC = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";
            const legacyContract = new ethers.Contract(legacyRBAC, roleABI, provider);
            const legacyRoleId = await legacyContract.getRole(safeWallet);
            if (Number(legacyRoleId) !== 0) roleId = legacyRoleId;
          } catch (e) { }
        }

        const stringRole = mapRole(roleId);

        if (stringRole !== "Patient") {
          rolesToSelect.push(stringRole);
        }

        const isAdminWallet = safeWallet.toLowerCase() === HARDCODED_ADMIN.toLowerCase();
        if (isAdminWallet && !rolesToSelect.includes("Admin")) {
          rolesToSelect.push("Admin");
        }

      } catch (roleError) {
        console.warn("Failed to fetch roles, defaulting to Patient", roleError);
      }

      setAvailableRoles(rolesToSelect);
      if (rolesToSelect.length > 1) {
        setShowContextSelection(true);
      } else {
        const finalRole = "patient";
        setRole(finalRole);
        localStorage.setItem('hedera_hc_role', finalRole);
      }
      toast.success("Identity Authenticated");
    } catch (err) {
      console.error(err);
      toast.error("Authentication failed");
    }
  };

  const initializeSession = async (signer, wallet, savedRole) => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    setAccount(wallet);
    localStorage.setItem('hedera_hc_account', wallet);

    // Principal contracts for WRITING (connected to signer)
    setConsent(new ethers.Contract(CONSENT_MANAGER, consentABI, signer));
    setRegistry(new ethers.Contract(REGISTRY, registryABI, signer));
    setAccess(new ethers.Contract(ACCESS_MANAGER, accessABI, signer));
    setAuditLog(new ethers.Contract(AUDIT_LOG, auditLogABI, signer));
    setMedicalRecords(new ethers.Contract(MEDICAL_RECORDS, medicalRecordsABI, signer));
    setWalletMapper(new ethers.Contract(WALLET_MAPPER_ADDRESS, WALLET_MAPPER_ABI, signer));
    setRBAC(new ethers.Contract(RBAC_CONTRACT_ADDRESS, roleABI, signer));

    // For specialized read operations via direct RPC
    const hapiProvider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    window.hapiProvider = hapiProvider; // Global for debug visibility

    if (savedRole) {
      setRole(savedRole);
      setAuthenticated(localStorage.getItem('hedera_hc_authenticated') === 'true');
    }
  };

  useEffect(() => {
    const autoReconnect = async () => {
      const savedAccount = localStorage.getItem('hedera_hc_account');
      const savedRole = localStorage.getItem('hedera_hc_role');

      if (window.ethereum && savedAccount) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.send("eth_accounts", []);

          if (accounts.length > 0 && accounts[0].toLowerCase() === savedAccount.toLowerCase()) {
            const signer = await provider.getSigner();
            await initializeSession(signer, accounts[0], savedRole);

            // Re-fetch available roles so "Switch Role" works after refresh
            const rolesToSelect = ["Patient"];
            try {
              const roleContract = new ethers.Contract(RBAC_CONTRACT_ADDRESS, roleABI, provider);
              let safeWallet = accounts[0].toLowerCase();
              try { safeWallet = ethers.getAddress(accounts[0]); } catch (e) { }

              let roleId = await roleContract.getRole(safeWallet);
              if (Number(roleId) === 0) {
                try {
                  const legacyRBAC = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";
                  const legacyContract = new ethers.Contract(legacyRBAC, roleABI, provider);
                  const legacyRoleId = await legacyContract.getRole(safeWallet);
                  if (Number(legacyRoleId) !== 0) roleId = legacyRoleId;
                } catch (e) { }
              }

              const stringRole = mapRole(roleId);
              if (stringRole !== "Patient") rolesToSelect.push(stringRole);

              const isAdminWallet = safeWallet.toLowerCase() === HARDCODED_ADMIN.toLowerCase();
              if (isAdminWallet && !rolesToSelect.includes("Admin")) rolesToSelect.push("Admin");
            } catch (roleError) {
              console.warn("Auto-reconnect: Failed to fetch roles", roleError);
            }
            setAvailableRoles(rolesToSelect);

            console.log("Session restored for", accounts[0], "roles:", rolesToSelect);
          }
        } catch (err) {
          console.warn("Auto-reconnect failed", err);
        }
      }
    };
    autoReconnect();
  }, []);

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

      const isAdminWallet = safeWallet.toLowerCase() === HARDCODED_ADMIN.toLowerCase();

      if (!isAdminWallet) {
        toast.error("Access Denied: Only the authorized Super Admin wallet can access this portal");
        return;
      }

      setAccount(safeWallet);
      setRole("admin");
      localStorage.setItem('hedera_hc_account', safeWallet);
      localStorage.setItem('hedera_hc_role', 'admin');
      localStorage.setItem('hedera_hc_authenticated', 'true');

      setAuthenticated(true);
      const signer = await provider.getSigner();
      await initializeSession(signer, safeWallet, "admin");

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
    setActingAsAccount("");
    setActiveTab("dashboard");

    localStorage.removeItem('hedera_hc_account');
    localStorage.removeItem('hedera_hc_role');
    localStorage.removeItem('hedera_hc_authenticated');
  };

  const handleBeneficiaryLogin = async (e) => {
    e.preventDefault();

    // The beneficiary must first connect their wallet so we know WHO they are
    let beneficiaryWallet = account;
    if (!beneficiaryWallet) {
      if (!window.ethereum) {
        toast.error("Install MetaMask to use Beneficiary Access");
        return;
      }
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        beneficiaryWallet = accounts[0];

        // Authenticate via digital signature
        const nonce = Math.floor(Math.random() * 1000000);
        const timestamp = new Date().toISOString().split('T')[0];
        const message = `Sign this message to authenticate your identity for DPDP Healthcare Consent Network\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
        await signer.signMessage(message);

        // Initialize session contracts for the beneficiary wallet
        await initializeSession(signer, beneficiaryWallet, null);
        setAuthenticated(true);
        localStorage.setItem('hedera_hc_authenticated', 'true');
      } catch (err) {
        toast.error("Wallet connection required for Beneficiary Access");
        return;
      }
    }

    const lookup = JSON.parse(localStorage.getItem('beneficiary_lookup') || '{}');
    let entry = lookup[beneficiaryWallet.toLowerCase()];

    // RESOLUTION: Resolve Main Account (Patient ID/Address) from the input field
    let resolvedMainAccount;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const mapperContract = new ethers.Contract(WALLET_MAPPER_ADDRESS, WALLET_MAPPER_ABI, provider);

    try {
      resolvedMainAccount = await resolveWalletAddress(beneficiaryLoginData.mainAccount, mapperContract);
      console.log("[Beneficiary-Login] Resolving Patient ID:", beneficiaryLoginData.mainAccount, "->", resolvedMainAccount);
    } catch (err) {
      toast.error("Could not resolve Patient ID: " + err.message);
      return;
    }

    // FALLBACK: If entry wasn't found by wallet address, try looking up by beneficiary's own Short ID
    // (This handles beneficiaries registered using their Short ID key before the fixes)
    if (!entry) {
      try {
        const myShortId = await mapperContract.getShortIDFromWallet(beneficiaryWallet);
        if (myShortId) {
          entry = lookup[myShortId.toLowerCase()];
          if (entry) console.log("[Beneficiary-Login] Found entry via Short ID fallback:", myShortId);
        }
      } catch (e) { console.warn("Beneficiary Short ID fallback failed", e); }
    }

    if (!entry) {
      console.error("[Beneficiary-Login] No entry found in beneficiary_lookup for wallet:", beneficiaryWallet);
      toast.error("You are not registered as a beneficiary for any account with this wallet.");
      return;
    }

    const storedMainAcc = String(entry.mainAccount || "").toLowerCase().trim();
    const inputMainAcc = String(resolvedMainAccount || "").toLowerCase().trim();
    const storedPass = String(entry.password || "").trim();
    const inputPass = String(beneficiaryLoginData.password || "").trim();

    console.log("[Beneficiary-Login] Diagnostic Comparison:", {
      providedPatientId: beneficiaryLoginData.mainAccount,
      resolvedPatientWallet: inputMainAcc,
      storedPatientWallet: storedMainAcc,
      passwordsMatch: storedPass === inputPass
    });

    if (storedMainAcc === inputMainAcc && storedPass === inputPass) {
      setActingAsAccount(resolvedMainAccount);
      setRole("patient");
      setShowBeneficiaryLogin(false);
      localStorage.setItem('hedera_hc_role', 'patient');
      toast.success(`Access granted for account: ${resolvedMainAccount}`);

      // NOTIFICATION: Check if this beneficiary was newly added
      try {
        const notifyKey = `beneficiary_notifications_${beneficiaryWallet.toLowerCase()}`;
        const storedNotif = JSON.parse(localStorage.getItem(notifyKey) || "[]");
        if (storedNotif.length > 0) {
          storedNotif.forEach(n => {
            toast.info(`📢 NEW: You were added as a beneficiary by patient ${n.patient.slice(0, 10)}...`, { autoClose: false });
          });
          localStorage.removeItem(notifyKey); // Clear after showing
        }
      } catch (e) { console.warn("Notification check failed", e); }
    } else if (storedMainAcc !== inputMainAcc) {
      console.error("[Beneficiary-Login] Account mismatch detected.");
      toast.error(`Account Mismatch: Stored (${storedMainAcc.slice(0, 8)}...) != Input (${inputMainAcc.slice(0, 8)}...). Please Refresh (Ctrl+F5) and try again.`);
    } else {
      console.error("[Beneficiary-Login] Password mismatch detected.");
      toast.error("Invalid password for this beneficiary. (If you just updated it, Please Refresh Ctrl+F5)");
    }
  };

  const handleTabChange = (tab) => setActiveTab(tab);

  const handleSwitchRole = () => {
    if (availableRoles.length > 1) {
      setShowContextSelection(true);
      setRole(null);
      setActiveTab("dashboard");
    } else {
      toast.info("No other roles available for this wallet.");
    }
  };


  const grantConsent = async (hospitalAddress, purpose, scope, duration) => {
    if (!consentContract) return;
    try {
      // DPDP PROTOTYPE OPTIMIZATION: 
      // If scope looks like a CID, prioritize it for the dataHash (clinical link)
      const actualDataHash = (scope && (scope.startsWith('Qm') || scope.length > 30)) ? scope : "QmMedicalReportHash";
      const actualDataScope = (scope && scope.startsWith('Qm')) ? "Clinical Record" : (scope || "All");

      const tx = await consentContract.grantConsent(
        hospitalAddress,
        purpose,
        actualDataHash,
        actualDataScope,
        duration || 86400,
        { gasLimit: 1000000 }
      );
      await tx.wait();
      loadConsents();
      toast.success("Consent & Record Link Anchored on Blockchain");
    } catch (err) {
      console.error("Grant failed", err);
      // Enhanced error reporting for contract reverts
      let errorMsg = err.reason || err.message;
      if (err.data && err.data.includes("0x08c379a0")) { // Error(string) selector
        if (err.data.includes("466964756369617279206e6f7420617070726f766564")) { // "Fiduciary not approved"
          errorMsg = "Fiduciary not approved in Registry. Ensure the entity is registered and approved.";
        }
      }
      toast.error("Grant failed: " + errorMsg);
    }
  };

  const revokeConsent = async (index) => {
    try {
      const tx = await consentContract.revokeConsent(index, { gasLimit: 1000000 });
      await tx.wait();
      loadConsents();
      toast.success("Consent Revoked");
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') {
        console.log("Revoke transaction cancelled by user");
        return; // Silent return for manual cancellation
      }
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
    const target = actingAsAccount || account;
    if (!consentContract || !target) return;
    try {
      // Normalize to hex to avoid ENS resolution attempts on non-ENS networks (Hedera)
      let safeAccount = target;
      try { safeAccount = ethers.getAddress(target); } catch (e) { console.warn("Invalid account format for ENS safety check", e); }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const readContract = consentContract.connect(provider);

      const res = await getSafePatientConsents(readContract, safeAccount, CONSENT_MANAGER, provider);
      console.log("[App] loadConsents result for", safeAccount, ":", res.length, "consents", res.map(c => ({ active: c.isActive, expiry: Number(c.expiry), purpose: c.purpose })));
      setConsents(res);
    } catch (err) {
      console.error("Consent Load Failure:", err);
      toast.error("Failed to load consents: " + (err.reason || err.message));
    }
  };

  const registerHospital = async (name, license) => {
    if (!registryContract) return;
    try {
      const tx = await registryContract.registerFiduciary(name, license);
      await tx.wait();
      toast.success("Registration Submitted");
    } catch (err) {
      toast.error("Registration failed: " + (err.reason || err.message));
    }
  };

  const performEmergencyAccess = async (patientAddress, justification, attendingName) => {
    if (!auditLogContract || !account) return;
    try {
      const safePatient = await resolveWalletAddress(patientAddress, walletMapperContract);
      const nowSecs = Math.floor(Date.now() / 1000);

      toast.info("🚨 INITIATING EMERGENCY BREAK-GLASS ACCESS...");

      // Log emergency event on-chain
      const tx = await auditLogContract.logDataAccessed(
        safePatient,
        account,
        `EMERGENCY_ACCESS [By: ${attendingName || "Standard Admin"}]: ${justification}`,
        nowSecs,
        { gasLimit: 1000000 }
      );
      await tx.wait();

      toast.success("Emergency Access Logged. You may now attempt to fetch data.");
      return true;
    } catch (err) {
      console.error("Emergency Access Failed:", err);
      toast.error("Emergency log failed: " + (err.reason || err.message));
      return false;
    }
  };

  const monitorAccessSpam = async (patientWallet) => {
    if (!consentContract || !patientWallet) return [];
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const readContract = consentContract.connect(provider);
      const requests = await readContract.getPendingRequests(patientWallet);

      // Analysis: Flag providers with more than 3 pending requests
      const counts = {};
      requests.forEach(r => {
        counts[r.provider] = (counts[r.provider] || 0) + 1;
      });

      return Object.keys(counts).filter(p => counts[p] > 3);
    } catch (err) {
      console.warn("Spam monitoring failed", err);
      return [];
    }
  };

  const accessPatientData = async (patientInput, scope, purpose) => {
    if (!accessContract || !consentContract) return;
    try {
      // Resolve Short ID to Wallet Address before contract call
      const patient = await resolveWalletAddress(patientInput, walletMapperContract);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const readContract = consentContract.connect(provider);

      const res = await getSafePatientConsents(readContract, patient, CONSENT_MANAGER, provider);
      const consentIndex = res.findIndex(c =>
        c.isActive &&
        c.dataFiduciary.toLowerCase() === account.toLowerCase() &&
        Number(c.expiry) > Date.now() / 1000 &&
        (c.dataScope === "All" || c.dataScope === scope)
      );

      if (consentIndex === -1) {
        toast.error("No active consent found for this scope. Please request access first.");
        return;
      }

      const tx = await accessContract.accessData(patient, consentIndex, scope || "All", purpose || "Clinical Purpose", { gasLimit: 1000000 });
      await tx.wait();
      toast.success("Data Accessed & Logged");
      return true; // Success
    } catch (err) {
      console.error(err);
      toast.error("Access Denied: " + (err.reason || err.message));
      return false;
    }
  };

  const requestConsent = async (patientInput, purpose) => {
    if (!consentContract) return;
    try {
      const patientAddress = await resolveWalletAddress(patientInput, walletMapperContract);
      const tx = await consentContract.requestAccess(patientAddress, purpose, { gasLimit: 1000000 });
      await tx.wait();
      toast.success("Consent Request Sent to Patient");
    } catch (err) {
      toast.error("Request failed: " + (err.reason || err.message));
    }
  };

  useEffect(() => {
    if (consentContract && account) loadConsents();
  }, [consentContract, account, role, actingAsAccount]);

  useEffect(() => {
    if (!auditLogContract || !account) return;

    const accessedFilter = auditLogContract.filters.DataAccessed(account);
    const requestedFilter = auditLogContract.filters.AccessRequested(account);

    const onAccessed = (principal, fiduciary, purpose, timestamp) => {
      const isEmergency = purpose.includes('EMERGENCY_ACCESS') || purpose.includes('Break-Glass');
      const msg = isEmergency
        ? `🚨 URGENT: Emergency glass-break access initiated for your wallet by ${fiduciary.slice(0, 10)}...! Reason: ${purpose}`
        : `🚨 DPDP ALERT: Data accessed by ${fiduciary.slice(0, 10)}... for ${purpose}`;

      if (isEmergency) {
        toast.error(msg, { autoClose: false, closeOnClick: false, draggable: false });
      } else {
        toast.info(msg, { autoClose: 10000 });
      }
      setNotifications(prev => [{ msg, time: Date.now(), type: isEmergency ? 'emergency' : 'access' }, ...prev]);
    };

    const onRequested = (principal, fiduciary, purpose, timestamp) => {
      const msg = `📩 NEW REQUEST: ${fiduciary.slice(0, 10)}... requesting access for ${purpose}`;
      toast.warn(msg, { autoClose: 15000 });
      setNotifications(prev => [{ msg, time: Date.now(), type: 'request' }, ...prev]);
    };

    auditLogContract.on(accessedFilter, onAccessed);
    auditLogContract.on(requestedFilter, onRequested);

    return () => {
      auditLogContract.off(accessedFilter, onAccessed);
      auditLogContract.off(requestedFilter, onRequested);
    }
  }, [auditLogContract, account]);

  const renderDashboard = () => {
    const commonProps = {
      account,
      consentContract,
      registryContract,
      auditLogContract,
      accessContract,
      medicalRecordsContract,
      walletMapperContract,
      rbacContract,
      hapiProvider: window.hapiProvider // Explicit read-only RPC provider
    };
    const r = role?.toLowerCase();

    switch (r) {
      case "hospital": return <HospitalDashboard {...commonProps} onRegisterHospital={registerHospital} onAccessPatientData={accessPatientData} onRequestConsent={requestConsent} onEmergencyAccess={performEmergencyAccess} />;
      case "lab": return <LabDashboard {...commonProps} onRequestConsent={requestConsent} onAccessPatientData={accessPatientData} />;
      case "doctor": return <DoctorDashboard {...commonProps} onRequestConsent={requestConsent} onAccessPatientData={accessPatientData} onEmergencyAccess={performEmergencyAccess} />;
      case "pharmacy": return <PharmacyDashboard {...commonProps} onRequestConsent={requestConsent} onAccessPatientData={accessPatientData} />;
      case "insurance": return <InsuranceDashboard {...commonProps} onRequestConsent={requestConsent} onAccessPatientData={accessPatientData} />;
      case "auditor": return <RegulatorDashboard {...commonProps} />;
      case "admin": return <AdminDashboard {...commonProps} account={account} />;
      default: return <PatientDashboard {...commonProps} account={actingAsAccount || account} isActingAsBeneficiary={!!actingAsAccount} consents={consents} onGrantConsent={grantConsent} onRevokeConsent={revokeConsent} onEraseConsent={eraseConsent} onLoadConsents={loadConsents} onMonitorSpam={monitorAccessSpam} />;
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
            onAdmin={connectAdmin}
          />
          <div className="landing-page animate-fade-in" style={{ padding: '80px 0 0 0', maxWidth: '100%', margin: '0', position: 'relative', overflow: 'hidden', background: '#F0F4F2' }}>
            <MedicalBackground />
            <FloatingPortals />

            {/* Professional SaaS Hero Section (Stripe/Vercel style) */}
            <div className="hero-section" style={{
              padding: '8rem 2rem 4rem 2rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center',
              position: 'relative',
              zIndex: 2,
              animation: 'countUp 0.8s ease-out forwards'
            }}>
              <div style={{ maxWidth: '960px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* SaaS Badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '6px 16px',
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid #E2E8F0',
                  borderRadius: '100px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '2.5rem',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  cursor: 'default',
                  transition: 'transform 0.3s ease'
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span style={{ width: 8, height: 8, background: '#10B981', borderRadius: '50%', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }}></span>
                  Secure Consent Management <span style={{ color: '#94A3B8' }}>|</span> <span style={{ color: '#3A73E7' }}>v2.4 Released</span>
                </div>

                {/* Headline */}
                <h1 style={{
                  color: '#0F172A',
                  fontSize: 'clamp(3.5rem, 6vw, 5.5rem)',
                  fontWeight: '900',
                  lineHeight: '1.05',
                  letterSpacing: '-0.04em',
                  marginBottom: '2rem',
                  textShadow: '0 4px 24px rgba(0,0,0,0.03)'
                }}>
                  Take Control of Your <br />
                  <span style={{
                    background: 'linear-gradient(135deg, #A8C256 0%, #6A8F90 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    display: 'inline-block'
                  }}>
                    Medical Data
                  </span>
                </h1>

                {/* Subtitle */}
                <p style={{
                  fontSize: '1.25rem',
                  color: '#687D75',
                  maxWidth: '640px',
                  marginBottom: '3.5rem',
                  lineHeight: '1.6',
                  fontWeight: '400'
                }}>
                  Ojasraksha is a blockchain-powered consent platform that lets patients control who accesses their health records while enabling hospitals to stay compliant.
                </p>

                {/* CTA Buttons */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={connectWallet}
                    style={{
                      background: '#315046',
                      color: 'white',
                      border: 'none',
                      padding: '0 2rem',
                      height: '52px',
                      borderRadius: '14px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 4px 12px rgba(49,80,70,0.15)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px -6px rgba(49,80,70,0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(49,80,70,0.15)';
                    }}
                  >
                    Access Patient Portal
                    <ArrowRight size={20} strokeWidth={2.5} />
                  </button>

                  <button
                    onClick={() => setShowBeneficiaryLogin(true)}
                    style={{
                      background: 'rgba(241,245,249,0.8)',
                      backdropFilter: 'blur(10px)',
                      color: '#0F172A',
                      border: '1px solid #E2E8F0',
                      padding: '0 2rem',
                      height: '52px',
                      borderRadius: '14px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#FFFFFF';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px -8px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(241,245,249,0.8)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                    }}
                  >
                    Beneficiary Access
                  </button>
                </div>
              </div>
            </div>

            <ShieldDiagram />
            <TrustBar />
            <StandardTrust />
            <EnhancedFeatures />
            <SecurityArchitecture />

            {/* Ojasraksha Command Center Section */}
            <div style={{ padding: '8rem 2rem', background: 'linear-gradient(180deg,#F0F4F2 0%,#F0F4F2 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              {/* Decorative blobs */}
              <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(168,194,86,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '-60px', right: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(106,143,144,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />

              <div style={{ maxWidth: '980px', width: '100%', position: 'relative', zIndex: 2 }}>
                {/* Section label */}
                <p style={{ textAlign: 'center', fontWeight: '800', fontSize: '0.72rem', letterSpacing: '0.15em', color: '#6A8F90', textTransform: 'uppercase', marginBottom: '1rem' }}>
                  LIVE PLATFORM PREVIEW
                </p>
                <h2 style={{
                  textAlign: 'center', fontSize: '3rem', fontWeight: '900', color: '#315046',
                  marginBottom: '1rem', lineHeight: 1.1, letterSpacing: '-0.03em'
                }}>
                  See <span style={{ background: 'linear-gradient(135deg,#A8C256,#6A8F90,#D4A373)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', display: 'inline-block' }}>Ojasraksha</span> in Action
                </h2>
                <p style={{ textAlign: 'center', color: '#64748B', fontSize: '1.05rem', maxWidth: '520px', margin: '0 auto 3.5rem auto', lineHeight: 1.65 }}>
                  Every consent, every access, every audit — captured on-chain in real time.
                </p>

                {/* Command Center Window */}
                <div style={{
                  background: 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(24px)',
                  borderRadius: '24px',
                  boxShadow: '0 8px 80px rgba(59,130,246,0.12), 0 2px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                  overflow: 'hidden',
                  border: '1px solid rgba(226,232,240,0.8)',
                }}>
                  {/* Title bar */}
                  <div style={{
                    background: 'linear-gradient(135deg,#315046 0%,#1F332C 100%)',
                    padding: '16px 24px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#FC5F5A', display: 'inline-block', boxShadow: '0 0 6px #FC5F5A80' }} />
                    <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#FDBC40', display: 'inline-block', boxShadow: '0 0 6px #FDBC4080' }} />
                    <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#34C64B', display: 'inline-block', boxShadow: '0 0 6px #34C64B80' }} />
                    <span style={{ marginLeft: 16, fontWeight: '700', fontSize: '0.78rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>OJASRAKSHA COMMAND CENTER</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', animation: 'shieldPulse 2s ease-in-out infinite' }} />
                      <span style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: '700', letterSpacing: '0.08em' }}>LIVE</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ display: 'flex', minHeight: '360px' }}>
                    {/* Sidebar */}
                    <div style={{ width: '200px', flexShrink: 0, borderRight: '1px solid #F1F5F9', padding: '1.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '4px', background: '#FAFBFF' }}>
                      {[
                        { icon: '🔵', label: 'Overview', active: true },
                        { icon: '❤️', label: 'Health Records', active: false },
                        { icon: '📋', label: 'Consent History', active: false },
                        { icon: '🔒', label: 'Security', active: false },
                      ].map(item => (
                        <div key={item.label} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 14px', borderRadius: '10px',
                          background: item.active ? 'linear-gradient(135deg,#EEF2FF,#E0E7FF)' : 'transparent',
                          fontWeight: item.active ? '700' : '500',
                          color: item.active ? '#3730A3' : '#94A3B8',
                          fontSize: '0.85rem', cursor: 'default',
                          borderLeft: item.active ? '2px solid #6366F1' : '2px solid transparent',
                          transition: 'all 0.2s ease'
                        }}>
                          <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                          {item.label}
                        </div>
                      ))}
                    </div>

                    {/* Main panel */}
                    <div style={{ flex: 1, padding: '2rem' }}>
                      {/* Stat cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.75rem' }}>
                        {[
                          { label: 'TOTAL CONSENTS', value: '6.2k', color: '#3B82F6', bar: '78%' },
                          { label: 'ACTIVE REQUESTS', value: '142', color: '#6366F1', bar: '45%' },
                          { label: 'SECURITY SCORE', value: '99.8%', color: '#10B981', bar: '99.8%' },
                        ].map(s => (
                          <div key={s.label} className="cmd-stat-card" style={{
                            background: 'linear-gradient(145deg,#F6F8FA,#FFFFFF)',
                            border: '1px solid #E8EDF5',
                            borderRadius: '16px', padding: '1.5rem',
                            position: 'relative', overflow: 'hidden'
                          }}>
                            {/* Top progress bar */}
                            <div style={{ position: 'absolute', top: 0, left: 0, height: '3px', width: '100%', background: '#F1F5F9', borderRadius: '16px 16px 0 0' }}>
                              <div style={{ height: '100%', width: s.bar, background: `linear-gradient(90deg,${s.color},${s.color}99)`, borderRadius: '16px 16px 0 0', transition: 'width 1.5s ease' }} />
                            </div>
                            <p style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.1em', color: '#94A3B8', marginBottom: '0.6rem', textTransform: 'uppercase' }}>{s.label}</p>
                            <p style={{ fontSize: '2.2rem', fontWeight: '900', color: '#0F172A', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: s.color, fontWeight: '700' }}>↑ trending up</div>
                          </div>
                        ))}
                      </div>

                      {/* Audit stream */}
                      <div style={{ background: 'linear-gradient(145deg,#F6F8FA,#F0F6FF)', border: '1px solid #E8EDF5', borderRadius: '16px', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'shieldPulse 2s ease-in-out infinite', flexShrink: 0 }} />
                            <p style={{ fontWeight: '800', color: '#0F172A', fontSize: '0.95rem', margin: 0 }}>Live Audit Stream</p>
                          </div>
                          <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#3B82F6', background: '#EFF6FF', padding: '3px 10px', borderRadius: '100px', letterSpacing: '0.06em' }}>ON-CHAIN</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {[
                            { id: 'PAT-8921', action: 'Consent Granted', status: 'VERIFIED', ok: true, time: '2s ago' },
                            { id: 'DOC-3321', action: 'Data Accessed', status: 'VERIFIED', ok: true, time: '18s ago' },
                            { id: 'PAT-1142', action: 'Key Revoked', status: 'ALERT', ok: false, time: '1m ago' },
                          ].map(entry => (
                            <div key={entry.id} className="audit-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px', borderBottom: '1px solid #E8EDF5', transition: 'all 0.2s ease' }}>
                              <span style={{ fontSize: '0.82rem', color: '#475569', fontFamily: 'monospace', width: '90px', fontWeight: '600' }}>{entry.id}</span>
                              <span style={{ fontSize: '0.85rem', color: '#475569', flex: 1, textAlign: 'center' }}>{entry.action}</span>
                              <span style={{ fontSize: '0.65rem', color: '#94A3B8', marginRight: '14px' }}>{entry.time}</span>
                              <span style={{
                                fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.07em',
                                padding: '4px 12px', borderRadius: '100px',
                                background: entry.ok ? 'linear-gradient(135deg,#D1FAE5,#A7F3D0)' : 'linear-gradient(135deg,#FEE2E2,#FECACA)',
                                color: entry.ok ? '#065F46' : '#991B1B',
                                boxShadow: entry.ok ? '0 2px 6px rgba(16,185,129,0.2)' : '0 2px 6px rgba(239,68,68,0.2)'
                              }}>{entry.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer style={{
              background: 'linear-gradient(180deg, #1F332C 0%, #15231F 100%)',
              borderTop: '2px solid #315046',
              padding: '6rem 2rem 3rem 2rem',
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <style>{`
                .footer-link-premium { transition: all 0.3s ease; }
                .footer-link-premium:hover { color: #A8C256 !important; transform: translateX(5px); }
              `}</style>
              <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '4rem', marginBottom: '4rem', width: '100%', justifyContent: 'space-between' }}>
                  {/* Brand Section */}
                  <div>
                    <div style={{ marginBottom: '2.5rem' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '20px',
                        border: '1px solid rgba(168, 194, 86, 0.2)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 0 20px rgba(255,255,255,0.05)'
                      }}>
                        <img
                          src="/logo.jpg"
                          alt="Ojasraksha Logo"
                          style={{ height: '72px', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                    <p style={{ color: '#A3B3AF', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: '280px', marginBottom: '2rem' }}>
                      Pioneering the future of HIPAA and GDPR compliant health data governance.
                    </p>
                  </div>

                  {/* Compliance */}
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.15em', color: '#A8C256', textTransform: 'uppercase', marginBottom: '2rem' }}>Compliance</p>
                    <a href="/dpdp.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#A3B3AF', fontSize: '0.95rem', textDecoration: 'none', transition: 'color 0.2s ease', display: 'block', marginBottom: '1rem' }}
                      onMouseEnter={e => e.target.style.color = 'white'}
                      onMouseLeave={e => e.target.style.color = '#A3B3AF'}
                    >
                      DPDP Act 2023
                    </a>
                  </div>

                  {/* Contact */}
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.15em', color: '#A8C256', textTransform: 'uppercase', marginBottom: '2rem' }}>Contact</p>
                    <a href="mailto:ojasraksha@gmail.com" style={{ color: '#A3B3AF', fontSize: '0.95rem', textDecoration: 'none', transition: 'color 0.2s ease' }}
                      onMouseEnter={e => e.target.style.color = 'white'}
                      onMouseLeave={e => e.target.style.color = '#A3B3AF'}
                    >
                      ojasraksha@gmail.com
                    </a>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(168, 194, 86, 0.1)', paddingTop: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                  <span style={{ color: '#6A8F90', fontSize: '0.9rem', fontWeight: '500' }}>
                    © 2026 Ojasraksha Inc. All rights reserved.
                  </span>
                  <div style={{ display: 'flex', gap: '2rem' }}>
                    {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(l => (
                      <span key={l} style={{
                        color: '#6A8F90', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '500',
                        transition: 'color 0.2s ease'
                      }}
                        onMouseEnter={e => e.target.style.color = '#A8C256'}
                        onMouseLeave={e => e.target.style.color = '#6A8F90'}
                      >{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </>
      ) : showContextSelection ? (
        <div className="context-selection-screen animate-fade-in" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ maxWidth: '900px', width: '90%', padding: '4rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '800' }}>Identity Verified</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '3.5rem', fontSize: '1.1rem' }}>
              Authentication successful for <code>{account.slice(0, 10)}...{account.slice(-8)}</code>. <br />
              Please select the clinical portal you wish to access:
            </p>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {availableRoles.map(r => (
                <button
                  key={r}
                  className="glass-panel floating-card"
                  onClick={() => {
                    setRole(r.toLowerCase());
                    localStorage.setItem('hedera_hc_role', r.toLowerCase());
                    setShowContextSelection(false);
                  }}
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
            onAdmin={connectAdmin}
            onSwitchRole={handleSwitchRole}
          />
          <div className="app-body" style={{ marginTop: '80px' }}>
            {role && <Sidebar role={role} activeTab={activeTab} onTabChange={handleTabChange} />}
            <main className="main-content">
              {(activeTab === "audit" && (role?.toLowerCase() === 'patient' || role?.toLowerCase() === 'admin')) ? <AuditLogs auditLogContract={auditLogContract} account={actingAsAccount || account} role={role} /> :
                (activeTab === "internal-audit" && ['hospital', 'doctor', 'lab', 'pharmacy', 'insurance'].includes(role?.toLowerCase())) ? <AuditLogs auditLogContract={auditLogContract} account={account} role={role} /> :
                  activeTab === "compliance" ? <LegalCompliance /> :
                    renderDashboard()}
            </main>
          </div>
        </>
      )}

      {showBeneficiaryLogin && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Beneficiary Access</h3>
              <button className="close-btn" onClick={() => setShowBeneficiaryLogin(false)}>×</button>
            </div>
            <form onSubmit={handleBeneficiaryLogin} className="modal-body">
              <div className="form-group">
                <label>Main Patient Address</label>
                <input
                  type="text"
                  className="glass-input"
                  value={beneficiaryLoginData.mainAccount}
                  onChange={(e) => setBeneficiaryLoginData({ ...beneficiaryLoginData, mainAccount: e.target.value })}
                  placeholder="0x..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Access Password</label>
                <input
                  type="password"
                  className="glass-input"
                  value={beneficiaryLoginData.password}
                  onChange={(e) => setBeneficiaryLoginData({ ...beneficiaryLoginData, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Request Access</button>
                <button type="button" className="secondary-btn" onClick={() => setShowBeneficiaryLogin(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;