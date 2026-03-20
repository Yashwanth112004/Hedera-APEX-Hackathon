import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { fetchFromPinata, decryptData, encryptData, uploadToPinata } from '../utils/ipfsHelper';
import { resolveWalletAddress } from '../utils/idMappingHelper';
import { getSafePatientConsents, getSafePendingRequests } from '../utils/consentHelper';
import { Shield, Info, Activity, Wallet, Lock, Plus, Search, Check, AlertTriangle, Eye, Download, UserPlus, Trash2, Edit3, X, FileText } from 'lucide-react';

const DoctorDashboard = ({
    account,
    consentContract,
    auditLogContract,
    accessContract,
    medicalRecordsContract,
    walletMapperContract,
    onRequestConsent,
    onAccessPatientData,
    onEmergencyAccess
}) => {
    const [patientWallet, setPatientWallet] = useState('');
    const [requestPurpose, setRequestPurpose] = useState('');
    const [showEmergencyModal, setShowEmergencyModal] = useState(false);
    const [emergencyJustification, setEmergencyJustification] = useState("");
    const [attendingName, setAttendingName] = useState("");
    const [activeConsents, setActiveConsents] = useState([]);
    const [linkedRecords, setLinkedRecords] = useState([]);
    const [pendingSentRequests, setPendingSentRequests] = useState([]);
    const [interactionHistory, setInteractionHistory] = useState([]); // Array of { wallet, shortId }
    const [loading, setLoading] = useState(false);

    // IPFS Decryption State
    const [ipfsCid, setIpfsCid] = useState('');
    const [decryptedRecord, setDecryptedRecord] = useState(null);
    const [isDecrypting, setIsDecrypting] = useState(false);

    // Prescription Upload State
    const [rxPatientWallet, setRxPatientWallet] = useState('');
    const [rxPatientName, setRxPatientName] = useState('');
    const [rxMedicine, setRxMedicine] = useState('');
    const [rxDosage, setRxDosage] = useState('');
    const [rxDuration, setRxDuration] = useState('');
    const [rxSensitivity, setRxSensitivity] = useState('Low');
    const [isUploading, setIsUploading] = useState(false);
    // Consent & Access Settings
    const [requestScope, setRequestScope] = useState('All');
    const [accessScope, setAccessScope] = useState('All');

    React.useEffect(() => {
        const loadHistory = async () => {
            if (!auditLogContract || !account) return;
            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const readAudit = auditLogContract.connect(provider);
                const logs = await readAudit.getLogs();

                const normalizedDoctor = account.toLowerCase();
                // Filter for any interaction where this doctor was the fiduciary
                const uniquePatients = new Set();
                logs.forEach(log => {
                    if (log.dataFiduciary.toLowerCase() === normalizedDoctor) {
                        uniquePatients.add(log.dataPrincipal);
                    }
                });

                const historyList = [];
                for (const wallet of uniquePatients) {
                    let short = "N/A";
                    if (walletMapperContract) {
                        try {
                            const mapperRead = walletMapperContract.connect(provider);
                            short = await mapperRead.getShortIDFromWallet(wallet);
                        } catch (e) { console.warn("Short ID resolve failed", e); }
                    }
                    historyList.push({ wallet, shortId: short });
                }

                setInteractionHistory(historyList);
            } catch (err) {
                console.error("Failed to fetch interaction history:", err);
            }
        };
        loadHistory();
    }, [auditLogContract, account]);

    // Auto-sync all history details once history is resolved
    React.useEffect(() => {
        if (interactionHistory.length > 0) {
            syncAllHistory();
        }
    }, [interactionHistory]);

    // Cleanup: Function to auto-fetch all history statuses
    const syncAllHistory = async () => {
        if (!consentContract || interactionHistory.length === 0) return;
        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const readConsent = consentContract.connect(provider);
            const readMedical = medicalRecordsContract.connect(provider);
            const normalizedDoctor = account.toLowerCase();

            const allLinked = [];
            const allPending = [];
            const allConsents = [];

            for (const item of interactionHistory) {
                const patient = item.wallet;
                const shortId = item.shortId;

                // Fetch Consents
                const patientConsents = await getSafePatientConsents(readConsent, patient, consentContract.target, provider);
                patientConsents.forEach(c => {
                    if (c.isActive && c.dataFiduciary.toLowerCase() === normalizedDoctor) {
                        if (c.dataHash) {
                            c.dataHash.split(',').forEach(cid => {
                                if (cid.trim()) allLinked.push({
                                    cid: cid.trim(),
                                    purpose: c.purpose,
                                    patient,
                                    shortId,
                                    sharedAt: c.grantedAt
                                });
                            });
                        }
                    }
                });

                // Fetch Pending Requests
                try {
                    const pending = await getSafePendingRequests(readConsent, patient, consentContract.target, provider);
                    pending.filter(r => r.provider.toLowerCase() === normalizedDoctor).forEach(r => {
                        allPending.push({ ...r, patient, shortId });
                    });
                } catch (pErr) {
                    console.error("Failed to fetch pending for", patient, pErr);
                }

                // Fetch General Records
                const records = await readMedical.getPatientRecords(patient);
                records.forEach(r => {
                    allConsents.push({
                        id: r.id.toString(),
                        type: r.recordType,
                        status: "Authorized",
                        cid: r.cid,
                        provider: r.provider,
                        patient,
                        shortId
                    });
                });
            }

            setLinkedRecords(allLinked);
            setPendingSentRequests(allPending);
            setActiveConsents(allConsents);
            toast.success("Global history synced!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to sync global history");
        } finally {
            setLoading(false);
        }
    };

    const checkPatientConsents = async () => {
        if (!patientWallet) {
            toast.error("Patient Wallet Address or Short ID is required");
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
            setLoading(true);
            toast.info("Sending on-chain request to Patient...");

            if (!onRequestConsent) throw new Error("Request handler not connected");

            if (!requestPurpose) {
                toast.error("Clinical Purpose is required");
                setLoading(false);
                return;
            }

            await onRequestConsent(targetWallet, requestPurpose);
            setRequestPurpose('');

        } catch {
            toast.error("Failed to request access");
        } finally {
            setLoading(false);
        }
    };

    const fetchAuthorizedRecords = async (isEmergency = false) => {
        if (!patientWallet) {
            toast.error("Enter Patient Wallet Address or Short ID to fetch records");
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

        let formatted = [];
        let linked = [];
        let pendingRequestsByMe = [];

        try {
            if (isEmergency) {
                toast.warn("🔍 EMERGENCY SYNC: Aggregating all global clinical sources...", { autoClose: 5000 });
            } else {
                toast.info("Fetching mapped records from Hedera...");
            }
            
            if (medicalRecordsContract) {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const readContract = medicalRecordsContract.connect(provider);
                const records = await readContract.getPatientRecords(targetWallet);

                // If NOT emergency, only show records this doctor uploaded.
                // If EMERGENCY, show ALL records found for this patient.
                formatted = records
                    .filter(r => isEmergency || r.provider.toLowerCase() === account.toLowerCase())
                    .map(r => ({
                        id: r.id.toString(),
                        type: r.recordType,
                        status: isEmergency ? "🚨 EMERGENCY ACCESS" : "Authorized",
                        cid: r.cid,
                        provider: r.provider,
                        billAmount: r.billAmount ? r.billAmount.toString() : '0'
                    }));

                setActiveConsents(formatted);

                // --- Fetch specifically linked records from ConsentManager ---
                if (consentContract) {
                    const consentReadContract = consentContract.connect(provider);
                    const patientConsents = await getSafePatientConsents(consentReadContract, targetWallet, consentContract.target, provider);

                    const normalizedDoctor = account.toLowerCase();
                    
                    patientConsents.forEach(c => {
                        // In emergency Mode, we take ALL active consents, regardless of who the fiduciary is
                        const isAuthorized = isEmergency || (c.dataFiduciary.toLowerCase() === normalizedDoctor);
                        
                        if (c.isActive && isAuthorized && c.dataHash) {
                            const cids = c.dataHash.split(',');
                            cids.forEach(cid => {
                                if (cid.trim()) {
                                    linked.push({
                                        cid: cid.trim(),
                                        purpose: c.purpose,
                                        expiry: c.expiry,
                                        sharedAt: c.grantedAt,
                                        isEmergencySource: isEmergency && (c.dataFiduciary.toLowerCase() !== normalizedDoctor)
                                    });
                                }
                            });
                        }
                    });
                    setLinkedRecords(linked);

                    // Fetch pending requests sent by this doctor to this patient
                    const pendingRequests = await consentReadContract.getPendingRequests(targetWallet);
                    pendingRequestsByMe = pendingRequests.filter(r => r.provider.toLowerCase() === normalizedDoctor);
                    setPendingSentRequests(pendingRequestsByMe);
                }

                if (formatted.length === 0 && linked.length === 0) {
                    toast.warning(isEmergency ? "No clinical records found for this identity even in Emergency mode." : "No records or pending requests found.");
                } else {
                    toast.success(isEmergency ? "Emergency full history aggregated!" : `Synced dashboard for patient.`);
                }
            } else {
                toast.error("MedicalRecords contract not loaded");
            }
        } catch {
            toast.error("Consent verification failed");
        } finally {
            setLoading(false);
        }
    };

    const accessMedicalData = async (consentId, scope = "All") => {
        try {
            if (!accessContract) return;
            const tx = await accessContract.accessData(patientWallet, consentId, scope, "Clinical Review", { gasLimit: 1000000 });
            await tx.wait();

            toast.success("Identity Verified & Data Accessed");
        } catch (err) {
            toast.error("Access rejected: " + (err.reason || err.message));
        }
    };

    const handleDecryptRecord = async (targetCid = null, patientMeta = null) => {
        const cidToUse = targetCid || ipfsCid;
        if (!cidToUse) {
            toast.error("Please provide a valid IPFS CID");
            return;
        }

        try {
            setIsDecrypting(true);
            setDecryptedRecord(null); // Clear old view
            toast.info("Fetching encrypted payload from IPFS nodes...");

            const cipherText = await fetchFromPinata(cidToUse);

            toast.info("Decrypting ciphertext with local key...");
            await new Promise(r => setTimeout(r, 600));

            const rawData = decryptData(cipherText);

            // Enrich with patient metadata if provided
            setDecryptedRecord({
                ...rawData,
                patientShortId: patientMeta?.shortId || "Unknown",
                patientWallet: patientMeta?.wallet || "Unknown"
            });

            toast.success("Data successfully decrypted!");

            // Log decryption action to audit trail
            const targetPatient = patientMeta?.wallet || patientWallet;
            if (auditLogContract && targetPatient && ethers.isAddress(targetPatient)) {
                const nowSecs = Math.floor(Date.now() / 1000);
                await auditLogContract.logDataAccessed(targetPatient, account, "IPFS Record Decryption", nowSecs, { gasLimit: 1000000 });
            }
        } catch (error) {
            toast.error(error.message || "Failed to decrypt record. Invalid CID or Key.");
            setDecryptedRecord(null);
        } finally {
            setIsDecrypting(false);
        }
    };

    const handleUploadPrescription = async (e) => {
        e.preventDefault();
        if (!rxPatientWallet || !rxPatientName || !rxMedicine || !rxDosage || !rxDuration) {
            toast.error("Please fill all valid prescription fields");
            return;
        }

        setIsUploading(true);
        let targetWallet = rxPatientWallet;
        try {
            targetWallet = await resolveWalletAddress(rxPatientWallet, walletMapperContract);
        } catch (e) {
            toast.error(e.message);
            setIsUploading(false);
            return;
        }

        if (!ethers.isAddress(targetWallet)) {
            toast.error("Valid wallet address or Short ID required");
            setIsUploading(false);
            return;
        }

        try {
            toast.info("Encrypting prescription payload...");

            const prescriptionData = {
                type: 'Prescription',
                patientRef: rxPatientName,
                clinicalData: `Medication: ${rxMedicine}, Dosage: ${rxDosage}, Duration: ${rxDuration}`,
                medication: rxMedicine,
                dosage: rxDosage,
                duration: rxDuration,
                sensitivity: rxSensitivity, // TAGGING
                timestamp: new Date().toISOString()
            };

            const encryptedData = encryptData(prescriptionData);

            toast.info("Uploading encrypted cipher to IPFS (Pinata)...");
            const cid = await uploadToPinata(encryptedData);

            if (!medicalRecordsContract) {
                toast.error("MedicalRecords contract not connected!");
                throw new Error("MedicalRecords Contract not found");
            }

            toast.info("Mapping IPFS Record and inserting to Global Pharmacy Queue...");
            const tx = await medicalRecordsContract.addPrescription(targetWallet, rxPatientName, cid, { gasLimit: 1000000 });
            await tx.wait();

            if (auditLogContract) {
                const nowSecs = Math.floor(Date.now() / 1000);
                await auditLogContract.logDataAccessed(targetWallet, account, "Created Prescription", nowSecs, { gasLimit: 1000000 });
            }

            toast.success("Prescription successfully mapped to Pharmacy Queue!");
            setRxPatientName('');
            setRxMedicine('');
            setRxDosage('');
            setRxDuration('');
        } catch (error) {
            toast.error(error.message || "Failed to upload prescription");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="dashboard animate-fade-in">
            <div className="dashboard-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Physician Portal</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Secure clinical access governed by DPDP 2023.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="primary-btn"
                        style={{ backgroundColor: '#EF4444' }}
                        onClick={() => setShowEmergencyModal(true)}
                    >
                        🚨 Emergency
                    </button>
                    <button
                        className="secondary-btn"
                        onClick={syncAllHistory}
                        disabled={loading || interactionHistory.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {loading ? "Syncing..." : "🔄 Sync"}
                    </button>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="glass-panel" style={{ padding: '2.5rem' }}>
                    <h3>Request Patient Access</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Submit an on-chain request to view a patient's encrypted health records.
                    </p>
                    <div className="form-group">
                        <label>Patient ID (Wallet or Short ID)</label>
                        <input
                            type="text"
                            className="glass-input"
                            placeholder="e.g. 1234-ABCD or 0x..."
                            value={patientWallet}
                            onChange={(e) => setPatientWallet(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Clinical Purpose</label>
                        <input
                            type="text"
                            className="glass-input"
                            placeholder="e.g. Follow-up consultation"
                            value={requestPurpose}
                            onChange={(e) => setRequestPurpose(e.target.value)}
                        />
                    </div>
                    <button className="primary-btn" onClick={checkPatientConsents} disabled={loading} style={{ width: '100%' }}>
                        {loading ? "Submitting..." : "Send Access Request"}
                    </button>
                </div>

                <div className="glass-panel" style={{ padding: '2.5rem' }}>
                    <h3>Clinical Guidelines</h3>
                    <ul style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.8', paddingLeft: '1.25rem' }}>
                        <li>Verify patient's digital consent status before access.</li>
                        <li>All clinical access is logged for compliance audit.</li>
                        <li>Honor patients' "Right to Erasure" immediately.</li>
                    </ul>
                </div>
            </div>

            {/* Prescription Upload Panel */}
            <div className="dashboard-section glass-panel" style={{ borderLeft: '6px solid var(--medical-primary)' }}>
                <h3>Issue Prescription to Global Queue</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Generate an encrypted IPFS prescription cipher and immutably map it to the patient's ID into the global Pharmacy queue.
                </p>
                <form onSubmit={handleUploadPrescription} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Patient ID (Wallet or Short ID)</label>
                        <input type="text" className="glass-input" placeholder="e.g. 1234-ABCD" value={rxPatientWallet} onChange={(e) => setRxPatientWallet(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Patient Name (Alias)</label>
                        <input type="text" className="glass-input" placeholder="e.g. John Doe" value={rxPatientName} onChange={(e) => setRxPatientName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Medication</label>
                        <input type="text" className="glass-input" placeholder="e.g. Amoxicillin 500mg" value={rxMedicine} onChange={(e) => setRxMedicine(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label>Dosage</label>
                            <input type="text" className="glass-input" placeholder="1 tablet twice daily" value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} required />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Duration</label>
                            <input type="text" className="glass-input" placeholder="7 days" value={rxDuration} onChange={(e) => setRxDuration(e.target.value)} required />
                        </div>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Data Sensitivity (DPDP Rating) *</label>
                        <select className="glass-input" value={rxSensitivity} onChange={e => setRxSensitivity(e.target.value)}>
                            <option value="Low">Low (Standard Rx)</option>
                            <option value="Medium">Medium (Controlled Substances)</option>
                            <option value="High">High (Sensitive Psych/Chronic)</option>
                        </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                        <button type="submit" className="primary-btn" disabled={isUploading} style={{ width: '100%' }}>
                            {isUploading ? "Encrypting & Queuing..." : "Encrypt & Send to Pharmacy Queue"}
                        </button>
                    </div>
                </form>
            </div>

            {/* IPFS Decryption Engine */}
            <div className="dashboard-section glass-panel" style={{ borderLeft: '6px solid var(--medical-accent)' }}>
                <h3>IPFS Decryption Engine</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Fetch an encrypted patient record from the decentralized IPFS network and decrypt it securely in your local browser environment.
                </p>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        className="glass-input"
                        placeholder="Enter IPFS CID (e.g., Qm...)"
                        value={ipfsCid}
                        onChange={(e) => setIpfsCid(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button className="primary-btn" onClick={handleDecryptRecord} disabled={isDecrypting}>
                        {isDecrypting ? "Decrypting..." : "Fetch & Decrypt"}
                    </button>
                </div>

                {decryptedRecord && (
                    <div className="floating-card" style={{ marginTop: '2rem', borderColor: 'var(--medical-primary)' }}>
                        <h4 style={{ color: 'var(--medical-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span>🔓</span> Decrypted Health Record
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1.5rem', fontSize: '0.95rem' }}>
                            <strong style={{ color: 'var(--text-muted)' }}>Patient ID:</strong> <span style={{ color: 'var(--medical-primary)', fontWeight: 'bold' }}>{decryptedRecord.patientShortId}</span>
                            <strong style={{ color: 'var(--text-muted)' }}>Record Type:</strong> <span>{decryptedRecord.type}</span>
                            <strong style={{ color: 'var(--text-muted)' }}>Clinical Data:</strong> <span style={{ lineHeight: '1.6' }}>{decryptedRecord.clinicalData}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="dashboard-section glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3>Authorized Health Records</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>General medical history authorized for your view.</p>
                    </div>
                    <button className="secondary-btn" onClick={fetchAuthorizedRecords} disabled={loading}>
                        {loading ? "..." : "Fetch Records"}
                    </button>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Patient ID</th>
                                <th>Record Type</th>
                                <th>Status</th>
                                <th>IPFS Hash</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeConsents.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}>No general records found.</td></tr>
                            ) : (
                                activeConsents.map(c => (
                                    <tr key={c.id}>
                                        <td><strong style={{ color: 'var(--medical-primary)' }}>{c.shortId}</strong></td>
                                        <td>{c.type}</td>
                                        <td><span className="status-badge active">{c.status}</span></td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-secondary)' }}>{c.cid.slice(0, 12)}...</td>
                                        <td>
                                            <button className="secondary-btn" onClick={() => {
                                                setIpfsCid(c.cid);
                                                handleDecryptRecord(c.cid, { wallet: c.patient, shortId: c.shortId });
                                                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                            }}>
                                                Decrypt
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {linkedRecords.length > 0 || pendingSentRequests.length > 0 ? (
                <div className="dashboard-section glass-panel" style={{ borderTop: '6px solid var(--medical-primary)' }}>
                    <h3>Specifically Shared Data & Requests</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Records explicitly selected by the patient or status of your pending requests.
                    </p>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Patient ID</th>
                                    <th>Purpose</th>
                                    <th>Status / CID</th>
                                    <th>Shared / Requested At</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Show Pending Requests First */}
                                {pendingSentRequests.map((r, idx) => (
                                    <tr key={`req-${idx}`} style={{ opacity: 0.8 }}>
                                        <td><strong style={{ color: 'var(--medical-primary)' }}>{r.shortId}</strong></td>
                                        <td>{r.purpose}</td>
                                        <td><span className="status-badge pending" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Consent Requested</span></td>
                                        <td>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {r.patient.slice(0, 10)}...
                                            </div>
                                            {new Date(Number(r.timestamp) * 1000).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <button className="secondary-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                                Pending Approval
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {/* Show Linked Records */}
                                {linkedRecords.map((r, idx) => (
                                    <tr key={`link-${idx}`}>
                                        <td><strong style={{ color: 'var(--medical-primary)' }}>{r.shortId}</strong></td>
                                        <td>{r.purpose}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-secondary)' }}>{r.cid.slice(0, 16)}...</td>
                                        <td>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {r.patient?.slice(0, 10)}...
                                            </div>
                                            {new Date(Number(r.sharedAt) * 1000).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <button className="primary-btn" onClick={() => {
                                                setIpfsCid(r.cid);
                                                handleDecryptRecord(r.cid, { wallet: r.patient, shortId: r.shortId });
                                                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                            }}>
                                                🔓 Decrypt
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {showEmergencyModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: '#EF444415', color: '#EF4444', padding: '0.6rem', borderRadius: '12px' }}>
                                    <AlertTriangle size={22} />
                                </div>
                                <h3 style={{ color: '#EF4444' }}>🚨 EMERGENCY ACCESS</h3>
                            </div>
                            <button className="close-btn" onClick={() => setShowEmergencyModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ 
                                background: '#FEF2F2', 
                                padding: '1.25rem', 
                                borderRadius: '12px', 
                                border: '1px solid #FCA5A5',
                                display: 'flex',
                                gap: '1rem',
                                marginBottom: '2rem'
                            }}>
                                <Info size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <p style={{ color: '#991B1B', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                                    <strong>LEGAL WARNING:</strong> This action overrides normal consent under DPDP emergency provisions. A permanent justification will be anchored to the Hedera ledger.
                                </p>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>Patient Wallet / Short ID *</label>
                                <input
                                    className="glass-input"
                                    value={patientWallet}
                                    onChange={(e) => setPatientWallet(e.target.value)}
                                    placeholder="0x... or Short ID"
                                    style={{ fontSize: '0.9rem' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>Attending Physician Name *</label>
                                <input
                                    className="glass-input"
                                    value={attendingName}
                                    onChange={(e) => setAttendingName(e.target.value)}
                                    placeholder="e.g. Dr. Jane Smith"
                                    style={{ fontSize: '0.9rem' }}
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>Emergency Justification *</label>
                                <textarea
                                    className="glass-input"
                                    rows="3"
                                    placeholder="e.g. Unconscious patient needing immediate treatment."
                                    value={emergencyJustification}
                                    onChange={(e) => setEmergencyJustification(e.target.value)}
                                    style={{ fontSize: '0.9rem', resize: 'none' }}
                                />
                            </div>
                            <div className="modal-actions" style={{ marginTop: 0 }}>
                                <button className="primary-btn" style={{ background: '#EF4444', border: 'none', width: '100%', height: '52px', boxShadow: '0 8px 16px -4px rgba(239, 68, 68, 0.3)' }} onClick={async () => {
                                    if (!patientWallet || !emergencyJustification || !attendingName) return toast.error("Required fields missing");
                                    const success = await onEmergencyAccess(patientWallet, emergencyJustification, attendingName);
                                    if (success) {
                                        setEmergencyJustification("");
                                        setAttendingName("");
                                        fetchAuthorizedRecords(true);
                                        setShowEmergencyModal(false);
                                    }
                                }}>
                                    🔥 Initiate Break-Glass Access
                                </button>
                                <button className="secondary-btn" onClick={() => setShowEmergencyModal(false)} style={{ width: '100%', height: '52px' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorDashboard;
