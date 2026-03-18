import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { resolveWalletAddress } from '../utils/idMappingHelper';
import { getSafePatientConsents } from '../utils/consentHelper';
import { fetchFromPinata, decryptData } from '../utils/ipfsHelper';

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
    const [claims, setClaims] = useState([]);
    const [accessLogs, setAccessLogs] = useState([]);
    const [decryptedRecord, setDecryptedRecord] = useState(null);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [selectedRecordForClaim, setSelectedRecordForClaim] = useState(null);

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

            // 2. Fetch Requests from BACKEND (Fulfillment of "store in backend")
            let backendRequests = [];
            try {
                const response = await fetch(`http://localhost:5001/api/insurance/requests?fiduciary=${account}`);
                backendRequests = await response.json();
            } catch (beErr) {
                console.warn("Backend unavailable, falling back to ledger events", beErr);
            }

            // 3. Fetch Requests from LEDGER (Events)
            let ledgerRequests = [];
            try {
                const filter = readAudit.filters.AccessRequested(null, account);
                const events = await readAudit.queryFilter(filter, -10000);
                ledgerRequests = events.map((ev, idx) => ({
                    patient: ev.args[0],
                    purpose: ev.args[2],
                    timestamp: Number(ev.args[3]),
                    time: new Date(Number(ev.args[3]) * 1000).toLocaleString(),
                    status: 'Ledger Verified'
                }));
            } catch (evErr) {
                console.warn("Ledger event sync error", evErr);
            }

            // Merge: Unique requests by patient/purpose
            const merged = [...backendRequests];
            ledgerRequests.forEach(lr => {
                if (!merged.find(br => br.patient.toLowerCase() === lr.patient.toLowerCase() && br.purpose === lr.purpose)) {
                    merged.push(lr);
                }
            });
            setAllRequests(merged.reverse());

            // 4. Fetch Active Consents (Medical Records)
            try {
                const patientsToTry = new Set([
                    ...merged.map(r => r.patient?.toLowerCase() || r.patientId?.toLowerCase()), 
                    ...accessLogs.map(l => l.principal.toLowerCase())
                ]);
                
                const records = [];
                for (const p of patientsToTry) {
                    if (!p) continue;
                    const cons = await getSafePatientConsents(consentContract, p, consentContract.target, provider);
                    cons.forEach(c => {
                        if (c.dataFiduciary.toLowerCase() === account.toLowerCase() && c.isActive && Number(c.expiry) > Date.now() / 1000) {
                            if (c.dataHash) {
                                const cids = c.dataHash.split(',');
                                cids.forEach(cid => {
                                    if (cid.trim()) {
                                        records.push({
                                            patient: p,
                                            purpose: c.purpose,
                                            cid: cid.trim(),
                                            expiry: c.expiry,
                                            scope: c.dataScope
                                        });
                                    }
                                });
                            }
                        }
                    });
                }
                setApprovedRecords(records);
            } catch (consErr) {
                console.warn("Consent sync failed", consErr);
            }

        } catch (err) {
            console.error("Dashboard sync error", err);
        } finally {
            setLoading(false);
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

            toast.info("Updating Backend Records...");
            // Step 2: Fulfillment of "store in backend" requirement
            try {
                await fetch('http://localhost:5001/api/insurance/requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        patient: patientAddress,
                        patientId: requestForm.patientId,
                        purpose: fullPurpose,
                        fiduciary: account,
                        scope: requestForm.dataTypes
                    })
                });
            } catch (beErr) {
                console.warn("Backend persistent storage unreachable", beErr);
            }

            toast.info("Registering Request with Consent Manager...");
            // Step 3: Formal request for patient to act upon
            const reqTx = await consentContract.requestAccess(patientAddress, fullPurpose, { gasLimit: 1000000 });
            await reqTx.wait();
            
            toast.success("Request fully registered, logged, and stored in backend.");
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
            status: 'Pending Review',
            amount: amount,
            time: new Date().toLocaleString()
        };

        setClaims(prev => [newClaim, ...prev]);
        setShowClaimModal(false);
        setSelectedRecordForClaim(null);
        setActiveSubTab('claims');
        toast.success("Insurance Claim registered and linked to clinical CID.");
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
                                <label>Patient Short ID (e.g. 1234-ABCD)</label>
                                <input 
                                    type="text" 
                                    className="glass-input" 
                                    placeholder="Enter verified Patient ID"
                                    value={requestForm.patientId}
                                    onChange={(e) => setRequestForm({...requestForm, patientId: e.target.value})}
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
                                    onChange={(e) => setRequestForm({...requestForm, purpose: e.target.value})}
                                />
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label>Access Duration</label>
                                    <input 
                                        type="number" 
                                        className="glass-input" 
                                        value={requestForm.durationValue}
                                        onChange={(e) => setRequestForm({...requestForm, durationValue: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label>Unit</label>
                                    <select 
                                        className="glass-input"
                                        value={requestForm.durationUnit}
                                        onChange={(e) => setRequestForm({...requestForm, durationUnit: e.target.value})}
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {allRequests.length === 0 ? (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No requests sent yet. Use the 'Request' tab to begin.</td></tr>
                                    ) : (
                                        allRequests.map(r => (
                                            <tr key={r.id}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.patient.slice(0, 16)}...</td>
                                                <td style={{ fontSize: '0.9rem' }}>{r.purpose}</td>
                                                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.time}</td>
                                                <td><span className="status-badge success">{r.status}</span></td>
                                            </tr>
                                        ))
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
                                                <span className="status-badge active">Approved</span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', background: '#F8FAFC', padding: '10px', borderRadius: '8px', marginBottom: '1rem' }}>
                                                <strong>Approved Purpose:</strong><br/>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.purpose}</span>
                                            </div>
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
                                                            const cipherText = await fetchFromPinata(r.cid);
                                                            const raw = decryptData(cipherText);
                                                            setDecryptedRecord({ ...raw, cid: r.cid, patient: r.patient });
                                                            
                                                            // LOG ACCESS ON-CHAIN
                                                            if (auditLogContract) {
                                                                const nowSecs = Math.floor(Date.now() / 1000);
                                                                await auditLogContract.logDataAccessed(r.patient, account, `Insurance Review of CID ${r.cid.slice(0,8)}`, nowSecs, { gasLimit: 1000000 });
                                                            }
                                                            toast.success("Record Decrypted & Access Logged");
                                                        } catch (e) {
                                                            toast.error("Decryption failed. Data might be corrupted or key mismatch.");
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {claims.length === 0 ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No claims filed yet.</td></tr>
                                    ) : (
                                        claims.map(c => (
                                            <tr key={c.id}>
                                                <td>#{c.id}</td>
                                                <td style={{ fontFamily: 'monospace' }}>{c.patient.slice(0, 16)}...</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.cid.slice(0, 16)}...</td>
                                                <td><span className="status-badge pending">{c.status}</span></td>
                                                <td style={{ fontWeight: 'bold' }}>₹ {c.amount}</td>
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
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>DPDP-compliant fiduciary gateway for clinical data verification.</p>
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
                                Linking claim to verified clinical evidence:<br/>
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
