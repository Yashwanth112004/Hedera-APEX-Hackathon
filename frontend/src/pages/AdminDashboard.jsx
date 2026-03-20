import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";

// Use the provided Role Based Smart Contract Address
const RBAC_ADDRESS = "0x0b11e9AA48bf573A8E9d1D5085b71d8c58de9968";
const LEGACY_RBAC = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";
const HARDCODED_ADMIN = "0x04Fee3FD1B338d12FFD6dBD8d66dE1e8e0BB99cB";

const roleABI = [
  "function registerRole(address user, uint8 role)",
  "function updateRole(address user, uint8 role)",
  "function getRole(address user) view returns (uint8)",
  "function isAdmin(address user) view returns (bool)"
];

export default function AdminDashboard({ account }) {

  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeRoles, setActiveRoles] = useState([]);
  const [activeTab, setActiveTab] = useState('roles'); // 'roles' or 'grievances'
  const [grievances, setGrievances] = useState([]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedGrievance, setSelectedGrievance] = useState(null);

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
          let roleId = await contract.getRole(safeWallet);

          // FALLBACK: Check secondary RBAC for legacy mappings
          if (Number(roleId) === 0) {
            try {
              const secondaryRBAC = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";
              const secondaryContract = new ethers.Contract(secondaryRBAC, roleABI, provider);
              const legacyId = await secondaryContract.getRole(safeWallet);
              if (Number(legacyId) !== 0) roleId = legacyId;
            } catch (e) { }
          }

          if (Number(roleId) !== 0) {
            active.push({ wallet: safeWallet, roleId: Number(roleId) });
          }
        } catch (e) {
          console.warn("Could not fetch role, invalid address format:", rawWallet);
        }
      }

      setActiveRoles(active);

      // --- GRIEVANCE SYNC ---
      const localGrievances = JSON.parse(localStorage.getItem('dpdp_grievances') || '[]');
      setGrievances(localGrievances.reverse());

    } catch (err) {
      console.error("Error loading admin data", err);
    } finally {
      // Always sync grievances from local storage as fallback/primary
      const localGrievances = JSON.parse(localStorage.getItem('dpdp_grievances') || '[]');
      setGrievances([...localGrievances].reverse());
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

      let tx;
      try {
        console.log("Attempting mapping on Primary RBAC:", RBAC_ADDRESS);
        tx = await contract.registerRole(safeWallet, Number(req.roleId), { gasLimit: 1000000 });
        await tx.wait();
      } catch (primaryErr) {
        console.warn("Primary RBAC failed (or reverted), attempting LEGACY fallback...", primaryErr.message);
        if (primaryErr.message.toLowerCase().includes("user rejected")) throw primaryErr;
        
        const legacyContract = new ethers.Contract(LEGACY_RBAC, roleABI, signer);
        tx = await legacyContract.registerRole(safeWallet, Number(req.roleId), { gasLimit: 1000000 });
        await tx.wait();
      }

      const localReqs = JSON.parse(localStorage.getItem('dpdp_role_requests') || '[]');
      const updatedReqs = localReqs.map(r =>
        (r.wallet.toLowerCase() === req.wallet.toLowerCase() && r.timestamp === req.timestamp)
          ? { ...r, status: 'approved' }
          : r
      );
      localStorage.setItem('dpdp_role_requests', JSON.stringify(updatedReqs));

      toast.success("Role successfully mapped on blockchain");
      loadData();
    } catch (err) {
      console.error("Mapping failed:", err);
      const reason = err.reason || err.message || "Unknown contract error";
      toast.error(`Mapping failed: ${reason}`);
      
      if (reason.toLowerCase().includes("reverted") || reason.toLowerCase().includes("only admin") || err.code === "CALL_EXCEPTION") {
        toast.warning("AUTHORIZATION ERROR: Your wallet is not a registered Admin on the blockchain yet.", { autoClose: 15000 });
      }
    }
};

  const revokeRole = async (wallet) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(RBAC_ADDRESS, roleABI, signer);

      let tx;
      try {
        tx = await contract.updateRole(wallet, 0, { gasLimit: 1000000 });
        await tx.wait();
      } catch (err) {
        console.warn("Primary revoke failed, trying legacy...");
        const legacyContract = new ethers.Contract(LEGACY_RBAC, roleABI, signer);
        tx = await legacyContract.updateRole(wallet, 0, { gasLimit: 1000000 });
        await tx.wait();
      }

      toast.success("Identity permissions revoked");
      loadData();
    } catch (err) {
      console.error("Revoke failed:", err);
      const reason = err.reason || err.message || "Unknown contract error";
      toast.error(`Revoke failed: ${reason}`);
    }
  };

  const updateGrievanceStatus = (id, newStatus) => {
    try {
      const existing = JSON.parse(localStorage.getItem('dpdp_grievances') || '[]');
      const updated = existing.map(g => {
        if (g.id === id) {
          const actionLog = {
            action: `Status changed to ${newStatus}`,
            admin: account,
            timestamp: new Date().toISOString()
          };
          return { 
            ...g, 
            status: newStatus,
            history: [...(g.history || []), actionLog]
          };
        }
        return g;
      });

      localStorage.setItem('dpdp_grievances', JSON.stringify(updated));
      setGrievances([...updated].reverse());
      toast.success(`Grievance ${newStatus}`);
      if (selectedGrievance?.id === id) {
        setSelectedGrievance(updated.find(g => g.id === id));
      }
    } catch (err) {
      toast.error("Failed to update grievance");
    }
  };


  const filteredGrievances = grievances.filter(g => 
    filterStatus === 'All' || g.status === filterStatus
  );

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
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-glass)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <button 
            className={activeTab === 'roles' ? 'primary-btn' : 'secondary-btn'} 
            onClick={() => setActiveTab('roles')}
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
          >
            🛡️ Role Mappings
          </button>
          <button 
            className={activeTab === 'grievances' ? 'primary-btn' : 'secondary-btn'} 
            onClick={() => setActiveTab('grievances')}
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
          >
            ⚖️ Grievances & Legal
          </button>
        </div>
        <div className="dashboard-actions">
          <button className="secondary-btn" onClick={loadData}>Sync Ledger State</button>
        </div>
      </div>

      {activeTab === 'roles' ? (
        <>

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
        </>
      ) : (
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
           <div className="dashboard-section glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <h3>Patient Grievances & Appeals</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Review legally binding complaints filed under DPDP Section 13.</p>
                </div>
                <select 
                  className="glass-input" 
                  style={{ width: '150px' }}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="New">New</option>
                  <option value="In Review">In Review</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="table-container">
                <table className="data-table">
                   <thead>
                      <tr>
                        <th>ID</th>
                        <th>User Wallet</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                   </thead>
                   <tbody>
                      {filteredGrievances.length === 0 ? (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>No grievances found matching filters.</td></tr>
                      ) : (
                        filteredGrievances.map(g => (
                          <tr key={g.id} onClick={() => setSelectedGrievance(g)} style={{ cursor: 'pointer' }}>
                             <td><span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{g.id}</span></td>
                             <td><code title={g.wallet}>{g.wallet.slice(0, 8)}...</code></td>
                             <td style={{ fontSize: '0.85rem' }}>{g.category}</td>
                             <td><span className={`status-badge ${g.status.toLowerCase().replace(' ','-')}`}>{g.status}</span></td>
                             <td>
                                <button className="secondary-btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>View Details</button>
                             </td>
                          </tr>
                        ))
                      )}
                   </tbody>
                </table>
              </div>
           </div>

           <div className="glass-panel" style={{ position: 'sticky', top: '2rem' }}>
              {selectedGrievance ? (
                <div className="animate-fade-in">
                  <h3 style={{ marginBottom: '1.5rem' }}>Grievance Details</h3>
                  <div style={{ padding: '1rem', background: 'rgba(30, 58, 138, 0.05)', borderRadius: '12px', marginBottom: '1.5rem' }}>
                     <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>INCIDENT DESCRIPTION</p>
                     <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>"{selectedGrievance.description}"</p>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                     <button className="primary-btn" style={{ background: 'var(--status-approved)' }} onClick={() => updateGrievanceStatus(selectedGrievance.id, 'Resolved')}>Resolve</button>
                     <button className="primary-btn" style={{ background: 'var(--medical-primary)' }} onClick={() => updateGrievanceStatus(selectedGrievance.id, 'In Review')}>Mark In-Review</button>
                     <button className="secondary-btn" style={{ color: 'var(--status-rejected)', borderColor: 'var(--status-rejected)' }} onClick={() => updateGrievanceStatus(selectedGrievance.id, 'Rejected')}>Reject</button>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '1.5rem 0' }} />
                  
                  <h4>Audit Trail</h4>
                  <div style={{ marginTop: '1rem' }}>
                     {(selectedGrievance.history || []).length === 0 ? (
                       <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No actions taken yet.</p>
                     ) : (
                       selectedGrievance.history.map((h, i) => (
                         <div key={i} style={{ fontSize: '0.8rem', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
                            <strong>{h.action}</strong><br/>
                            <span style={{ color: 'var(--text-muted)' }}>{new Date(h.timestamp).toLocaleString()}</span>
                         </div>
                       ))
                     )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <p>Select a grievance from the list to view full details and take action.</p>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  )
}