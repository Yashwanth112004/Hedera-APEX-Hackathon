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

  const loadData = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(RBAC_ADDRESS, roleABI, provider);

      const localReqs = JSON.parse(localStorage.getItem('dpdp_role_requests') || '[]');
      setPendingRequests(localReqs.filter(r => r.status === 'pending'));

      // Check on-chain mapped status for all known wallets instead of querying massive event logs
      // This is much safer for public testnets with rate limits like Hedera
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
          console.warn("Could not fetch role, invalid address format:", rawWallet);
        }
      }

      setActiveRoles(active);

    } catch (err) {
      console.error("Error loading admin data", err);
      const localReqs = JSON.parse(localStorage.getItem('dpdp_role_requests') || '[]');
      setPendingRequests(localReqs.filter(r => r.status === 'pending'));
    }
  };

  const getRoleName = (id) => {
    switch (Number(id)) {
      case 1: return "Hospital";
      case 2: return "Diagnostic Lab";
      case 3: return "Doctor";
      case 4: return "Pharmacy";
      case 5: return "Insurance";
      case 6: return "Regulator/Auditor";
      case 7: return "Admin";
      default: return "Patient (0)";
    }
  };

  const approveRequest = async (req) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(RBAC_ADDRESS, roleABI, signer);

      let safeWallet = req.wallet;
      try { safeWallet = ethers.getAddress(req.wallet); } catch (e) {
        toast.error("Invalid wallet address format");
        return;
      }

      toast.info(`Mapping ${req.orgName} to role ${getRoleName(req.roleId)}...`);

      const tx = await contract.registerRole(safeWallet, Number(req.roleId), { gasLimit: 1000000 });
      await tx.wait();

      const localReqs = JSON.parse(localStorage.getItem('dpdp_role_requests') || '[]');
      const updatedReqs = localReqs.map(r =>
        (r.wallet.toLowerCase() === req.wallet.toLowerCase() && r.timestamp === req.timestamp)
          ? { ...r, status: 'approved' }
          : r
      );
      localStorage.setItem('dpdp_role_requests', JSON.stringify(updatedReqs));

      toast.success("Role successfully mapped on record");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Mapping failed: " + (err.reason || err.message));
    }
  };

  const revokeRole = async (wallet) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(RBAC_ADDRESS, roleABI, signer);

      const tx = await contract.updateRole(wallet, 0, { gasLimit: 1000000 });
      await tx.wait();

      toast.success("Identity permissions revoked");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Revoke failed");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--medical-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            System Governance Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Map organizational identities to blockchain roles for granular access control.</p>
        </div>
        <div className="dashboard-actions">
          <button className="secondary-btn" onClick={loadData}>Sync Ledger State</button>
        </div>
      </div>

      <div className="dashboard-section glass-panel">
        <h3>Pending Organization Requests</h3>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
          Organizations requesting functional roles. Verification ensures DPDP 2023 compliance before blockchain-anchored approval.
        </p>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Organization Name</th>
                <th>Identity (Wallet)</th>
                <th>Requested Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No pending organizational requests.</td>
                </tr>
              ) : (
                pendingRequests.map((req, index) => (
                  <tr key={index}>
                    <td><strong>{req.orgName}</strong></td>
                    <td><code title={req.wallet}>{req.wallet.slice(0, 10)}...{req.wallet.slice(-6)}</code></td>
                    <td><span className="role-badge" style={{ background: 'var(--grad-blue)', fontSize: '0.75rem' }}>{getRoleName(req.roleId)}</span></td>
                    <td>
                      <button className="primary-btn" onClick={() => approveRequest(req)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                        Approve & Map
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-section glass-panel" style={{ borderTop: '6px solid var(--medical-primary)' }}>
        <h3>Active Blockchain Mappings</h3>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
          Immutable ledger mappings of wallets to organizational roles. Revocation immediately terminates clinical data access.
        </p>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Wallet Address</th>
                <th>Mapped Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeRoles.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No active ledger mappings detected.</td>
                </tr>
              ) : (
                activeRoles.map((roleInfo, index) => (
                  <tr key={index}>
                    <td><code style={{ fontSize: '0.85rem' }}>{roleInfo.wallet}</code></td>
                    <td><span className="role-badge" style={{ background: 'var(--grad-teal)', fontSize: '0.75rem' }}>{getRoleName(roleInfo.roleId)}</span></td>
                    <td>
                      <span className="status-badge active">
                        Verified Identity
                      </span>
                    </td>
                    <td>
                      <button
                        className="secondary-btn"
                        style={{ color: 'var(--status-rejected)', borderColor: 'var(--status-rejected)', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => revokeRole(roleInfo.wallet)}
                      >
                        Revoke Token
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
  )
}