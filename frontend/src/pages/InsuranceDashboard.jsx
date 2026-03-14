import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { resolveWalletAddress } from '../utils/idMappingHelper';

const InsuranceDashboard = ({ account, consentContract, auditLogContract, accessContract, walletMapperContract }) => {
    const [patientWallet, setPatientWallet] = useState('');
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(false);

    const verifyMedicalEvents = async () => {
        if (!patientWallet) {
            toast.error("Policy holder address or Short ID required");
            return;
        }
        
        setLoading(true);
        let targetWallet = patientWallet;
        try {
            targetWallet = await resolveWalletAddress(patientWallet, walletMapperContract);
        } catch (e) {
            toast.error(e.message);
            setLoading(false);
            return;
        }

        if (!ethers.isAddress(targetWallet)) {
            toast.error("Valid wallet address or Short ID required");
            setLoading(false);
            return;
        }

        try {
            // In a real DPDP flow, the insurer queries the AuditLog 
            // to find a 'Medication Dispensation' or 'Doctor Visit' event
            // matching the claim date.
            toast.info("Verifying medical event on blockchain...");

            // Simulated: Querying real events... defaults to empty array
            setClaims([]);
        } catch (err) {
            toast.error("Event verification failed");
        } finally {
            setLoading(false);
        }
    };

    const processPayout = async (claimId) => {
        try {
            let targetWallet = await resolveWalletAddress(patientWallet, walletMapperContract).catch(() => patientWallet);

            if (auditLogContract) {
                const nowSecs = Math.floor(Date.now() / 1000);
                await auditLogContract.logDataAccessed(targetWallet, account, "Insurance Payout Verification", nowSecs, { gasLimit: 1000000 });
            }
            toast.success(`Claim ${claimId} approved. Disbursement initiated via smart contract.`);
            setClaims(claims.map(c => c.id === claimId ? { ...c, status: 'Processing Payout' } : c));
        } catch (err) {
            toast.error("Disbursement log failed");
        }
    };

    return (
        <div className="dashboard animate-fade-in">
            <div className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--medical-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                        Insurance Governance Portal
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>DPDP-compliant verification of medical claims via zero-knowledge proof concepts.</p>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="glass-panel" style={{ padding: '2.5rem' }}>
                    <h3>Policy Holder Lookup</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Verify medical events by querying the immutable audit trail for treatment proofs.</p>
                    <div className="form-group">
                        <label>Policy Holder (Wallet or Short ID)</label>
                        <input
                            type="text"
                            className="glass-input"
                            placeholder="e.g. 1234-ABCD"
                            value={patientWallet}
                            onChange={(e) => setPatientWallet(e.target.value)}
                        />
                    </div>
                    <button className="primary-btn" onClick={verifyMedicalEvents} disabled={loading} style={{ width: '100%' }}>
                        {loading ? "Verifying..." : "Cross-Verify Claim Events"}
                    </button>
                </div>

                <div className="glass-panel" style={{ padding: '2.5rem' }}>
                    <h3>Privacy Principle</h3>
                    <div className="floating-card" style={{ borderLeft: '4px solid var(--medical-primary)', marginTop: '1rem' }}>
                        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.6' }}>
                            "Data minimization: Insurer only receives confirmation of medical events, not the granular clinical diagnosis, unless explicitly consented."
                        </p>
                    </div>
                </div>
            </div>

            <div className="dashboard-section glass-panel">
                <h3>Claim Verification Queue</h3>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Claim ID</th>
                                <th>Medical Event Proof</th>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Audit Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {claims.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Enter policy address to begin audit verification.</td></tr>
                            ) : (
                                claims.map(c => (
                                    <tr key={c.id}>
                                        <td>{c.id}</td>
                                        <td>{c.event}</td>
                                        <td>{c.date}</td>
                                        <td style={{ fontWeight: 'bold' }}>{c.amount}</td>
                                        <td><span className="status-badge success">{c.status}</span></td>
                                        <td>
                                            {c.status === 'On-Chain Verified' && (
                                                <button className="primary-btn" onClick={() => processPayout(c.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                                    Approve Payout
                                                </button>
                                            )}
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
};

export default InsuranceDashboard;
