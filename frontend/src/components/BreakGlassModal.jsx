import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, AlertTriangle, Key, CheckCircle2, Lock, FileText, UserCheck, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { deriveBreakGlassKey, vaultDecrypt } from '../utils/vaultCrypto';
import { publishHCSEvent, HEDERA_HCS_TOPIC_ID } from '../utils/hcsService';

const BreakGlassModal = ({ isOpen, onClose, clinicianAddress, defaultPatientShortId = '', onEmergencyGranted }) => {
  const [patientShortId, setPatientShortId] = useState(defaultPatientShortId);
  const [justification, setJustification] = useState('Critical Trauma / Unconscious Patient in Emergency Room');
  const [attendingClinician, setAttendingClinician] = useState('Dr. On-Duty Emergency Specialist');
  const [isActivating, setIsActivating] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600); // 60 minutes
  const [ephemeralKey, setEphemeralKey] = useState('');
  const [emergencyData, setEmergencyData] = useState(null);

  useEffect(() => {
    if (defaultPatientShortId) setPatientShortId(defaultPatientShortId);
  }, [defaultPatientShortId]);

  // Countdown timer for 60-minute session
  useEffect(() => {
    let timer;
    if (sessionActive && timeLeftSeconds > 0) {
      timer = setInterval(() => {
        setTimeLeftSeconds(prev => {
          if (prev <= 1) {
            setSessionActive(false);
            toast.error('Emergency Break-Glass 60-minute session has expired.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionActive, timeLeftSeconds]);

  const handleActivateBreakGlass = async () => {
    if (!patientShortId.trim()) {
      toast.error('Please enter the 6-digit Patient Short ID');
      return;
    }
    if (!justification.trim()) {
      toast.error('Clinical justification is mandatory under DPDP regulations');
      return;
    }

    setIsActivating(true);
    try {
      // 1. Generate HCS Consensus Timestamp simulation
      const hcsTimestamp = new Date().toISOString();
      const clinicianSig = `SIG_${clinicianAddress || '0xCLINICIAN'}_${Date.now()}`;

      // 2. Derive 60-minute Ephemeral Key
      const key = deriveBreakGlassKey(clinicianSig, hcsTimestamp, patientShortId);
      setEphemeralKey(key);

      // 3. Publish high-priority un-erasable alert to Hedera HCS Topic 0.0.4891024
      const hcsLog = publishHCSEvent(
        'EMERGENCY_BREAK_GLASS_ACTIVATED',
        clinicianAddress || '0xEMERGENCY_CLINICIAN',
        `HIGH PRIORITY: Break-Glass emergency access triggered for Patient ${patientShortId}. Reason: ${justification}`,
        {
          priority: 'CRITICAL_EMERGENCY',
          patientShortId,
          attendingClinician,
          justification,
          sessionDurationMinutes: 60,
          ephemeralKeyHash: key.substring(0, 16) + '...',
          hcsTopic: HEDERA_HCS_TOPIC_ID,
          dualSignatureProof: `DUAL_SIG_${clinicianAddress}_HCS_TOPIC_0.0.4891024`
        }
      );

      // 4. Mock retrieve and decrypt emergency critical health profile
      const criticalHealthData = {
        patientId: patientShortId,
        bloodGroup: 'O+ (Rh Positive)',
        criticalAllergies: ['Penicillin (Severe Anaphylaxis)', 'Sulfa Drugs'],
        chronicConditions: ['Type 2 Diabetes Mellitus [ICD-10: E11.9]', 'Hypertension [ICD-10: I10]'],
        activeMedications: ['Metformin 500mg BD', 'Amlodipine 5mg OD'],
        emergencyContacts: [
          { name: 'Dr. Ramesh (Guardian)', relation: 'Father / Guardian', phone: '+91 98765 43210' }
        ],
        advanceDirectives: 'Full Code / Resuscitate. Organ Donor: Yes.',
        breakGlassSessionExpires: new Date(Date.now() + 3600 * 1000).toLocaleTimeString()
      };

      setEmergencyData(criticalHealthData);
      setSessionActive(true);
      setTimeLeftSeconds(3600);
      toast.success('Break-Glass Emergency access derived! Logged immutably to Hedera HCS.');
      if (onEmergencyGranted) onEmergencyGranted(criticalHealthData);
    } catch (err) {
      console.error('Break glass activation failed:', err);
      toast.error('Emergency access authorization failed');
    } finally {
      setIsActivating(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.35)',
        border: '2px solid #EF4444',
        overflow: 'hidden',
        animation: 'modalSlideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.75rem',
          borderBottom: '1px solid #FEE2E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)'
            }}>
              <ShieldAlert size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#991B1B', margin: 0 }}>
                  Patented ZK-HCS Break-Glass Access
                </h3>
                <span style={{
                  backgroundColor: '#DC2626',
                  color: 'white',
                  fontSize: '0.68rem',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  letterSpacing: '0.05em'
                }}>
                  EMERGENCY
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#7F1D1D', margin: '2px 0 0 0' }}>
                60-Minute Ephemeral Decryption Engine for Incapacitated / Trauma Patients
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#FFFFFF',
              border: '1px solid #FCA5A5',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'pointer',
              color: '#991B1B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
          {!sessionActive ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #F87171',
                borderRadius: '14px',
                padding: '1rem',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <AlertTriangle size={22} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.84rem', color: '#991B1B', lineHeight: '1.5' }}>
                  <strong>Mandatory Regulatory Notice (DPDP 2023):</strong> Break-glass access creates an immutable, dual-signature audit alert on Hedera HCS Topic <code>0.0.4891024</code>. Unauthorized usage is subject to medical board and statutory review.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#1E293B', marginBottom: '6px' }}>
                  Patient 6-Digit Short ID or Wallet Address:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 849201 or 0x7099..."
                  value={patientShortId}
                  onChange={e => setPatientShortId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#1E293B', marginBottom: '6px' }}>
                  Attending Emergency Clinician Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Rajesh Sharma (NMC: 78491)"
                  value={attendingClinician}
                  onChange={e => setAttendingClinician(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#1E293B', marginBottom: '6px' }}>
                  Clinical Justification & Emergency Condition:
                </label>
                <textarea
                  rows={3}
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  placeholder="Describe emergency trauma, unconscious state, or critical condition..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>

              <button
                onClick={handleActivateBreakGlass}
                disabled={isActivating}
                style={{
                  padding: '14px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                  color: '#FFFFFF',
                  fontWeight: '800',
                  fontSize: '1rem',
                  border: 'none',
                  cursor: isActivating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 8px 20px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                {isActivating ? 'Deriving Ephemeral Key & Logging to HCS...' : 'Authorize Emergency Break-Glass (60 Min)'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Active Session Bar */}
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1.5px solid #F87171',
                borderRadius: '16px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={24} color="#DC2626" style={{ animation: 'spin 10s linear infinite' }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#991B1B' }}>
                      ACTIVE EPHEMERAL SESSION
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#7F1D1D', fontFamily: 'monospace' }}>
                      {formatTimer(timeLeftSeconds)} Remaining
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>HCS TOPIC MIRROR</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#16A34A' }}>● 0.0.4891024 Logged</div>
                </div>
              </div>

              {/* Decrypted Emergency Medical Card */}
              {emergencyData && (
                <div style={{
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>BLOOD GROUP</span>
                      <strong style={{ fontSize: '1.1rem', color: '#DC2626' }}>{emergencyData.bloodGroup}</strong>
                    </div>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>ADVANCE DIRECTIVE</span>
                      <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>{emergencyData.advanceDirectives}</strong>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#FEF2F2', padding: '12px 14px', borderRadius: '12px', border: '1px solid #FECACA' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#991B1B', display: 'block', marginBottom: '4px' }}>
                      CRITICAL ALLERGIES & CONTRAINDICATIONS
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.88rem', color: '#7F1D1D', fontWeight: '600' }}>
                      {emergencyData.criticalAllergies.map((all, i) => (
                        <li key={i}>{all}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      DOCUMENTED CHRONIC CONDITIONS
                    </span>
                    <div style={{ fontSize: '0.85rem', color: '#1E293B', fontWeight: '600' }}>
                      {emergencyData.chronicConditions.join(' • ')}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      EMERGENCY GUARDIAN / NEXT OF KIN
                    </span>
                    {emergencyData.emergencyContacts.map((cnt, i) => (
                      <div key={i} style={{ fontSize: '0.85rem', color: '#1E293B' }}>
                        <strong>{cnt.name}</strong> ({cnt.relation}) — 📞 {cnt.phone}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid #F1F5F9',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: '#64748B'
        }}>
          <span>HashiCorp Transit Enclave + Hedera HCS</span>
          <span>Topic: 0.0.4891024</span>
        </div>
      </div>
    </div>
  );
};

export default BreakGlassModal;
