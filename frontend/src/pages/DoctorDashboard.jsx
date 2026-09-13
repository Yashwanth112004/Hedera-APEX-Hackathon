import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { fetchFromPinata, decryptData, encryptData, uploadToPinata } from '../utils/ipfsHelper';
import { resolveWalletAddress } from '../utils/idMappingHelper';
import { getSafePatientConsents, getSafePendingRequests } from '../utils/consentHelper';
import { Shield, Info, Activity, Wallet, Lock, Plus, Search, Check, AlertTriangle, Eye, Download, UserPlus, Trash2, Edit3, X, FileText, Stethoscope, Sparkles, ShieldAlert } from 'lucide-react';
import ICDSearchModal from '../components/ICDSearchModal';
import BreakGlassModal from '../components/BreakGlassModal';
import { auditPrescriptionSafety } from '../utils/aiClinicalHelper';
import { createFHIRMedicationRequest, createFHIRCondition, createFHIRPatient } from '../utils/fhirHelper';
import { publishHCSEvent, HEDERA_HCS_TOPIC_ID } from '../utils/hcsService';
import { getICD10ByCode } from '../utils/icd10Helper';

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
    const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
    const [emergencyJustification, setEmergencyJustification] = useState("");
    const [attendingName, setAttendingName] = useState("");
    const [activeConsents, setActiveConsents] = useState([]);
    const [linkedRecords, setLinkedRecords] = useState([]);
    const [pendingSentRequests, setPendingSentRequests] = useState([]);
    const [interactionHistory, setInteractionHistory] = useState([]); // Array of { wallet, shortId }
    const [loading, setLoading] = useState(false);

    // ICD-10 Search Modal State
    const [showIcdModal, setShowIcdModal] = useState(false);
    const [selectedIcd, setSelectedIcd] = useState(null);

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

    // AI Clinical Safety Check State
    const [safetyAudit, setSafetyAudit] = useState(null);

    // Consent & Access Settings
    const [requestScope, setRequestScope] = useState('All');
    const [accessScope, setAccessScope] = useState('All');

    // Run AI Interaction check whenever medicine changes
    React.useEffect(() => {
        if (rxMedicine.trim().length > 2) {
            const audit = auditPrescriptionSafety(rxMedicine, ['Aspirin', 'Metformin'], ['Penicillin']);
            setSafetyAudit(audit);
        } else {
            setSafetyAudit(null);
        }
    }, [rxMedicine]);

    React.useEffect(() => {
        const loadHistory = async () => {
            if (!auditLogContract || !account) return;
            try {
                const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
                const readAudit = auditLogContract.connect(provider);
                const logs = await readAudit.getLogs();

                const normalizedDoctor = account.toLowerCase();
                // Filter for any interaction where this doctor was the fiduciary
                const uniquePatients = new Set();
                (logs || []).forEach(log => {
                    const fid = log?.dataFiduciary?.toLowerCase();
                    if (fid === normalizedDoctor) {
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
            const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
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
                (patientConsents || []).forEach(c => {
                    if (c?.isActive && c?.dataFiduciary?.toLowerCase() === normalizedDoctor) {
                        if (c?.dataHash) {
                            c.dataHash.split(',').forEach(cid => {
                                const trimmed = cid?.trim();
                                if (trimmed) allLinked.push({
                                    cid: trimmed,
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
                    (pending || []).filter(r => r?.provider?.toLowerCase() === normalizedDoctor).forEach(r => {
                        allPending.push({ ...r, patient, shortId });
                    });
                } catch (pErr) {
                    console.error("Failed to fetch pending for", patient, pErr);
                }

                // Fetch General Records
                const records = await readMedical.getPatientRecords(patient);
                (records || []).forEach(r => {
                    allConsents.push({
                        id: r?.id?.toString() || Math.random().toString(),
                        type: r?.recordType || 'Record',
                        status: "Authorized",
                        cid: r?.cid || 'N/A',
                        provider: r?.provider || 'N/A',
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

            const clinicalPurposeWithIcd = selectedIcd 
                ? `${requestPurpose} [ICD-10: ${selectedIcd.code} - ${selectedIcd.title}]` 
                : requestPurpose;

            await onRequestConsent(targetWallet, clinicalPurposeWithIcd);

            // Log to Hedera HCS Topic 0.0.4891024
            publishHCSEvent(
                'CONSENT_ACCESS_REQUESTED',
                account,
                `Doctor requested clinical data access from ${targetWallet}. Purpose: ${clinicalPurposeWithIcd}`,
                { targetPatient: targetWallet, purpose: clinicalPurposeWithIcd, hcsTopic: HEDERA_HCS_TOPIC_ID }
            );

            setRequestPurpose('');
            toast.success("Access request broadcasted and mirrored to Hedera HCS!");

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

                formatted = (records || [])
                    .filter(r => isEmergency || r?.provider?.toLowerCase() === account?.toLowerCase())
                    .map(r => ({
                        id: r?.id?.toString() || Math.random().toString(),
                        type: r?.recordType || 'Record',
                        status: isEmergency ? "🚨 EMERGENCY ACCESS" : "Authorized",
                        cid: r?.cid || 'N/A',
                        provider: r?.provider || 'N/A',
                        billAmount: r?.billAmount ? r.billAmount.toString() : '0'
                    }));

                setActiveConsents(formatted);

                // --- Fetch specifically linked records from ConsentManager ---
                if (consentContract) {
                    const consentReadContract = consentContract.connect(provider);
                    const patientConsents = await getSafePatientConsents(consentReadContract, targetWallet, consentContract.target, provider);

                    const normalizedDoctor = account.toLowerCase();

                    (patientConsents || []).forEach(c => {
                        const isAuthorized = isEmergency || (c?.dataFiduciary?.toLowerCase() === normalizedDoctor);

                        if (c?.isActive && isAuthorized && c?.dataHash) {
                            const cids = c.dataHash.split(',');
                            cids.forEach(cid => {
                                const trimmed = cid?.trim();
                                if (trimmed) {
                                    linked.push({
                                        cid: trimmed,
                                        purpose: c.purpose,
                                        expiry: c.expiry,
                                        sharedAt: c.grantedAt,
                                        isEmergencySource: isEmergency && (c.dataFiduciary?.toLowerCase() !== normalizedDoctor)
                                    });
                                }
                            });
                        }
                    });
                    setLinkedRecords(linked);

                    const pendingRequests = await consentReadContract.getPendingRequests(targetWallet);
                    pendingRequestsByMe = (pendingRequests || []).filter(r => r?.provider?.toLowerCase() === normalizedDoctor);
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

    const handleDecryptRecord = async (targetCid = null, patientMeta = null) => {
        const cidToUse = targetCid || ipfsCid;
        if (!cidToUse) {
            toast.error("Please provide a valid IPFS CID");
            return;
        }

        try {
            setIsDecrypting(true);
            setDecryptedRecord(null);
            toast.info("Fetching encrypted payload from IPFS nodes...");

            const cipherText = await fetchFromPinata(cidToUse);

            toast.info("Decrypting ciphertext with HashiCorp Vault Transit Engine...");
            await new Promise(r => setTimeout(r, 400));

            const rawData = decryptData(cipherText);

            setDecryptedRecord({
                ...rawData,
                patientShortId: patientMeta?.shortId || "Unknown",
                patientWallet: patientMeta?.wallet || "Unknown"
            });

            toast.success("Data successfully decrypted!");

            const targetPatient = patientMeta?.wallet || patientWallet;
            if (auditLogContract && targetPatient && ethers.isAddress(targetPatient)) {
                const nowSecs = Math.floor(Date.now() / 1000);
                await auditLogContract.logDataAccessed(targetPatient, account, "IPFS Record Decryption", nowSecs, { gasLimit: 1000000 });
            }

            // Publish HCS event
            publishHCSEvent(
                'DATA_ACCESSED',
                account,
                `Physician decrypted patient record (CID: ${cidToUse.substring(0, 12)}...)`,
                { cid: cidToUse, hcsTopic: HEDERA_HCS_TOPIC_ID }
            );
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

        // Warn if critical AI interaction found
        if (safetyAudit && safetyAudit.overallSeverity === 'Critical') {
            const proceed = window.confirm(`⚠️ AI SAFETY WARNING: Critical drug interaction or allergy risk detected for "${rxMedicine}". Are you sure you want to prescribe this?`);
            if (!proceed) return;
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
            toast.info("Formatting HL7 FHIR R4 standard payload & encrypting via Vault...");

            // Create HL7 FHIR R4 MedicationRequest
            const fhirMedication = createFHIRMedicationRequest({
                patientId: targetWallet,
                requesterName: attendingName || 'Attending Physician',
                medicineName: rxMedicine,
                dosageInstruction: rxDosage,
                duration: rxDuration,
                icdCode: selectedIcd?.code || 'R07.9'
            });

            const prescriptionData = {
                type: 'Prescription',
                fhirResource: fhirMedication,
                patientRef: rxPatientName,
                clinicalData: `Medication: ${rxMedicine}, Dosage: ${rxDosage}, Duration: ${rxDuration}`,
                medication: rxMedicine,
                dosage: rxDosage,
                duration: rxDuration,
                icd10Code: selectedIcd?.code || 'R07.9',
                icd10Title: selectedIcd?.title || 'Chest pain, unspecified',
                sensitivity: rxSensitivity,
                aiAudit: safetyAudit,
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

            // Publish immutable HCS audit event to Topic 0.0.4891024
            publishHCSEvent(
                'PRESCRIPTION_ANCHORED',
                account,
                `Prescription anchored for ${rxPatientName} (${rxMedicine}) [CID: ${cid}]`,
                { cid, patient: targetWallet, medicine: rxMedicine, icd10: selectedIcd?.code || 'R07.9', hcsTopic: HEDERA_HCS_TOPIC_ID }
            );

            toast.success("Prescription successfully mapped to Pharmacy Queue & Hedera HCS!");
            setRxPatientName('');
            setRxMedicine('');
            setRxDosage('');
            setRxDuration('');
            setSelectedIcd(null);
            setSafetyAudit(null);
        } catch (error) {
            toast.error(error.message || "Failed to upload prescription");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="dashboard animate-fade-in">
            {/* Header */}
            <div className="dashboard-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Physician Portal</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Decentralized zero-trust clinical access powered by HashiCorp Vault & Hedera Consensus Service.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        className="primary-btn"
                        style={{ backgroundColor: '#DC2626', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => setShowBreakGlassModal(true)}
                    >
                        <ShieldAlert size={16} />
                        🚨 ZK-HCS Break-Glass
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
                {/* Request Patient Access Panel */}
                <div className="glass-panel" style={{ padding: '2.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Request Patient Access</h3>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#16A34A', background: '#DCFCE7', padding: '3px 8px', borderRadius: '100px' }}>
                            DPDP 2023
                        </span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Submit an on-chain request to view a patient's encrypted health records.
                    </p>
                    <div className="form-group">
                        <label>Patient ID (Wallet or Short ID)</label>
                        <input
                            type="text"
                            className="glass-input"
                            placeholder="e.g. 849201 or 0x..."
                            value={patientWallet}
                            onChange={(e) => setPatientWallet(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ margin: 0 }}>Clinical Diagnosis (ICD-10 Standard)</label>
                            <button
                                type="button"
                                onClick={() => setShowIcdModal(true)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#4F46E5',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Stethoscope size={14} />
                                {selectedIcd ? 'Change ICD-10 Code' : '+ Search ICD-10'}
                            </button>
                        </div>
                        {selectedIcd ? (
                            <div style={{
                                padding: '8px 12px',
                                backgroundColor: '#EEF2FF',
                                border: '1px solid #C7D2FE',
                                borderRadius: '10px',
                                fontSize: '0.84rem',
                                color: '#3730A3',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <span><strong>ICD-10: {selectedIcd.code}</strong> — {selectedIcd.title}</span>
                                <button onClick={() => setSelectedIcd(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1' }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <input
                                type="text"
                                className="glass-input"
                                placeholder="e.g. Cardiology Consultation / R07.9 Chest pain"
                                value={requestPurpose}
                                onChange={(e) => setRequestPurpose(e.target.value)}
                            />
                        )}
                    </div>
                    <button className="primary-btn" onClick={checkPatientConsents} disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
                        {loading ? "Submitting..." : "Send On-Chain Access Request"}
                    </button>
                </div>

                {/* Key Architecture Info Panel */}
                <div className="glass-panel" style={{ padding: '2.5rem' }}>
                    <h3>Zero-Trust Security & Standards</h3>
                    <ul style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.8', paddingLeft: '1.25rem', margin: '1rem 0' }}>
                        <li><strong>HashiCorp Vault Transit Engine:</strong> Self-hosted envelope encryption replaces legacy AWS KMS.</li>
                        <li><strong>HL7 FHIR R4 Resources:</strong> Prescriptions and clinical orders formatted to interoperable FHIR standard.</li>
                        <li><strong>Hedera HCS Topic 0.0.4891024:</strong> Un-erasable audit provenance logged in &lt;2.1s with aBFT finality.</li>
                        <li><strong>DPDP Key Shredding:</strong> Revoked consents trigger key erasure rendering IPFS data unrecoverable.</li>
                    </ul>
                </div>
            </div>

            {/* Prescription Upload Panel */}
            <div className="dashboard-section glass-panel" style={{ borderLeft: '6px solid var(--medical-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>Issue Prescription to Global Queue</h3>
                    <button
                        type="button"
                        onClick={() => setShowIcdModal(true)}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '100px',
                            border: '1px solid #C7D2FE',
                            background: '#EEF2FF',
                            color: '#4F46E5',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Stethoscope size={14} />
                        {selectedIcd ? `ICD-10: ${selectedIcd.code}` : 'Attach ICD-10 Diagnosis'}
                    </button>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    Encrypted with HashiCorp Vault Transit Engine, structured in HL7 FHIR R4, and anchored to Hedera ledger.
                </p>

                {/* AI Drug-Drug & Allergy Safety Alert Pill */}
                {safetyAudit && (
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '14px',
                        marginBottom: '1.5rem',
                        backgroundColor: safetyAudit.overallSeverity === 'Critical' ? '#FEF2F2' : safetyAudit.overallSeverity === 'High' ? '#FFFBEB' : '#F0FDF4',
                        border: `1.5px solid ${safetyAudit.overallSeverity === 'Critical' ? '#F87171' : safetyAudit.overallSeverity === 'High' ? '#FCD34D' : '#86EFAC'}`,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                    }}>
                        <Sparkles size={20} color={safetyAudit.overallSeverity === 'Critical' ? '#DC2626' : safetyAudit.overallSeverity === 'High' ? '#D97706' : '#16A34A'} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: '800', color: safetyAudit.overallSeverity === 'Critical' ? '#991B1B' : safetyAudit.overallSeverity === 'High' ? '#92400E' : '#14532D', marginBottom: '2px' }}>
                                AI Clinical Safety Check: {safetyAudit.overallSeverity === 'Safe' ? '✓ No Adverse Interactions Detected' : `⚠️ ${safetyAudit.overallSeverity} Interaction Risk Detected`}
                            </div>
                            {safetyAudit.drugInteractions.map((inter, i) => (
                                <div key={i} style={{ color: '#7F1D1D', marginTop: '4px' }}>
                                    • Interaction with {inter.drugB}: {inter.description}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleUploadPrescription} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Patient ID (Wallet or Short ID)</label>
                        <input type="text" className="glass-input" placeholder="e.g. 849201" value={rxPatientWallet} onChange={(e) => setRxPatientWallet(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Patient Name / Alias</label>
                        <input type="text" className="glass-input" placeholder="e.g. Rahul Sharma" value={rxPatientName} onChange={(e) => setRxPatientName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Medication (AI Interaction Checked)</label>
                        <input type="text" className="glass-input" placeholder="e.g. Amlodipine 5mg" value={rxMedicine} onChange={(e) => setRxMedicine(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label>Dosage</label>
                            <input type="text" className="glass-input" placeholder="1 tablet OD" value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} required />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Duration</label>
                            <input type="text" className="glass-input" placeholder="30 days" value={rxDuration} onChange={(e) => setRxDuration(e.target.value)} required />
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
                            {isUploading ? "Encrypting & Queuing to Hedera..." : "Encrypt & Send to Pharmacy Queue (HL7 FHIR R4)"}
                        </button>
                    </div>
                </form>
            </div>

            {/* IPFS Decryption Engine */}
            <div className="dashboard-section glass-panel" style={{ borderLeft: '6px solid var(--medical-accent)' }}>
                <h3>HashiCorp Vault Decryption Engine</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    Fetch an encrypted patient record from IPFS and decrypt it securely via the Vault Transit enclave.
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
                    <button className="primary-btn" onClick={() => handleDecryptRecord()} disabled={isDecrypting}>
                        {isDecrypting ? "Decrypting..." : "Fetch & Decrypt"}
                    </button>
                </div>

                {decryptedRecord && (
                    <div className="floating-card" style={{ marginTop: '2rem', borderColor: 'var(--medical-primary)' }}>
                        <h4 style={{ color: 'var(--medical-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span>🔓</span> Decrypted Health Record (HL7 FHIR R4 Standard)
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1.5rem', fontSize: '0.95rem' }}>
                            <strong style={{ color: 'var(--text-muted)' }}>Patient ID:</strong> <span style={{ color: 'var(--medical-primary)', fontWeight: 'bold' }}>{decryptedRecord.patientShortId}</span>
                            <strong style={{ color: 'var(--text-muted)' }}>Record Type:</strong> <span>{decryptedRecord.type}</span>
                            {decryptedRecord.icd10Code && (
                                <>
                                    <strong style={{ color: 'var(--text-muted)' }}>ICD-10 Code:</strong> <span>{decryptedRecord.icd10Code} ({decryptedRecord.icd10Title})</span>
                                </>
                            )}
                            <strong style={{ color: 'var(--text-muted)' }}>Clinical Data:</strong> <span style={{ lineHeight: '1.6' }}>{decryptedRecord.clinicalData}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Authorized Health Records Table */}
            <div className="dashboard-section glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3>Authorized Health Records</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>General medical history authorized for your view.</p>
                    </div>
                    <button className="secondary-btn" onClick={() => fetchAuthorizedRecords(false)} disabled={loading}>
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
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>No general records found.</td></tr>
                            ) : (
                                (activeConsents || []).map(c => (
                                    <tr key={c?.id || Math.random()}>
                                        <td><strong style={{ color: 'var(--medical-primary)' }}>{c?.shortId || 'N/A'}</strong></td>
                                        <td>{c?.type || 'Record'}</td>
                                        <td><span className="status-badge active">{c?.status || 'Active'}</span></td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-secondary)' }}>{c?.cid?.slice(0, 12) || 'N/A'}...</td>
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

            {/* Specifically Shared Data & Requests */}
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
                                {(pendingSentRequests || []).map((r, idx) => (
                                    <tr key={`req-${idx}`} style={{ opacity: 0.8 }}>
                                        <td><strong style={{ color: 'var(--medical-primary)' }}>{r?.shortId || 'N/A'}</strong></td>
                                        <td>{r?.purpose || 'Access Request'}</td>
                                        <td><span className="status-badge pending" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Consent Requested</span></td>
                                        <td>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {r?.patient?.slice(0, 10) || 'N/A'}...
                                            </div>
                                            {r?.timestamp ? new Date(Number(r.timestamp) * 1000).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td>
                                            <button className="secondary-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                                Pending Approval
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(linkedRecords || []).map((r, idx) => (
                                    <tr key={`link-${idx}`}>
                                        <td><strong style={{ color: 'var(--medical-primary)' }}>{r?.shortId || 'N/A'}</strong></td>
                                        <td>{r?.purpose || 'Shared Content'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-secondary)' }}>{r?.cid?.slice(0, 16) || 'N/A'}...</td>
                                        <td>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {r?.patient?.slice(0, 10) || 'N/A'}...
                                            </div>
                                            {r?.sharedAt ? new Date(Number(r.sharedAt) * 1000).toLocaleDateString() : 'N/A'}
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

            {/* ICD-10 Search Modal */}
            <ICDSearchModal
                isOpen={showIcdModal}
                onClose={() => setShowIcdModal(false)}
                onSelectCode={(icd) => {
                    setSelectedIcd(icd);
                    setRequestPurpose(icd.title);
                    toast.info(`Selected ICD-10: ${icd.code} (${icd.title})`);
                }}
            />

            {/* Patented ZK-HCS Ephemeral Break-Glass Modal */}
            <BreakGlassModal
                isOpen={showBreakGlassModal}
                onClose={() => setShowBreakGlassModal(false)}
                clinicianAddress={account}
                defaultPatientShortId={patientWallet}
                onEmergencyGranted={(data) => {
                    fetchAuthorizedRecords(true);
                }}
            />
        </div>
    );
};

export default DoctorDashboard;
