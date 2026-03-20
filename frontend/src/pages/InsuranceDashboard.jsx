import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { resolveWalletAddress } from '../utils/idMappingHelper';
import { getSafePatientConsents } from '../utils/consentHelper';
import { fetchFromPinata, decryptData } from '../utils/ipfsHelper';
import { generateLocalShortID, normalizeAddress } from '../utils/idMappingHelper';

const InsuranceDashboard = ({ account, consentContract, auditLogContract, accessContract, medicalRecordsContract, walletMapperContract }) => {
    const [activeSubTab, setActiveSubTab] = useState('overview');
    const [loading, setLoading] = useState(false);

    // Form States
    const [requestForm, setRequestForm] = useState({
        patientId: '',
        dataTypes: [],
        purpose: '',
        durationValue: '24',
        durationUnit: 'hours'
    });

    // Data States
    const [allRequests, setAllRequests] = useState([]);
    const [approvedRecords, setApprovedRecords] = useState([]);
    const [claims, setClaims] = useState(() => {
        const saved = localStorage.getItem(`insurance_claims_${account}`);
        return saved ? JSON.parse(saved) : [];
    });
    const [verifiedClaimIds, setVerifiedClaimIds] = useState(() => {
        const saved = localStorage.getItem(`insurance_verified_${account}`);
        return saved ? JSON.parse(saved) : [];
    });
    const [accessLogs, setAccessLogs] = useState([]);
    const [decryptedRecord, setDecryptedRecord] = useState(null);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [selectedRecordForClaim, setSelectedRecordForClaim] = useState(null);
    const [shortId, setShortId] = useState('');
    const [isRegisteringId, setIsRegisteringId] = useState(false);
    const [claimData, setClaimData] = useState({
        patientWallet: '',
        policyNumber: '',
        amount: '',
        diagnosis: '',
        hospital: ''
    });

    const dataOptions = [
        { id: 'lab', label: 'Lab Reports' },
        { id: 'diagnosis', label: 'Diagnosis' },
        { id: 'treatment', label: 'Treatment History' },
        { id: 'discharge', label: 'Discharge Summary' }
    ];

    const fetchInsuranceData = async () => {
        if (!consentContract || !account) return;
        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const readAudit = auditLogContract.connect(provider);

            // 1. Fetch Audit Logs from Hedera
            try {
                const logs = await readAudit.getLogs();
                const filtered = logs
                    .filter(l => l.dataFiduciary.toLowerCase() === account.toLowerCase())
                    .map((l, i) => ({
                        id: i,
                        principal: l.dataPrincipal,
                        action: l.action,
                        purpose: l.purpose,
                        time: new Date(Number(l.timestamp) * 1000).toLocaleString()
                    }))
                    .reverse();
                setAccessLogs(filtered);
            } catch (logsErr) {
                console.warn("Audit log fetch error", logsErr);
            }

            // 2. Fetch Requests from LEDGER (Events)
            let ledgerRequests = [];
            try {
                const filter = readAudit.filters.AccessRequested(null, account);
                const events = await readAudit.queryFilter(filter, -10000);
                ledgerRequests = events.map((ev, idx) => {
                    const purpose = ev.args[2];
                    const amountMatch = purpose.match(/\| Amount: ([0-9.]+)/);
                    return {
                        id: ev.args[3].toString() || idx.toString(), // Use Hedera timestamp as unique ID if possible
                        patient: ev.args[0],
                        purpose: purpose,
                        amount: amountMatch ? amountMatch[1] : null,
                        timestamp: Number(ev.args[3]),
                        time: new Date(Number(ev.args[3]) * 1000).toLocaleString(),
                        status: 'Ledger Verified'
                    };
                });
            } catch (evErr) {
                console.warn("Ledger event sync error", evErr);
            }

            setAllRequests(ledgerRequests.reverse());

            // 3. Fetch Active Consents (Medical Records)
            try {
                const patientsToTry = new Set([
                    ...ledgerRequests.map(r => r.patient?.toLowerCase() || r.patientId?.toLowerCase()),
                    ...accessLogs.map(l => l.principal.toLowerCase())
                ]);

                const records = [];
                for (const p of patientsToTry) {
                    if (!p) continue;
                    try {
                        const cons = await getSafePatientConsents(consentContract, p, consentContract.target, provider);
                        
                        // Fetch the actual records from the contract to get bill amounts
                        let patientRecords = [];
                        if (medicalRecordsContract) {
                            try {
                                const medRead = medicalRecordsContract.connect(provider);
                                patientRecords = await medRead.getPatientRecords(p);
                            } catch (e) {
                                console.warn(`Could not fetch records for ${p}:`, e.message);
                            }
                        }

                        cons.forEach(c => {
                            if (c.dataFiduciary.toLowerCase() === account.toLowerCase() && c.isActive && Number(c.expiry) > Date.now() / 1000) {
                                if (c.dataHash) {
                                    const cids = c.dataHash.split(',');
                                    cids.forEach(cid => {
                                        const trimmedCid = cid.trim();
                                        if (trimmedCid) {
                                            // Match with patientRecords to find billAmount
                                            const match = patientRecords.find(pr => pr.cid === trimmedCid);
                                            records.push({
                                                patient: p,
                                                purpose: c.purpose,
                                                cid: trimmedCid,
                                                expiry: c.expiry,
                                                scope: c.dataScope,
                                                billAmount: match ? match.billAmount : 0
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    } catch (syncErr) {
                        console.warn(`Sync failed for patient ${p}:`, syncErr.message);
                    }
                }
                setApprovedRecords(records);

                // --- AUTO-SYNCHRONIZE INCOMING CLAIMS ---
                // If a patient granted consent with "Insurance Claim Filing" in the purpose,
                // auto-detect it as a "Claim" if not already tracked.
                const newAutoClaims = [];
                records.forEach(r => {
                    const p = (r.purpose || "").toLowerCase();
                    if (p.includes('insurance claim filing')) {
                        // Check if we already have this claim tracked (by CID)
                        const exists = claims.find(c => c.cid === r.cid);
                        if (!exists) {
                            newAutoClaims.push({
                                id: `AUTO-${r.cid.slice(0, 8)}-${Date.now() % 10000}`,
                                patient: r.patient,
                                cid: r.cid,
                                status: 'Waiting for Disburse',
                                amount: r.billAmount ? r.billAmount.toString() : '0',
                                time: new Date().toLocaleString()
                            });
                        }
                    }
                });

                if (newAutoClaims.length > 0) {
                    const updated = [...newAutoClaims, ...claims];
                    setClaims(updated);
                    localStorage.setItem(`insurance_claims_${account}`, JSON.stringify(updated));
                    toast.info(`Detected ${newAutoClaims.length} new incoming claim(s)!`);
                }
            } catch (consErr) {
                console.warn("Global consent sync failed", consErr);
            }

        } catch (err) {
            console.error("Dashboard sync error", err);
        } finally {
            setLoading(false);
        }

        if (walletMapperContract && account) {
            try {
                const id = await walletMapperContract.getShortIDFromWallet(normalizeAddress(account));
                if (id) setShortId(id);
            } catch (e) {
                console.warn("Could not fetch Insurance Short ID");
            }
        }
    };

    useEffect(() => {
        fetchInsuranceData();
    }, [account, activeSubTab]);

    const handleToggleDataType = (id) => {
        setRequestForm(prev => ({
            ...prev,
            dataTypes: prev.dataTypes.includes(id)
                ? prev.dataTypes.filter(t => t !== id)
                : [...prev.dataTypes, id]
        }));
    };

    const submitConsentRequest = async (e) => {
        e.preventDefault();
        if (!requestForm.patientId || !requestForm.purpose || requestForm.dataTypes.length === 0) {
            toast.error("Please fill all mandatory fields and select at least one data type.");
            return;
        }

        setLoading(true);
        try {
            const patientAddress = await resolveWalletAddress(requestForm.patientId, walletMapperContract);

            toast.info("Logging DPDP Access Request to Hedera Audit...");
            // Step 1: Explicitly Log Request to AuditLog for transparency
            const nowSecs = Math.floor(Date.now() / 1000);
            const scopeString = `Scope: ${requestForm.dataTypes.join(', ')} | Duration: ${requestForm.durationValue} ${requestForm.durationUnit}`;
            const fullPurpose = `[INSURANCE] ${requestForm.purpose} (${scopeString})`;

            const logTx = await auditLogContract.logAccessRequested(patientAddress, account, fullPurpose, nowSecs, { gasLimit: 1000000 });
            await logTx.wait();

            toast.info("Registering Request with Consent Manager...");
            // Step 2: Formal request for patient to act upon
            const reqTx = await consentContract.requestAccess(patientAddress, fullPurpose, { gasLimit: 1000000 });
            await reqTx.wait();

            toast.success("Request fully registered and logged on Hedera ledger.");
            setRequestForm({ patientId: '', dataTypes: [], purpose: '', durationValue: '24', durationUnit: 'hours' });
            setActiveSubTab('requests');
            fetchInsuranceData();
        } catch (err) {
            toast.error("Request failed: " + (err.reason || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClaim = (e) => {
        e.preventDefault();
        const amount = e.target.amount.value;
        if (!amount) return;

        const newClaim = {
            id: `CLM-${Date.now()}`,
            patient: selectedRecordForClaim.patient,
            cid: selectedRecordForClaim.cid,
            status: 'Waiting for Disburse',
            amount: amount,
            time: new Date().toLocaleString()
        };

        const updated = [newClaim, ...claims];
        setClaims(updated);
        localStorage.setItem(`insurance_claims_${account}`, JSON.stringify(updated));
        setShowClaimModal(false);
        setSelectedRecordForClaim(null);
        setActiveSubTab('claims');
        toast.success("Insurance Claim registered and linked to clinical CID.");
    };

    const handleRegisterShortID = async () => {
        if (!walletMapperContract || !account) return;
        const normalizedAccount = normalizeAddress(account);

        try {
            setIsRegisteringId(true);
            const generatedId = generateLocalShortID(normalizedAccount);
            toast.info(`Registering Corporate ID: ${generatedId}...`);
            
            const tx = await walletMapperContract.registerShortID(generatedId, { gasLimit: 800000 });
            await tx.wait();

            setShortId(generatedId);
            toast.success(`Insurance ID '${generatedId}' is now active!`);
        } catch (err) {
            const errMsg = err.message || "";
            if (errMsg.includes("already has a Short ID")) {
                const id = await walletMapperContract.getShortIDFromWallet(normalizedAccount);
                if (id) setShortId(id);
                toast.warning("Account already registered.");
            } else {
                toast.error("Registration failed: " + errMsg);
            }
        } finally {
            setIsRegisteringId(false);
        }
    };

    const handleDisburseClaim = async (claim) => {
        if (!account || !claim) return;
        
        try {
            setLoading(true);
            toast.info(`Resolving patient wallet for ${claim.patient}...`);
            
            // 1. Resolve Wallet Address (Handle both raw addresses and Short IDs)
            const patientWallet = await resolveWalletAddress(claim.patient, walletMapperContract);
            
            // 2. Execute HBAR Transfer (Claim Amount)
            // Note: For demo purposes, we treat INR as tiny bars or just a multiplier
            // User requested "reflected in patient wallet"
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            // Allow Insurer to edit amount
            const finalAmount = window.prompt(`Verify disbursement amount (INR) for ${claim.id}:`, claim.amount);
            if (finalAmount === null) return; // User cancelled
            
            // Let's send a small amount of HBAR proportional to the claim (e.g. 1 HBAR per 1000 INR for demo)
            const hbarAmount = (Number(finalAmount) / 1000).toFixed(4);
            
            toast.info(`Disbursing ${hbarAmount} HBAR to ${patientWallet.slice(0, 10)}... (Final: ₹${finalAmount})`);
            
            const tx = await signer.sendTransaction({
                to: patientWallet,
                value: ethers.parseEther(hbarAmount.toString()),
                gasLimit: 100000
            });
            
            await tx.wait();
            
            // 3. Log Disbursement to Audit Ledger for transparency
            try {
                const auditWithSigner = auditLogContract.connect(signer);
                const logTx = await auditWithSigner.logDataAccessed(
                    patientWallet,
                    account,
                    `[DISBURSEMENT] Final Amount: ₹${finalAmount} for Claim ${claim.id}`,
                    Math.floor(Date.now() / 1000),
                    { gasLimit: 1000000 }
                );
                await logTx.wait();
                toast.success("Disbursement Audit Logged on Ledger");
            } catch (logErr) {
                console.warn("Disbursement logged only to transaction history, audit ledger failed", logErr);
            }
            
            // 4. Update Status
            const updated = claims.map(c => 
                c.id === claim.id ? { ...c, status: 'Approved' } : c
            );
            setClaims(updated);
            localStorage.setItem(`insurance_claims_${account}`, JSON.stringify(updated));
            toast.success("Funds Disbursed to Healthcare Provider");
            fetchInsuranceData();
        } catch (err) {
            console.error("Disbursement Failed", err);
            toast.error("Disbursement Failed: " + (err.reason || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyClaim = (claimId) => {
        const updated = [...verifiedClaimIds, claimId];
        setVerifiedClaimIds(updated);
        localStorage.setItem(`insurance_verified_${account}`, JSON.stringify(updated));
        
        // Find the request in allRequests to create a formal claim if it has evidence
        const request = allRequests.find(r => r.id === claimId);
        if (request && request.purpose.includes('| Evidence:')) {
            const hasEvidence = request.purpose.includes('| Evidence:');
            const evidenceCIDs = hasEvidence ? request.purpose.split('| Evidence: ')[1].split(', ') : [];
            
            const newClaim = {
                id: `CLM-${claimId}`,
                patient: request.patient,
                cid: evidenceCIDs[0] || 'N/A', // Link to first evidence CID
                status: 'Waiting for Disburse',
                amount: request.amount || '0',
                time: new Date().toLocaleString(),
                verified: true
            };

            const updatedClaims = [...claims.filter(c => c.id !== newClaim.id), newClaim];
            setClaims(updatedClaims);
            localStorage.setItem(`insurance_claims_${account}`, JSON.stringify(updatedClaims));
            toast.success("Documents Verified. Claim synced to management tab.");
        } else {
            toast.success("Documents Verified. Disbursement unlocked.");
        }
    };

    const handleViewEvidence = (evdId) => {
        try {
            const vault = JSON.parse(localStorage.getItem('hedera_evidence_vault') || '{}');
            const evidence = vault[evdId];
            if (evidence) {
                // Convert Base64 (data URI) to Blob
                const base64Data = evidence.data.split(',')[1];
                const contentType = evidence.type;
                
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: contentType });
                const url = URL.createObjectURL(blob);
                
                const win = window.open(url, '_blank');
                if (!win) toast.error("Pop-up blocked. Please allow pop-ups for this site.");
            } else {
                toast.error("Evidence not found in local vault. (ID: " + evdId + ")");
            }
        } catch (err) {
            console.error("Evidence retrieval failed", err);
            toast.error("Failed to load local evidence.");
        }
    };

    const renderTabContent = () => {
        switch (activeSubTab) {
            case 'overview':
                return (
                    <div className="animate-fade-in">
                        <div className="dashboard-grid">
                            <div className="glass-panel stat-card">
                                <span className="stat-icon">📊</span>
                                <div>
                                    <h4>Active Consents</h4>
                                    <h2 style={{ color: 'var(--medical-primary)' }}>{approvedRecords.length}</h2>
                                </div>
                            </div>
                            <div className="glass-panel stat-card">
                                <span className="stat-icon">📝</span>
                                <div>
                                    <h4>Pending Claims</h4>
                                    <h2 style={{ color: 'var(--medical-primary)' }}>{claims.filter(c => c.status === 'Pending').length}</h2>
                                </div>
                            </div>
                            <div className="glass-panel stat-card">
                                <span className="stat-icon">🛡️</span>
                                <div>
                                    <h4>Compliance Score</h4>
                                    <h2 style={{ color: 'var(--status-approved)' }}>100%</h2>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel" style={{ marginTop: '2rem', padding: '2.5rem' }}>
                            <h3>Insurer Code of Conduct (DPDP)</h3>
                            <div className="floating-card" style={{ borderLeft: '4px solid var(--medical-primary)', marginTop: '1.5rem' }}>
                                <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
                                    As a Data Fiduciary, all data access via this portal must strictly adhere to the <strong>Purpose Limitation</strong> and <strong>Data Minimization</strong> principles.
                                    Every access event is irreversibly recorded on the Hedera ledger and is subject to patient oversight at any time.
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'request':
                return (
                    <div className="glass-panel animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem' }}>
                        <h2 style={{ marginBottom: '2rem' }}>Initiate Data Access Request</h2>
                        <form onSubmit={submitConsentRequest}>
                            <div className="form-group">
                                <label>Patient Short ID (e.g. 123-ABC)</label>
                                <input
                                    type="text"
                                    className="glass-input"
                                    placeholder="Enter verified Patient ID"
                                    value={requestForm.patientId}
                                    onChange={(e) => setRequestForm({ ...requestForm, patientId: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Required Data Types</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                                    {dataOptions.map(opt => (
                                        <div
                                            key={opt.id}
                                            onClick={() => handleToggleDataType(opt.id)}
                                            style={{
                                                padding: '1rem',
                                                borderRadius: '12px',
                                                border: `2px solid ${requestForm.dataTypes.includes(opt.id) ? 'var(--medical-primary)' : 'var(--glass-border)'}`,
                                                background: requestForm.dataTypes.includes(opt.id) ? 'rgba(20,184,166,0.1)' : 'rgba(255,255,255,0.02)',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.8rem'
                                            }}
                                        >
                                            <input type="checkbox" checked={requestForm.dataTypes.includes(opt.id)} readOnly style={{ pointerEvents: 'none' }} />
                                            <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{opt.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Purpose of Access (DPDP Requirement)</label>
                                <textarea
                                    className="glass-input"
                                    rows="3"
                                    placeholder="e.g. Health Insurance Claim Processing for Incident #INS-904"
                                    value={requestForm.purpose}
                                    onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })}
                                />
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label>Access Duration</label>
                                    <input
                                        type="number"
                                        className="glass-input"
                                        value={requestForm.durationValue}
                                        onChange={(e) => setRequestForm({ ...requestForm, durationValue: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label>Unit</label>
                                    <select
                                        className="glass-input"
                                        value={requestForm.durationUnit}
                                        onChange={(e) => setRequestForm({ ...requestForm, durationUnit: e.target.value })}
                                    >
                                        <option value="hours">Hours</option>
                                        <option value="days">Days</option>
                                    </select>
                                </div>
                            </div>

                            <button type="submit" className="primary-btn" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
                                {loading ? "Broadcasting to Ledger..." : "Submit Formal Request"}
                            </button>
                        </form>
                    </div>
                );

            case 'requests':
                return (
                    <div className="glass-panel animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3>Track All Access Requests</h3>
                            <button className="secondary-btn" onClick={fetchInsuranceData} style={{ fontSize: '0.8rem' }}>Refresh Tracking</button>
                        </div>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr style={{ background: '#F8FAFC' }}>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Patient Wallet</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Purpose & Metadata</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Log Date</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Hedera Status</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allRequests.length === 0 ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No requests sent yet. Use the 'Request' tab to begin.</td></tr>
                                    ) : (
                                        allRequests.map(r => {
                                            const hasEvidence = r.purpose.includes('| Evidence:');
                                            const evidenceCIDs = hasEvidence ? r.purpose.split('| Evidence: ')[1].split(', ') : [];
                                            const isVerified = verifiedClaimIds.includes(r.id.toString());

                                            return (
                                                <tr key={r.id}>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.patient.slice(0, 16)}...</td>
                                                    <td style={{ fontSize: '0.9rem' }}>
                                                         <div style={{ fontWeight: '600', color: 'var(--medical-primary)' }}>
                                                             {r.purpose.split(' | ')[0]}
                                                         </div>
                                                         {r.amount && (
                                                             <div style={{ fontSize: '0.85rem', color: 'var(--status-approved)', fontWeight: 'bold', marginTop: '4px' }}>
                                                                 💰 Requested: ₹{r.amount}
                                                             </div>
                                                         )}
                                                         {hasEvidence && (
                                                             <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                                                 {evidenceCIDs.map((cid, ci) => (
                                                                     <button key={ci} onClick={() => handleViewEvidence(cid.trim())} className="status-badge" style={{ fontSize: '0.65rem', background: 'var(--grad-teal)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                         📄 View PDF {ci+1}
                                                                     </button>
                                                                 ))}
                                                             </div>
                                                         )}
                                                     </td>
                                                     <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.time}</td>
                                                     <td><span className="status-badge success">{r.status}</span></td>
                                                    <td>
                                                        {hasEvidence && !isVerified && (
                                                            <button 
                                                                className="primary-btn" 
                                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
                                                                onClick={() => handleVerifyClaim(r.id.toString())}
                                                            >
                                                                Verify Documents
                                                            </button>
                                                        )}
                                                        {isVerified && <span className="status-badge active" style={{ fontSize: '0.7rem' }}>Verified</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );

            case 'records':
                return (
                    <div className="animate-fade-in">
                        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
                            <h3>Authorized Clinical Evidence</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Only records with active patient consent are visible here. Access is purpose-restricted.</p>

                            {approvedRecords.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    No authorized records found. Ensure patients have approved your requests.
                                </div>
                            ) : (
                                <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
                                    {approvedRecords.map((r, idx) => (
                                        <div key={idx} className="glass-panel floating-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--status-approved)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                <div>
                                                    <h4 style={{ margin: 0 }}>IPFS Record: {r.cid.slice(0, 8)}...</h4>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Patient: {r.patient.slice(0, 12)}...</span>
                                                 </div>
                                                 {(() => {
                                                     const claim = claims.find(c => c.cid === r.cid);
                                                     const status = claim ? claim.status : (r.purpose.toLowerCase().includes('claim filing') ? 'Waiting for Disburse' : 'Consent Approved');
                                                     const isFinal = status === 'Approved';
                                                     return (
                                                         <span className={`status-badge ${isFinal ? 'active' : 'pending'}`}>
                                                             {status}
                                                         </span>
                                                     );
                                                 })()}
                                             </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', background: '#F8FAFC', padding: '10px', borderRadius: '8px', marginBottom: '1rem' }}>
                                                <strong>Approved Purpose:</strong><br />
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    {r.purpose.split(' | Evidence:')[0]}
                                                </span>
                                            </div>

                                            {r.purpose.includes(' | Evidence: ') && (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <strong style={{ fontSize: '0.8rem', color: 'var(--medical-aqua)' }}>Hospital Submitted Evidence:</strong>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '5px' }}>
                                                        {r.purpose.split(' | Evidence: ')[1].split(', ').map((cid, cIdx) => (
                                                            <button 
                                                                key={cIdx}
                                                                onClick={() => handleViewEvidence(cid.trim())}
                                                                style={{ 
                                                                    fontSize: '0.7rem', 
                                                                    padding: '2px 8px', 
                                                                    borderRadius: '4px', 
                                                                    border: '1px solid var(--medical-aqua)',
                                                                    background: 'white',
                                                                    color: 'var(--medical-aqua)',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                📄 Doc {cIdx + 1}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {r.billAmount && Number(r.billAmount) > 0 && (
                                                <div style={{ padding: '0.8rem', background: 'var(--grad-teal)', borderRadius: '12px', color: 'white', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>BILL AMOUNT</span>
                                                    <span style={{ fontSize: '1.1rem', fontWeight: '900' }}>₹{r.billAmount.toString()}</span>
                                                </div>
                                            )}
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                                Expires: {new Date(Number(r.expiry) * 1000).toLocaleString()}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    className="primary-btn"
                                                    style={{ flex: 1, fontSize: '0.85rem' }}
                                                    onClick={async () => {
                                                        try {
                                                            setLoading(true);
                                                            
                                                            // STEP 1: LOG ACCESS ON-CHAIN (Transaction First)
                                                            if (auditLogContract) {
                                                                toast.info("Signing compliance log on Hedera...");
                                                                const nowSecs = Math.floor(Date.now() / 1000);
                                                                const tx = await auditLogContract.logDataAccessed(
                                                                    r.patient, 
                                                                    account, 
                                                                    `Insurance Review of CID ${r.cid.slice(0, 8)}`, 
                                                                    nowSecs, 
                                                                    { gasLimit: 1000000 }
                                                                );
                                                                await tx.wait();
                                                                toast.success("Access Logged on Ledger");
                                                            } else {
                                                                toast.error("Audit contract not available. Access denied.");
                                                                return;
                                                            }

                                                            // STEP 2: FETCH & DECRYPT (Only after success)
                                                            toast.info("Retrieving & Decrypting Patient Data...");
                                                            const cipherText = await fetchFromPinata(r.cid);
                                                            const raw = decryptData(cipherText);
                                                            setDecryptedRecord({ ...raw, cid: r.cid, patient: r.patient });
                                                            toast.success("Record Decrypted");
                                                        } catch (e) {
                                                            console.error("Access error:", e);
                                                            toast.error("Access failed: Transaction rejected or decryption error.");
                                                        } finally { setLoading(false); }
                                                    }}
                                                >
                                                    🔓 View Data
                                                </button>
                                                <button
                                                    className="secondary-btn"
                                                    style={{ flex: 1, fontSize: '0.85rem' }}
                                                    onClick={() => {
                                                        setSelectedRecordForClaim(r);
                                                        setClaimData({
                                                          patientWallet: r.patient,
                                                          policyNumber: '',
                                                          amount: r.billAmount ? r.billAmount.toString() : '',
                                                          diagnosis: r.purpose || '',
                                                          hospital: account
                                                        });
                                                        setShowClaimModal(true);
                                                    }}
                                                >
                                                    ➕ Create Claim
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {decryptedRecord && (
                            <div className="glass-panel animate-fade-in" style={{ borderLeft: '6px solid var(--medical-primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <h3>Patient Record Content</h3>
                                    <button className="secondary-btn" onClick={() => setDecryptedRecord(null)}>Close</button>
                                </div>
                                <div className="floating-card" style={{ background: '#F1F5F9', padding: '1.5rem' }}>
                                    <pre style={{ fontSize: '0.9rem', overflow: 'auto', maxHeight: '400px' }}>
                                        {JSON.stringify(decryptedRecord, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'claims':
                return (
                    <div className="glass-panel animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3>Claim Management</h3>
                            <button className="secondary-btn" onClick={() => setActiveSubTab('records')} style={{ fontSize: '0.8rem' }}>+ Create from Authorized Record</button>
                        </div>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr style={{ background: '#F8FAFC' }}>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Claim ID</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Patient Wallet</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Evidence CID</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Status</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Amount</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claims.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No claims filed yet.</td></tr>
                                    ) : (
                                        claims.map(c => (
                                            <tr key={c.id}>
                                                <td>#{c.id}</td>
                                                <td style={{ fontFamily: 'monospace' }}>{c.patient.slice(0, 16)}...</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.cid.slice(0, 16)}...</td>
                                                 <td>
                                                     <span className={`status-badge ${c.status === 'Approved' ? 'success' : 'pending'}`}>
                                                         {c.status}
                                                     </span>
                                                     {verifiedClaimIds.includes(c.id) || c.verified ? (
                                                         <div style={{ fontSize: '0.65rem', color: 'var(--status-approved)', marginTop: '2px', fontWeight: 'bold' }}>✓ Documents Verified</div>
                                                     ) : (
                                                         <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>⚠ Verification Pending</div>
                                                     )}
                                                 </td>
                                                 <td style={{ fontWeight: 'bold' }}>₹ {c.amount}</td>
                                                 <td>
                                                     {c.status !== 'Approved' && (
                                                         <>
                                                             {!(verifiedClaimIds.includes(c.id) || c.verified) ? (
                                                                 <button 
                                                                     className="secondary-btn" 
                                                                     style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', borderColor: 'var(--medical-primary)' }}
                                                                     onClick={() => handleVerifyClaim(c.id)}
                                                                 >
                                                                     Verify Docs
                                                                 </button>
                                                             ) : (
                                                                 <button 
                                                                     className="primary-btn" 
                                                                     style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', background: 'var(--grad-teal)' }}
                                                                     onClick={() => handleDisburseClaim(c)}
                                                                     disabled={loading}
                                                                 >
                                                                     {loading ? "..." : "Disburse Funds"}
                                                                 </button>
                                                             )}
                                                         </>
                                                     )}
                                                 </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );

            case 'logs':
                return (
                    <div className="glass-panel animate-fade-in">
                        <h3>Organizational Access Logs (Hedera)</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Immutable record of all data access events performed by your wallet.</p>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr style={{ background: '#F8FAFC' }}>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Patient Wallet</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Action Performed</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Purpose</th>
                                        <th style={{ color: 'var(--text-main)', fontWeight: '700' }}>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accessLogs.length === 0 ? (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No access logs found on-chain for your identity.</td></tr>
                                    ) : (
                                        accessLogs.map(log => (
                                            <tr key={log.id}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{log.principal.slice(0, 16)}...</td>
                                                <td><span className="role-badge" style={{ background: 'var(--medical-primary)', fontSize: '0.75rem' }}>{log.action}</span></td>
                                                <td style={{ fontSize: '0.9rem' }}>{log.purpose}</td>
                                                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{log.time}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );

            default: return null;
        }
    };

    return (
        <div className="dashboard animate-fade-in">
            <div className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--medical-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                        Insurance Governance
                    </h1>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>DPDP-compliant fiduciary gateway for clinical data verification.</p>
                    {shortId ? (
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Insurance ID:</span>
                            <span className="status-badge active" style={{ fontSize: '0.8rem' }}>{shortId}</span>
                        </div>
                    ) : (
                        <button 
                            className="secondary-btn" 
                            style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.3rem 0.8rem', borderColor: 'var(--medical-primary)' }}
                            onClick={handleRegisterShortID}
                            disabled={isRegisteringId}
                        >
                            {isRegisteringId ? "Registering..." : "📋 Register Corporate Short ID"}
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                    {['overview', 'request', 'requests', 'records', 'claims', 'logs'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveSubTab(tab)}
                            className={activeSubTab === tab ? 'primary-btn' : 'secondary-btn'}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.85rem',
                                border: 'none',
                                background: activeSubTab === tab ? 'var(--medical-primary)' : 'transparent',
                                color: activeSubTab === tab ? 'white' : 'var(--text-muted)'
                            }}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>
            {renderTabContent()}
            {showClaimModal && selectedRecordForClaim && (
                <div className="modal-overlay">
                    <div className="glass-panel modal" style={{ maxWidth: '500px', width: '90%', padding: '2.5rem' }}>
                        <div className="modal-header">
                            <h3>File New Payout Claim</h3>
                            <button className="close-btn" onClick={() => setShowClaimModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateClaim}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                Linking claim to verified clinical evidence:<br />
                                <strong style={{ color: 'var(--medical-primary)' }}>{selectedRecordForClaim.cid.slice(0, 20)}...</strong>
                            </p>

                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label>Patient Wallet / ID</label>
                                <input type="text" className="glass-input" value={selectedRecordForClaim.patient} readOnly />
                            </div>

                            <div className="form-group">
                                <label>Claim Amount (INR)</label>
                                <input type="number" name="amount" className="glass-input" placeholder="e.g. 50000" required />
                            </div>

                            <div className="modal-actions">
                                <button type="submit" className="primary-btn" style={{ width: '100%' }}>Register Claim Case</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InsuranceDashboard;
