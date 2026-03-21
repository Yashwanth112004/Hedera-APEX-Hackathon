import React, { useEffect, useRef, useState } from 'react';

const steps = [
  {
    num: '01',
    title: 'Patient Grants Consent',
    desc: 'Patients manage permissions via a secure blockchain-linked wallet with one-tap control.',
    color: '#6A8F90',
    bg: 'linear-gradient(145deg, #F0F4F2 0%, #E6EAE8 100%)',
    border: '#C4D6D6',
    accent: 'rgba(106,143,144,0.12)',
    emoji: '👤'
  },
  {
    num: '02',
    title: 'Hospital Requests Access',
    desc: 'Verified entities submit real-time access requests through the RBAC-protected portal.',
    color: '#315046',
    bg: 'linear-gradient(145deg, #E6EAE8 0%, #D1DBD7 100%)',
    border: '#A9BDB7',
    accent: 'rgba(49,80,70,0.12)',
    emoji: '🏥'
  },
  {
    num: '03',
    title: 'Immutable Audit',
    desc: 'Smart contracts log every interaction on the Hedera ledger — tamper-proof, forever.',
    color: '#A8C256',
    bg: 'linear-gradient(145deg, #F0F4F2 0%, #E6F0CA 100%)',
    border: '#C0D87E',
    accent: 'rgba(168,194,86,0.12)',
    emoji: '🔒'
  },
];

const StepCard = ({ step, index, visible }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: step.bg,
        border: `1.5px solid ${hovered ? step.color + '60' : step.border}`,
        borderRadius: '28px',
        padding: '3rem 2.5rem',
        textAlign: 'left',
        boxShadow: hovered
          ? `0 24px 64px ${step.accent}, 0 4px 12px rgba(0,0,0,0.04)`
          : '0 4px 16px rgba(0,0,0,0.03)',
        transform: hovered
          ? 'translateY(-12px) scale(1.015)'
          : visible ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: `all 0.55s cubic-bezier(0.34,1,0.64,1) ${index * 100}ms`,
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative circle */}
      <div style={{
        position: 'absolute', top: '-30px', right: '-30px',
        width: '120px', height: '120px',
        borderRadius: '50%',
        background: step.accent,
        opacity: hovered ? 1 : 0.5,
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        transform: hovered ? 'scale(1.3)' : 'scale(1)',
        pointerEvents: 'none'
      }} />

      {/* Step badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '10px',
        marginBottom: '2rem'
      }}>
        <div style={{
          width: '44px', height: '44px',
          background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)`,
          borderRadius: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: '900', color: 'white',
          letterSpacing: '0.04em',
          boxShadow: `0 6px 20px ${step.accent}`,
          transform: hovered ? 'rotate(-5deg) scale(1.1)' : 'rotate(0) scale(1)',
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)'
        }}>
          {step.num}
        </div>
        <span style={{ fontSize: '1.6rem' }}>{step.emoji}</span>
      </div>

      <h3 style={{
        fontSize: '1.6rem', fontWeight: '900', color: '#1F332C',
        marginBottom: '1rem', letterSpacing: '-0.02em', lineHeight: 1.15
      }}>
        {step.title}
      </h3>
      <p style={{ fontSize: '1rem', color: '#687D75', lineHeight: '1.65' }}>
        {step.desc}
      </p>

      {/* Bottom accent bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: '2.5rem', right: '2.5rem', height: '3px',
        background: `linear-gradient(90deg, ${step.color}, transparent)`,
        borderRadius: '3px 3px 0 0',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.4s ease'
      }} />
    </div>
  );
};

const StandardTrust = () => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ padding: '8rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', marginBottom: '5rem',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'all 0.7s cubic-bezier(0.4,0,0.2,1)'
      }}>
        <p style={{
          fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.15em',
          color: '#6A8F90', textTransform: 'uppercase', marginBottom: '1rem'
        }}>
          HOW IT WORKS
        </p>
        <h2 style={{
          fontSize: '3.2rem', fontWeight: '900',
          background: 'linear-gradient(135deg, #1F332C 0%, #6A8F90 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', display: 'inline-block',
          marginBottom: '1rem', letterSpacing: '-0.03em', lineHeight: 1.1
        }}>
          The Standard for Medical Trust
        </h2>
        <p style={{ fontSize: '1.1rem', color: '#687D75', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
          A seamless flow designed for patients and clinicians — in three simple steps.
        </p>

        {/* Connector line */}
        <div style={{
          width: '60px', height: '3px',
          background: 'linear-gradient(90deg, #A8C256, #6A8F90)',
          borderRadius: '3px', margin: '2rem auto 0 auto',
          opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease 0.3s'
        }} />
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {steps.map((step, i) => (
          <StepCard key={i} step={step} index={i} visible={visible} />
        ))}
      </div>
    </div>
  );
};

export default StandardTrust;
