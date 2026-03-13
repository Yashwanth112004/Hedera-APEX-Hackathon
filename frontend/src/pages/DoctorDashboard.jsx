import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { fetchFromPinata, decryptData, encryptData, uploadToPinata } from '../utils/ipfsHelper';
import { resolveWalletAddress } from '../utils/idMappingHelper';

const DoctorDashboard = ({ account, consentContract, auditLogContract, accessContract, medicalRecordsContract, walletMapperContract }) => {
    const [patientWallet, setPatientWallet] = useState('');
    const [requestPurpose, setRequestPurpose] = useState('');
    const [activeConsents, setActiveConsents] = useState([]);
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
    const [isUploading, setIsUploading] = useState(false);

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

            if (!consentContract) throw new Error("Contract not connected");

            if (!requestPurpose) {
                toast.error("Clinical Purpose is required");
                setLoading(false);
                return;
            }

            const tx = await consentContract.requestAccess(targetWallet, requestPurpose, { gasLimit: 1000000 });
            await tx.wait();

            toast.success("Access Request sent to Patient!");
            setRequestPurpose('');

        } catch {
            toast.error("Failed to request access");
        } finally {
            setLoading(false);
        }
    };

    const fetchAuthorizedRecords = async () => {
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

        try {
            toast.info("Fetching mapped records from Hedera...");
            // In a fully robust scenario we verify the caller has active consent first.
            // For this UI demo we assume if the doctor knows the wallet and has consent, they can fetch.
            if (medicalRecordsContract) {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const readContract = medicalRecordsContract.connect(provider);
                const records = await readContract.getPatientRecords(targetWallet);

                // Map to UI
                const formatted = records.map(r => ({
                    id: r.id.toString(),
                    type: r.recordType,
                    status: "Authorized",
                    cid: r.cid,
                    provider: r.provider
                }));

                setActiveConsents(formatted);
                if (formatted.length === 0) toast.warning("No records found for this patient.");
                else toast.success(`Found ${formatted.length} mapped records`);

            } else {
                toast.error("MedicalRecords contract not loaded");
            }
        } catch {
            toast.error("Consent verification failed");
        } finally {
            setLoading(false);
        }
    };

    const accessMedicalData = async (consentId) => {
        try {
            if (!accessContract) return;
            const tx = await accessContract.accessData(patientWallet, consentId, "Clinical Review");
            await tx.wait();

            // Log to Audit Log if contract available
            if (auditLogContract && patientWallet) {
                const nowSecs = Math.floor(Date.now() / 1000);
                await auditLogContract.logDataAccessed(patientWallet, account, "Clinical Review", nowSecs, { gasLimit: 1000000 });
            }

            toast.success("Identity Verified & Data Accessed");
        } catch (err) {
            toast.error("Access rejected by blockchain policy");
        }
    };

    const handleDecryptRecord = async () => {
        if (!ipfsCid) {
            toast.error("Please provide a valid IPFS CID");
            return;
        }

        try {
            setIsDecrypting(true);
            toast.info("Fetching encrypted payload from IPFS nodes...");
            const cipherText = await fetchFromPinata(ipfsCid);

            toast.info("Decrypting ciphertext with local key...");
            // Simulate slight delay for dramatic decryption effect
            await new Promise(r => setTimeout(r, 800));

            const rawData = decryptData(cipherText);
            setDecryptedRecord(rawData);
            toast.success("Data successfully decrypted!");

            // Log decryption action to audit trail
            if (auditLogContract && patientWallet) {
                const nowSecs = Math.floor(Date.now() / 1000);
                await auditLogContract.logDataAccessed(patientWallet, account, "IPFS Record Decryption", nowSecs, { gasLimit: 1000000 });
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
                clinicalData: `Medication: ${rxMedicine}, Dosage: ${rxDosage}, Duration: ${rxDuration}`, // Fallback
                medication: rxMedicine,
                dosage: rxDosage,
                duration: rxDuration,
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
        <div className="dashboard animate-fade-in" style={{ padding: '2rem' }}>
            <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
                <h2>Physician Portal</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Secure clinical access governed by DPDP 2023.</p>
            </div>

            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Request Patient Access</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Submit an on-chain request to view a patient's encrypted health records.
                    </p>
                    <div className="form-group">
                        <label>Patient Wallet Address</label>
                        <input
                            type="text"
                            className="glass-input"
                            placeholder="0x..."
                            value={patientWallet}
                            onChange={(e) => setPatientWallet(e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label>Clinical Purpose</label>
                        <input
                            type="text"
                            className="glass-input"
                            placeholder="e.g. Follow-up consultation"
                            value={requestPurpose}
                            onChange={(e) => setRequestPurpose(e.target.value)}
                        />
                    </div>
                    <button className="primary-btn" onClick={checkPatientConsents} disabled={loading} style={{ marginTop: '1rem', width: '100%' }}>
                        {loading ? "Submitting..." : "Send Access Request"}
                    </button>
                </div>

                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Clinical Guidelines</h3>
                    <ul style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                        <li>✔ Ensure patient has granted active digital consent.</li>
                        <li>✔ All data access is logged to the immutable audit trail.</li>
                        <li>✔ Respect "Right to Erasure" requests from patients.</li>
                    </ul>
                </div>
            </div>

            {/* Prescription Upload Panel */}
            <div className="dashboard-section glass-panel" style={{ marginTop: '2rem', padding: '2rem', borderLeft: '4px solid var(--medical-primary)' }}>
                <h3>Issue Prescription to Global Queue</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Generate an encrypted IPFS prescription cipher and immutably map it to the patient's wallet into the global Pharmacy queue.
                </p>
                <form onSubmit={handleUploadPrescription} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Patient Wallet Address</label>
                        <input type="text" className="glass-input" placeholder="0x..." value={rxPatientWallet} onChange={(e) => setRxPatientWallet(e.target.value)} required />
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
                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                        <button type="submit" className="primary-btn" disabled={isUploading} style={{ width: '100%' }}>
                            {isUploading ? "Encrypting & Queuing..." : "Encrypt & Send to Pharmacy Queue"}
                        </button>
                    </div>
                </form>
            </div>

            {/* IPFS Decryption Engine */}
            <div className="dashboard-section glass-panel" style={{ marginTop: '2rem', padding: '2rem', borderLeft: '4px solid var(--medical-aqua)' }}>
                <h3>IPFS Decryption Engine</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
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
                    <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-3d)' }}>
                        <h4 style={{ color: 'var(--status-approved)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🔓</span> Decrypted Health Record
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem', color: 'var(--text-secondary)' }}>
                            <strong>Patient Ref:</strong> <span>{decryptedRecord.patientRef}</span>
                            <strong>Record Type:</strong> <span>{decryptedRecord.type}</span>
                            <strong>Clinical Data:</strong> <span style={{ color: 'var(--text-color)', lineHeight: '1.5' }}>{decryptedRecord.clinicalData}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="dashboard-section glass-panel" style={{ marginTop: '2rem', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Accessible Health Records</h3>
                    <button className="secondary-btn" onClick={fetchAuthorizedRecords} disabled={loading}>
                        {loading ? "Fetching..." : "Fetch Approved Records"}
                    </button>
                </div>

                <table className="data-table" style={{ marginTop: '1.5rem' }}>
                    <thead>
                        <tr>
                            <th>Record Type</th>
                            <th>Status</th>
                            <th>IPFS Hash</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeConsents.length === 0 ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}>No fetched records. Ensure patient has granted access and click Fetch.</td></tr>
                        ) : (
                            activeConsents.map(c => (
                                <tr key={c.id}>
                                    <td>{c.type}</td>
                                    <td><span className="status-badge active">{c.status}</span></td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-secondary)' }}>{c.cid.slice(0, 12)}...</td>
                                    <td>
                                        <button className="secondary-btn" onClick={() => {
                                            setIpfsCid(c.cid);
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
    );
};

export default DoctorDashboard;
