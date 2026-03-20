import React, { useState } from 'react';
import { Shield, Scale, HelpCircle, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const LegalCompliance = () => {
    const [submitted, setSubmitted] = useState(false);
    const [grievance, setGrievance] = useState({
        wallet: '',
        category: 'Unauthorized Data Access',
        description: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!grievance.wallet || !grievance.description) {
            return toast.error("Please fill all required fields");
        }

        const newGrievance = {
            ...grievance,
            id: `GRV-${Date.now()}`,
            status: 'New',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString()
        };

        const existing = JSON.parse(localStorage.getItem('dpdp_grievances') || '[]');
        existing.push(newGrievance);
        localStorage.setItem('dpdp_grievances', JSON.stringify(existing));

        toast.success("Grievance filed successfully!");
        setSubmitted(true);

        // Auto-redirect simulation
        setTimeout(() => {
            // Note: In this single-page demo, we show the confirmation view
            // The Admin can see this in the Admin Portal independently.
        }, 2000);
    };

    if (submitted) {
        return (
            <div className="compliance-page animate-fade-in" style={{ padding: '4rem', textAlign: 'center' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '2rem', borderRadius: '24px', display: 'inline-block', marginBottom: '2rem' }}>
                    <CheckCircle size={64} color="#10B981" />
                </div>
                <h2 style={{ fontSize: '2rem', color: '#065F46', marginBottom: '1rem' }}>Grievance Submitted Successfully</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Your complaint (ID: {grievance.id || 'Pending'}) has been securely logged on the governance layer. <br/>
                    An Admin will review this shortly. You can track status in the System Governance portal.
                </p>
                <button className="secondary-btn" onClick={() => setSubmitted(false)}>File Another Grievance</button>
            </div>
        );
    }
    return (
        <div className="compliance-page animate-fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(30, 58, 138, 0.1)', borderRadius: '24px', marginBottom: '1.5rem' }}>
                    <Shield size={48} color="var(--medical-primary)" />
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#1E3A8A' }}>Grievance Redressal & Legal Portal</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Ensuring your rights under the Digital Personal Data Protection Act (DPDP) 2023.</p>
            </header>

            <div className="compliance-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {/* Rights Overview */}
                <section className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <Scale size={24} color="var(--medical-primary)" />
                        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Your Legal Rights</h2>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <li style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ color: 'var(--medical-primary)', fontWeight: 'bold' }}>•</div>
                            <div><strong>Right to Access:</strong> Summary of your processed data and entities shared with.</div>
                        </li>
                        <li style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ color: 'var(--medical-primary)', fontWeight: 'bold' }}>•</div>
                            <div><strong>Right to Erasure:</strong> Request deletion of data that is no longer necessary.</div>
                        </li>
                        <li style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ color: 'var(--medical-primary)', fontWeight: 'bold' }}>•</div>
                            <div><strong>Right to Nominate:</strong> Designate a person to act on your behalf in case of death or incapacity.</div>
                        </li>
                    </ul>
                </section>

                {/* Grievance Redressal */}
                <section className="glass-panel" style={{ padding: '2rem', border: '1px solid #FECACA', background: 'rgba(254, 202, 202, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <AlertCircle size={24} color="#DC2626" />
                        <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#991B1B' }}>Report a Violation</h2>
                    </div>
                    <p style={{ color: '#4B5563', marginBottom: '1.5rem' }}>If you believe your data has been misused or accessed without valid consent, please file a grievance below.</p>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input 
                            type="text" 
                            placeholder="Wallet Address / Short ID" 
                            className="glass-input" 
                            value={grievance.wallet}
                            onChange={(e) => setGrievance({...grievance, wallet: e.target.value})}
                            required
                        />
                        <select 
                            className="glass-input"
                            value={grievance.category}
                            onChange={(e) => setGrievance({...grievance, category: e.target.value})}
                        >
                            <option>Unauthorized Data Access</option>
                            <option>Refusal to Erase Data</option>
                            <option>Incorrect Data Storage</option>
                            <option>Other Grievance</option>
                        </select>
                        <textarea 
                            placeholder="Describe the incident..." 
                            className="glass-input" 
                            style={{ minHeight: '100px' }}
                            value={grievance.description}
                            onChange={(e) => setGrievance({...grievance, description: e.target.value})}
                            required
                        ></textarea>
                        <button type="submit" className="primary-btn" style={{ background: '#DC2626' }}>Submit Grievance</button>
                    </form>
                </section>

                {/* FAQ / Guidance */}
                <section className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <HelpCircle size={24} color="#14B8A6" />
                        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>DPDP FAQ</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <h4 style={{ marginBottom: '0.25rem' }}>What is a Consent Manager?</h4>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>An entity that manages your consents and acts on your behalf as per Section 6(7).</p>
                        </div>
                        <div>
                            <h4 style={{ marginBottom: '0.25rem' }}>How do I withdraw consent?</h4>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Go to your Dashboard, find the active consent, and click "Revoke". It is logged instantly on the blockchain.</p>
                        </div>
                    </div>
                </section>
            </div>

            <footer style={{ marginTop: '4rem', textAlign: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '2rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Official DPDP Framework Version: <strong>2023.1.2-SECURED</strong> <br/>
                    Ledger Network: <strong>Hedera Testnet (EVM)</strong>
                </p>
            </footer>
        </div>
    );
};

export default LegalCompliance;
