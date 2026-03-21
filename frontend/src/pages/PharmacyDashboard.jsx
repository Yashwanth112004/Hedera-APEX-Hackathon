import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { fetchFromPinata, decryptData } from '../utils/ipfsHelper';
import { getSafePatientConsents } from '../utils/consentHelper';

const PharmacyDashboard = ({ 
    account, 
    consentContract, 
    auditLogContract, 
    accessContract, 
    medicalRecordsContract,
    walletMapperContract 
}) => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [linkedRecords, setLinkedRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDispensing, setIsDispensing] = useState(false);
    const [billingAmount, setBillingAmount] = useState('');
    const [decryptedRx, setDecryptedRx] = useState(null);
    const [dispensedId, setDispensedId] = useState(null);
    const [ipfsCid, setIpfsCid] = useState(''); // Added for manual/linked decryption
    const [searchTerm, setSearchTerm] = useState('');

    const fetchPrescriptions = async () => {
        console.log("[Pharmacy] Fetching prescriptions from ledger...");
        if (!medicalRecordsContract) console.warn("[Pharmacy] medicalRecordsContract is null");
        if (!consentContract) console.warn("[Pharmacy] consentContract is null");
        if (!account) console.warn("[Pharmacy] account is null");
        
        if (!medicalRecordsContract || !consentContract || !account) return;
        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const readMedical = medicalRecordsContract.connect(provider);
                const readConsent = consentContract.connect(provider);

                console.log("[Pharmacy] Calling getPendingPrescriptions...");
                const rawQueue = await readMedical.getPendingPrescriptions();
                console.log(`[Pharmacy] Found ${rawQueue.length} items in queue`);

                const formatted = (await Promise.all((rawQueue || []).map(async (rx) => {
                    if (rx.isDispensed) return null; // Filter out dispensed ones at source

                    let authorized = false;
                    let patientShortId = "N/A";
                    let hasPendingRequest = false;
                    const activeLinked = [];

                    // Fetch Short ID if mapper available
                    if (walletMapperContract) {
                        try {
                            const sid = await walletMapperContract.getShortIDFromWallet(rx.patient);
                            if (sid && sid !== "") patientShortId = sid;
                        } catch (e) { console.warn("Short ID fetch failed", e); }
                    }

                    try {
                        const patientConsents = await getSafePatientConsents(readConsent, rx.patient, consentContract.target, provider);
                        
                        if (patientConsents?.length > 0) {
                            console.log(`[Pharmacy-Diag] Found ${patientConsents.length} total consents for patient ${rx?.patient?.slice(0,8) || 'Unknown'}`);
                        }

                        // Also fetch pending requests to see if we have one outstanding
                        const pendingReqs = await getSafePendingRequests(readConsent, rx.patient, consentContract.target, provider);
                        hasPendingRequest = (pendingReqs || []).some(req => req.provider.toLowerCase() === account.toLowerCase() && req.isPending);

                        (patientConsents || []).forEach(c => {
                            const p = (c?.purpose || "").toLowerCase();
                            const isPharmaPurpose = p.includes('medication') || 
                                                 p.includes('dispensation') || 
                                                 p.includes('prescription') || 
                                                 p.includes('pharmacy') ||
                                                 p.includes('clinical') || // Inclusive fallback
                                                 p === "all" ||
                                                 p.includes('medical');

                            const isFiduciary = c?.dataFiduciary?.toLowerCase() === account?.toLowerCase();
                            const isExpired = Number(c?.expiry || 0) <= Math.floor(Date.now() / 1000);
                            
                            if (isFiduciary) {
                                console.log(`[Pharmacy-Diag] Match found: Active=${c.isActive}, Purpose="${p}" (isPharma=${isPharmaPurpose}), Expired=${isExpired}`);
                            }

                            if (isFiduciary && c.isActive && isPharmaPurpose && !isExpired) {
                                authorized = true;
                                if (c?.dataHash) {
                                    const cids = c.dataHash.split(',');
                                    cids.forEach(cid => {
                                        const trimmed = cid?.trim();
                                        if (trimmed) {
                                            activeLinked.push({
                                                cid: trimmed,
                                                purpose: c.purpose,
                                                patientName: rx.patientName,
                                                patientWallet: rx.patient
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
                        id: rx?.recordId?.toString() || Math.random().toString(),
                        patient: rx?.patient || 'Unknown',
                        patientName: rx?.patientName || 'N/A',
                        patientShortId,
                        cid: rx?.cid || 'N/A',
                        status: 'Pending',
                        isAuthorized: authorized,
                        hasPendingRequest: hasPendingRequest,
                        linked: activeLinked
                    };
                }))).filter(item => item !== null);

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
        
        // Auto-refresh every 12 seconds to catch on-chain approvals without manual sync
        const interval = setInterval(() => {
            if (!loading) fetchPrescriptions();
        }, 12000);
        
        return () => clearInterval(interval);
    }, [medicalRecordsContract, consentContract, account]);

    const requestAccess = async (wallet) => {
        if (!consentContract) return;
        try {
            toast.info("Sending formal access request to Patient...");
            const tx = await consentContract.requestAccess(wallet, "Pharmacy Dispensation Verification", { gasLimit: 1000000 });
            await tx.wait();
            fetchPrescriptions(); // Refresh to show "Waiting" status
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
        if (!decryptedRx || !billingAmount) {
            toast.error("Please enter the bill amount before dispensing.");
            return;
        }
        setIsDispensing(true);
        try {
            toast.info("Marking prescription as Dispensed On-Chain...");
            // Pass billingAmount to the contract
            const tx = await medicalRecordsContract.markPrescriptionDispensed(decryptedRx.recordId, Number(billingAmount), { gasLimit: 1000000 });
            await tx.wait();

            if (auditLogContract) {
                const nowSecs = Math.floor(Date.now() / 1000);
                await auditLogContract.logDataAccessed(decryptedRx.patientWallet, account, `Medication Dispensation (Amt: ${billingAmount})`, nowSecs, { gasLimit: 1000000 });
            }

            setDispensedId(decryptedRx.recordId);
            toast.success(`Medicines Dispensed. Bill of ${billingAmount} secured on-chain.`);

            // Clean up view
            setDecryptedRx(null);
            setBillingAmount('');
            fetchPrescriptions(); // Refresh queue
        } catch (err) {
            console.error("Dispensation failed on-chain:", err);
            const reason = err?.reason || err?.message || "Unknown error";
            toast.error(`Dispensation failed: ${reason?.slice(0, 60) || 'Error'}${reason?.length > 60 ? '...' : ''}`);
        } finally {
            setIsDispensing(false);
        }
    };

    return (
        <div className="dashboard animate-fade-in">
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--medical-primary)', marginBottom: '0.4rem' }}>Pharmacist Portal</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Secure medication fulfillment with cryptographically verified prescriptions.</p>
                </div>
                <div className="search-container glass-panel" style={{ 
                    padding: '0.6rem 1.2rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    background: 'white', 
                    minWidth: '400px', 
                    border: '2px solid var(--medical-primary)',
                    boxShadow: 'var(--shadow-md)',
                    borderRadius: 'var(--radius-md)'
                }}>
                    <span style={{ fontSize: '1.2rem', color: 'var(--medical-primary)' }}>🔍</span>
                    <input 
                        type="text" 
                        placeholder="Search prescriptions..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-main)',
                            width: '100%',
                            outline: 'none',
                            fontSize: '1rem',
                            fontWeight: '500'
                        }}
                    />
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="glass-panel" style={{ padding: '2.5rem' }}>
                    <h3>Global Queue</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Refresh the global active prescription queue from the ledger.</p>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="primary-btn" onClick={fetchPrescriptions} disabled={loading} style={{ width: '100%' }}>
                            {loading ? "..." : "Sync Ledger Queue"}
                        </button>
                    </div>
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
                            <tr style={{ background: '#F8FAFC' }}>
                                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Patient Identity</th>
                                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Short ID</th>
                                <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Wallet Address</th>
                                 <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const filtered = prescriptions.filter(px => {
                                    const search = searchTerm.toLowerCase().trim();
                                    if (!search) return true;
                                    return (px.patientName?.toLowerCase().includes(search)) || 
                                           (px.patientShortId?.toLowerCase().includes(search)) ||
                                           (px.patient?.toLowerCase().includes(search));
                                });

                                if (filtered.length === 0) {
                                    return <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No prescriptions found matching your search.</td></tr>;
                                }

                                return filtered.map(px => (
                                    <tr key={px?.id || Math.random()}>
                                        <td><strong>{px?.patientName || 'N/A'}</strong></td>
                                        <td><span className="status-badge active" style={{ fontSize: '0.75rem', padding: '2px 10px' }}>{px?.patientShortId || 'N/A'}</span></td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-muted)' }}>{px?.patient?.slice(0, 8) || 'N/A'}...</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {px.isAuthorized ? (
                                                    <button className="primary-btn" onClick={() => decryptPrescription(px)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                                        🔓 Decrypt RX
                                                    </button>
                                                ) : px.hasPendingRequest ? (
                                                    <button className="secondary-btn" disabled style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', opacity: 0.6, cursor: 'not-allowed' }}>
                                                        ⏳ Waiting for Approval
                                                    </button>
                                                ) : (
                                                    <button className="secondary-btn" onClick={() => requestAccess(px.patient)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                                        Request Access
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ));
                            })()}
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
                                {(linkedRecords || []).map((r, idx) => (
                                    <tr key={idx}>
                                        <td>{r?.patientName || 'N/A'}</td>
                                        <td>{r?.purpose || 'Shared Content'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r?.cid?.slice(0, 16) || 'N/A'}...</td>
                                        <td>
                                            <button 
                                                className="primary-btn" 
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                onClick={() => {
                                                    decryptPrescription({ cid: r.cid, patientName: r.patientName, id: 'external', patient: r.patientWallet });
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

                    <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(20,184,166,0.05)', borderRadius: '12px', border: '1px dashed var(--medical-primary)' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--medical-primary)' }}>Pharmacy Bill Amount (INR)</label>
                        <input 
                            type="number" 
                            className="glass-input" 
                            placeholder="e.g. 1500" 
                            value={billingAmount}
                            onChange={(e) => setBillingAmount(e.target.value)}
                            style={{ background: 'white' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <button className="secondary-btn" onClick={() => { setDecryptedRx(null); setBillingAmount(''); }}>Close View</button>
                        <button className="primary-btn" onClick={handleDispense} disabled={isDispensing || !billingAmount}>
                            {isDispensing ? "Processing..." : "Confirm & Dispense"}
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
