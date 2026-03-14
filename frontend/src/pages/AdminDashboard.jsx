import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";

// Use the provided Role Based Smart Contract Address
const RBAC_ADDRESS = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";

const roleABI = [
  "function registerRole(address user, uint8 role)",
  "function updateRole(address user, uint8 role)",
  "function getRole(address user) view returns (uint8)",
  "event RoleAssigned(address indexed user, uint8 role)",
  "event RoleUpdated(address indexed user, uint8 role)"
];

export default function AdminDashboard() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeRoles, setActiveRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(RBAC_ADDRESS, roleABI, provider);

      const localReqs = JSON.parse(localStorage.getItem('dpdp_role_requests') || '[]');
      setPendingRequests(localReqs.filter(r => r.status === 'pending'));

      // Check on-chain mapped status for all known wallets
      const uniqueWallets = [...new Set(localReqs.map(r => r.wallet))];
      const active = [];

      for (const rawWallet of uniqueWallets) {
        try {
          const safeWallet = ethers.getAddress(rawWallet);
          const roleId = await contract.getRole(safeWallet);
          if (Number(roleId) !== 0) {
            active.push({ wallet: safeWallet, roleId: Number(roleId) });
          }
        } catch (e) {
          console.warn("Invalid wallet address or RPC error for:", rawWallet);
        }
      }
      setActiveRoles(active);
    } catch (err) {
      console.error("Error loading admin data", err);
      setError("Failed to fetch blockchain data. Please ensure your wallet is connected to the correct network.");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleName = (id) => {
    switch (Number(id)) {
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

  const approveRequest = async (req) => {
    try {
      setIsLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(RBAC_ADDRESS, roleABI, signer);

      let safeWallet = req.wallet;
      try { safeWallet = ethers.getAddress(req.wallet); } catch (e) {
        toast.error("Invalid wallet address format");
        return;
      }

      toast.info(`On-chaining ${req.orgName} as ${getRoleName(req.roleId)}...`);

      const tx = await contract.registerRole(safeWallet, Number(req.roleId), { gasLimit: 1000000 });
      await tx.wait();

      const localReqs = JSON.parse(localStorage.getItem('dpdp_role_requests') || '[]');
      const updatedReqs = localReqs.map(r =>
        (r.wallet.toLowerCase() === req.wallet.toLowerCase() && r.timestamp === req.timestamp)
          ? { ...r, status: 'approved' }
          : r
      );
      localStorage.setItem('dpdp_role_requests', JSON.stringify(updatedReqs));

      toast.success("Identity role successfully mapped on blockchain");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Transaction failed: " + (err.reason || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const revokeRole = async (wallet) => {
    try {
      setIsLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(RBAC_ADDRESS, roleABI, signer);

      const tx = await contract.updateRole(wallet, 0, { gasLimit: 1000000 });
      await tx.wait();

      toast.success("Identity permissions revoked from ledger");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Revoke failed: " + (err.reason || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h2>Governance & Access Control</h2>
          <p style={{ color: "var(--sas-text-dim)", fontSize: "0.95rem", marginTop: "0.4rem" }}>
            Manage DPDP Compliance roles and on-chain organization identity.
          </p>
        </div>
        <div className="dashboard-actions">
          <button className="secondary-sas-btn" onClick={loadData} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh Ledger Status"}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="dashboard-section glass-panel">
        <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h3>Organization Requests</h3>
          <span className="status-badge pending">{pendingRequests.length} Pending</span>
        </div>
        
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Wallet Address</th>
                <th>Requested Role</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--sas-text-dim)' }}>
                    No pending organization requests found.
                  </td>
                </tr>
              ) : (
                pendingRequests.map((req, index) => (
                  <tr key={index}>
                    <td>
                      <div style={{ fontWeight: 800 }}>{req.orgName}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Mapped via LocalStorage</div>
                    </td>
                    <td><code style={{ fontSize: '0.9rem', color: 'var(--sas-primary)' }}>{req.wallet.slice(0, 10)}...{req.wallet.slice(-8)}</code></td>
                    <td><span className="status-badge approved" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--sas-primary)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>{getRoleName(req.roleId)}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="primary-sas-btn" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }} onClick={() => approveRequest(req)} disabled={isLoading}>
                        Authorize & Map
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-section glass-panel" style={{ marginTop: '2rem' }}>
        <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h3>Active Ledger Mappings</h3>
          <span className="status-badge active">{activeRoles.length} Verified</span>
        </div>
        
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Verified Wallet</th>
                <th>Functional Role</th>
                <th>Identity Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeRoles.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--sas-text-dim)' }}>
                    No active on-chain mappings detected.
                  </td>
                </tr>
              ) : (
                activeRoles.map((roleInfo, index) => (
                  <tr key={index}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{roleInfo.wallet}</td>
                    <td><span className="status-badge approved">{getRoleName(roleInfo.roleId)}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: 800, fontSize: '0.85rem' }}>
                        <div className="status-dot"></div> Verified
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="secondary-sas-btn"
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                        onClick={() => revokeRole(roleInfo.wallet)}
                        disabled={isLoading}
                      >
                        Revoke Access
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}