import React from 'react';

const DPDPNotice = ({ purpose, dataTypes, onAccept, onCancel }) => {
    return (
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--medical-primary)', background: 'rgba(30, 58, 138, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--medical-primary)', color: 'white', padding: '0.75rem', borderRadius: '12px', fontSize: '1.5rem' }}>⚖️</div>
                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Section 5 Compliance Notice</h3>
            </div>

            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                In accordance with the <strong>Digital Personal Data Protection Act (DPDP) 2023</strong>, we hereby provide notice of the following:
            </p>

            <div className="notice-details" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ borderLeft: '4px solid var(--medical-primary)', paddingLeft: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--medical-primary)', marginBottom: '0.25rem' }}>1. Specified Purpose</h4>
                    <p style={{ margin: 0, fontSize: '1.05rem' }}>{purpose || "Clinical treatment and healthcare coordination."}</p>
                </div>

                <div style={{ borderLeft: '4px solid #14B8A6', paddingLeft: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#14B8A6', marginBottom: '0.25rem' }}>2. Data Categories</h4>
                    <p style={{ margin: 0, fontSize: '1.05rem' }}>{dataTypes || "Medical history, prescriptions, and lab reports."}</p>
                </div>

                <div style={{ borderLeft: '4px solid #F59E0B', paddingLeft: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#F59E0B', marginBottom: '0.25rem' }}>3. Your Rights</h4>
                    <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                        <li>Right to withdraw consent at any time.</li>
                        <li>Right to grievance redressal.</li>
                        <li>Right to nomination.</li>
                    </ul>
                </div>
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
                <button 
                    className="primary-btn" 
                    onClick={onAccept}
                    style={{ flex: 1, padding: '1rem' }}
                >
                    I Understand & Proceed
                </button>
                <button 
                    className="secondary-btn" 
                    onClick={onCancel}
                    style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--border-light)' }}
                >
                    Cancel
                </button>
            </div>
            
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
                For detailed info, visit the <a href="#/compliance" style={{ color: 'var(--medical-primary)' }}>Compliance Portal</a>.
            </p>
        </div>
    );
};

export default DPDPNotice;
