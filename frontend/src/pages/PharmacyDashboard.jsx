import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { fetchFromPinata, decryptData } from '../utils/ipfsHelper';
import { getSafePatientConsents } from '../utils/consentHelper';

const PharmacyDashboard = ({ account, consentContract, auditLogContract, accessContract, medicalRecordsContract }) => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [linkedRecords, setLinkedRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDispensing, setIsDispensing] = useState(false);
    const [decryptedRx, setDecryptedRx] = useState(null);
    const [dispensedId, setDispensedId] = useState(null);
    const [ipfsCid, setIpfsCid] = useState(''); // Added for manual/linked decryption

    const fetchPrescriptions = async () => {
        if (!medicalRecordsContract || !consentContract || !account) return;
        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const readMedical = medicalRecordsContract.connect(provider);
                const readConsent = consentContract.connect(provider);

                const rawQueue = await readMedical.getPendingPrescriptions();

                const formatted = await Promise.all(rawQueue.map(async (rx) => {
                    let authorized = false;
                    const activeLinked = [];
                    try {
                        const patientConsents = await getSafePatientConsents(readConsent, rx.patient, consentContract.target, provider);
                    patientConsents.forEach(c => {
                        if (c.dataFiduciary.toLowerCase() === account.toLowerCase() && c.isActive && Number(c.expiry) > Math.floor(Date.now() / 1000)) {
                            authorized = true;
                            if (c.dataHash) {
                                const cids = c.dataHash.split(',');
                                cids.forEach(cid => {
                                    if (cid.trim()) {
                                        activeLinked.push({
                                            cid: cid.trim(),
                                            purpose: c.purpose,
                                            patientName: rx.patientName
                                        });
                                    }
                                });
                            }
                        }
                    });
                } catch (cErr) {
                    console.error("Consent check failed for", rx.patient, cErr);
                }

                return {
                    id: rx.recordId.toString(),
                    patient: rx.patient,
                    patientName: rx.patientName,
                    cid: rx.cid,
                    status: 'Pending',
                    isAuthorized: authorized,
                    linked: activeLinked
                };
            }));

            setPrescriptions(formatted.reverse()); 
            
            // Flatten linked records for a global view if needed
            const allLinked = formatted.reduce((acc, curr) => [...acc, ...curr.linked], []);
            setLinkedRecords(allLinked);
        } catch (err) {
            console.error("Failed to fetch prescriptions", err);
            toast.error("Failed to sync ledger queue");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrescriptions();
    }, [medicalRecordsContract]);

    const requestAccess = async (wallet) => {
        if (!consentContract) return;
        try {
            toast.info("Sending formal access request to Patient...");
            const tx = await consentContract.requestAccess(wallet, "Pharmacy Dispensation Verification", { gasLimit: 1000000 });
            await tx.wait();
            toast.success("Access Request sent! Waiting for patient approval.");
        } catch (err) {
            toast.error("Failed to send access request");
        }
    };

    const decryptPrescription = async (px) => {
        try {
            toast.info("Decrypting IPFS Prescription...");
            const cipherText = await fetchFromPinata(px.cid);
            await new Promise(r => setTimeout(r, 800)); // UI effect
            const rawData = decryptData(cipherText);

            setDecryptedRx({
                ...rawData,
                patientName: px.patientName,
                patientWallet: px.patient,
                recordId: px.id,
                cid: px.cid
            });
            setDispensedId(null);
            toast.success("Prescription Decrypted Successfully");
        } catch (err) {
            toast.error("Decryption failed. Ensure patient has granted access.");
        }
    };

    const handleDispense = async () => {
        if (!decryptedRx) return;
        setIsDispensing(true);
        try {
            toast.info("Marking prescription as Dispensed On-Chain...");
            const tx = await medicalRecordsContract.markPrescriptionDispensed(decryptedRx.recordId, { gasLimit: 1000000 });
            await tx.wait();

            if (auditLogContract) {
                const nowSecs = Math.floor(Date.now() / 1000);
                await auditLogContract.logDataAccessed(decryptedRx.patientWallet, account, "Medication Dispensation", nowSecs, { gasLimit: 1000000 });
            }

            setDispensedId(decryptedRx.recordId);
            toast.success(`Medicines Dispensed. Transaction secured on-chain.`);

            // Clean up view
            setDecryptedRx(null);
            fetchPrescriptions(); // Refresh queue
        } catch (err) {
            toast.error("Dispensation failed on-chain.");
        } finally {
            setIsDispensing(false);
        }
    };

    return (
        <div className="dashboard animate-fade-in">
            <div className="dashboard-header">
                <div>
                    <h2>Pharmacist Portal</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Secure medication fulfillment with cryptographically verified prescriptions.</p>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="glass-panel" style={{ padding: '2.5rem' }}>
                    <h3>Global Queue</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Refresh the global active prescription queue from the ledger.</p>

                    <button className="primary-btn" onClick={fetchPrescriptions} disabled={loading} style={{ width: '100%' }}>
                        {loading ? "..." : "Sync Ledger Queue"}
                    </button>
                </div>

                <div className="glass-panel" style={{ padding: '2.5rem' }}>
                    <h3>Compliance Status</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--medical-primary)', boxShadow: '0 0 10px var(--medical-primary)' }}></div>
                        <span style={{ fontSize: '0.95rem' }}>Identity Verified (Wallet Protocol)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--medical-primary)', boxShadow: '0 0 10px var(--medical-primary)' }}></div>
                        <span style={{ fontSize: '0.95rem' }}>Blockchain Audit Enabled</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-section glass-panel">
                <h3>Pending Prescription Queue</h3>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Patient Identity</th>
                                <th>Wallet Address</th>
                                <th>Linked Records</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prescriptions.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}>No active prescriptions in the queue.</td></tr>
                            ) : (
                                prescriptions.map(px => (
                                    <tr key={px.id}>
                                        <td><strong>{px.patientName}</strong></td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-muted)' }}>{px.patient.slice(0, 8)}...</td>
                                        <td>
                                            {px.linked.length > 0 ? (
                                                <span className="role-badge" style={{ background: 'var(--grad-teal)', fontSize: '0.75rem' }}>
                                                    {px.linked.length} Linked
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                {px.isAuthorized ? (
                                                    <button className="primary-btn" onClick={() => decryptPrescription(px)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                                        🔓 Decrypt RX
                                                    </button>
                                                ) : (
                                                    <button className="secondary-btn" onClick={() => requestAccess(px.patient)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                                        Request Access
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {linkedRecords.length > 0 && (
                <div className="dashboard-section glass-panel" style={{ borderTop: '6px solid var(--medical-primary)' }}>
                    <h3>Specifically Shared Data</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Records linked to your profile by patients for faster verification.</p>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Purpose</th>
                                    <th>CID</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {linkedRecords.map((r, idx) => (
                                    <tr key={idx}>
                                        <td>{r.patientName}</td>
                                        <td>{r.purpose}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.cid.slice(0, 16)}...</td>
                                        <td>
                                            <button 
                                                className="primary-btn" 
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                onClick={() => {
                                                    decryptPrescription({ cid: r.cid, patientName: r.patientName, id: 'external' });
                                                }}
                                            >
                                                🔓 View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {decryptedRx && (
                <div className="dashboard-section glass-panel" style={{ borderLeft: '6px solid var(--medical-primary)' }}>
                    <h3>Prescription Details</h3>
                    <div className="floating-card" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1rem', fontSize: '0.95rem' }}>
                            <strong style={{ color: 'var(--text-muted)' }}>Patient:</strong> <span>{decryptedRx.patientName || "N/A"}</span>

                            {decryptedRx.medication ? (
                                <>
                                    <strong style={{ color: 'var(--text-muted)' }}>Medication:</strong> <span style={{ color: 'var(--medical-primary)', fontWeight: 'bold' }}>{decryptedRx.medication}</span>
                                    <strong style={{ color: 'var(--text-muted)' }}>Dosage:</strong> <span>{decryptedRx.dosage}</span>
                                    <strong style={{ color: 'var(--text-muted)' }}>Duration:</strong> <span>{decryptedRx.duration}</span>
                                </>
                            ) : (
                                <>
                                    <strong style={{ color: 'var(--text-muted)' }}>Clinical Data:</strong> <span style={{ color: 'var(--medical-primary)', fontWeight: 'bold' }}>{decryptedRx.clinicalData || "No data provided"}</span>
                                </>
                            )}

                            <strong style={{ color: 'var(--text-muted)' }}>Timestamp:</strong> <span>{decryptedRx.timestamp ? new Date(decryptedRx.timestamp).toLocaleString() : "Date not available"}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button className="secondary-btn" onClick={() => setDecryptedRx(null)}>Close View</button>
                        <button className="primary-btn" onClick={handleDispense} disabled={isDispensing}>
                            {isDispensing ? "Processing..." : "Mark as Dispensed"}
                        </button>
                    </div>
                </div>
            )}

            {dispensedId && (
                <div className="dashboard-section glass-panel" style={{ marginTop: '2rem', padding: '2rem', borderLeft: '4px solid var(--status-approved)', textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--status-approved)', marginBottom: '0.5rem' }}>✅ Dispensation Logged Successfully</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Prescription {dispensedId} has been fulfilled and removed from the global queue.</p>
                </div>
            )}
        </div>
    );
};

export default PharmacyDashboard;
