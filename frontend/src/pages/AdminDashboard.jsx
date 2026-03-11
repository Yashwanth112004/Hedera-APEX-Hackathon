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
      <div className="dashboard-header">
        <h2>Organization Role Mapping & Access Control</h2>
        <div className="dashboard-actions">
          <button className="secondary-btn" onClick={loadData}>Refresh Data</button>
        </div>
      </div>

      <div className="dashboard-section glass-panel">
        <h3>Pending Organization Requests</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Organizations requesting system roles. Approve them to map their wallet address using the Role smart contract.
        </p>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Organization Name</th>
                <th>Wallet Address</th>
                <th>Requested Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No pending requests</td>
                </tr>
              ) : (
                pendingRequests.map((req, index) => (
                  <tr key={index}>
                    <td>{req.orgName}</td>
                    <td><span title={req.wallet}>{req.wallet.slice(0, 6)}...{req.wallet.slice(-4)}</span></td>
                    <td>{getRoleName(req.roleId)}</td>
                    <td>
                      <button className="primary-btn" onClick={() => approveRequest(req)}>
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

      <div className="dashboard-section glass-panel" style={{ marginTop: '2rem' }}>
        <h3>Active Blockchain Mappings</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Wallets actively mapped to functional roles on the ledger. Revoking permission reduces their role back to 0.
        </p>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Wallet Address</th>
                <th>Mapped Role</th>
                <th>Status</th>
                <th>Action (Revoke)</th>
              </tr>
            </thead>
            <tbody>
              {activeRoles.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No active mapped roles found</td>
                </tr>
              ) : (
                activeRoles.map((roleInfo, index) => (
                  <tr key={index}>
                    <td style={{ fontFamily: 'monospace' }}>{roleInfo.wallet}</td>
                    <td>{getRoleName(roleInfo.roleId)}</td>
                    <td>
                      <span className="status-badge active" style={{ backgroundColor: 'var(--success-color)', filter: 'brightness(0.8)' }}>
                        Active User
                      </span>
                    </td>
                    <td>
                      <button
                        className="secondary-btn"
                        style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                        onClick={() => revokeRole(roleInfo.wallet)}
                      >
                        Revoke Logic Access
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