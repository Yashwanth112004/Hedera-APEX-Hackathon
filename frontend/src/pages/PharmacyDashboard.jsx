import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { fetchFromPinata, decryptData } from '../utils/ipfsHelper';

const PharmacyDashboard = ({ account, consentContract, auditLogContract, accessContract, medicalRecordsContract }) => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDispensing, setIsDispensing] = useState(false);
    const [decryptedRx, setDecryptedRx] = useState(null);
    const [dispensedId, setDispensedId] = useState(null);

    const fetchPrescriptions = async () => {
        if (!medicalRecordsContract || !consentContract || !account) return;
        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const readMedical = medicalRecordsContract.connect(provider);
            const readConsent = consentContract.connect(provider);

            const rawQueue = await readMedical.getPendingPrescriptions();

            const formatted = await Promise.all(rawQueue.map(async (rx) => {
                // Check for authorization (consent) for this specific patient
                let authorized = false;
                try {
                    const patientConsents = await readConsent.getPatientConsents(rx.patient);
                    authorized = patientConsents.some(c =>
                        c.dataFiduciary.toLowerCase() === account.toLowerCase() &&
                        c.isActive &&
                        Number(c.expiry) > Math.floor(Date.now() / 1000)
                    );
                } catch (cErr) {
                    console.error("Consent check failed for", rx.patient, cErr);
                }

                return {
                    id: rx.recordId.toString(),
                    patient: rx.patient,
                    patientName: rx.patientName,
                    cid: rx.cid,
                    status: 'Pending',
                    isAuthorized: authorized
                };
            }));

            setPrescriptions(formatted.reverse()); // latest first
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
        <div className="dashboard animate-fade-in" style={{ padding: '2rem' }}>
            <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
                <h2>Pharmacist Portal</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Secure medication fulfillment with cryptographically verified prescriptions.</p>
            </div>

            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3>Global Queue</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Refresh the global active prescription queue from the ledger.</p>

                    <button className="primary-btn" onClick={fetchPrescriptions} disabled={loading} style={{ marginTop: '1rem', width: '100%' }}>
                        {loading ? "Syncing..." : "Sync Ledger Queue"}
                    </button>
                </div>

                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3>Compliance Status</h3>
                    <div className="status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22C55E' }}></div>
                        <span style={{ fontSize: '0.9rem' }}>Identity Verified (Wallet Protocol)</span>
                    </div>
                    <div className="status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22C55E' }}></div>
                        <span style={{ fontSize: '0.9rem' }}>Blockchain Audit Enabled</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-section glass-panel" style={{ marginTop: '2rem', padding: '2rem' }}>
                <h3>Pending Prescription Queue</h3>
                <table className="data-table" style={{ marginTop: '1.5rem' }}>
                    <thead>
                        <tr>
                            <th>Patient Identity</th>
                            <th>Wallet Address</th>
                            <th>State</th>
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
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-secondary)' }}>{px.patient.slice(0, 8)}...{px.patient.slice(-6)}</td>
                                    <td>
                                        <span className={`status-badge ${px.status.toLowerCase()}`}>
                                            {px.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {px.isAuthorized ? (
                                                <button className="secondary-btn" onClick={() => decryptPrescription(px)} style={{ background: 'var(--success-color)', border: 'none' }}>
                                                    🔓 Decrypt
                                                </button>
                                            ) : (
                                                <button className="primary-btn" onClick={() => requestAccess(px.patient)}>
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

            {decryptedRx && (
                <div className="dashboard-section glass-panel" style={{ marginTop: '2rem', padding: '2rem', borderLeft: '4px solid var(--primary-color)' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Prescription Details</h3>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 150px) 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
                        <strong>Patient:</strong> <span>{decryptedRx.patientName || "N/A"}</span>

                        {decryptedRx.medication ? (
                            <>
                                <strong>Medication:</strong> <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{decryptedRx.medication}</span>
                                <strong>Dosage:</strong> <span>{decryptedRx.dosage}</span>
                                <strong>Duration:</strong> <span>{decryptedRx.duration}</span>
                            </>
                        ) : (
                            <>
                                <strong>Clinical Data:</strong> <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{decryptedRx.clinicalData || "No data provided"}</span>
                            </>
                        )}

                        <strong>Timestamp:</strong> <span>{decryptedRx.timestamp ? new Date(decryptedRx.timestamp).toLocaleString() : "Date not available"}</span>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button className="secondary-btn" onClick={() => setDecryptedRx(null)}>Close View</button>
                        <button className="primary-btn" onClick={handleDispense} disabled={isDispensing} style={{ background: '#22C55E' }}>
                            {isDispensing ? "Processing..." : "Mark as Dispensed & Remove from Queue"}
                        </button>
                    </div>
                </div>
            )}

            {dispensedId && (
                <div className="dashboard-section glass-panel" style={{ marginTop: '2rem', padding: '2rem', borderLeft: '4px solid #22C55E', textAlign: 'center' }}>
                    <h3 style={{ color: '#22C55E', marginBottom: '0.5rem' }}>✅ Dispensation Logged Successfully</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Prescription {dispensedId} has been fulfilled and removed from the global queue.</p>
                </div>
            )}
        </div>
    );
};

export default PharmacyDashboard;
