import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, History, UserCheck, Lock, Gavel } from 'lucide-react';

const features = [
  {
    title: 'Consent Management',
    desc: 'Granular control over who sees your data and for how long — with one-click revocation at any time.',
    icon: ShieldCheck, color: '#A8C256', bg: 'rgba(168,194,86,0.1)', glow: 'rgba(168,194,86,0.2)'
  },
  {
    title: 'Immutable Audit Logs',
    desc: 'Tamper-proof logs secured by Hedera Hashgraph consensus. Proof of every access, forever.',
    icon: History, color: '#6A8F90', bg: 'rgba(106,143,144,0.1)', glow: 'rgba(106,143,144,0.2)'
  },
  {
    title: 'Patient Data Ownership',
    desc: 'You own the keys to your records. No third-party intermediaries, no silent data sales.',
    icon: UserCheck, color: '#315046', bg: 'rgba(49,80,70,0.1)', glow: 'rgba(49,80,70,0.2)'
  },
  {
    title: 'Hospital Access Control',
    desc: 'Enterprise RBAC for hospitals to manage clinical permissions with role-level granularity.',
    icon: Lock, color: '#D4A373', bg: 'rgba(212,163,115,0.1)', glow: 'rgba(212,163,115,0.2)'
  },
  {
    title: 'Regulatory Compliance',
    desc: 'Native support for India\'s DPDP Act, HIPAA, and GDPR — with right to erasure built in.',
    icon: Gavel, color: '#8B9A46', bg: 'rgba(139,154,70,0.1)', glow: 'rgba(139,154,70,0.2)'
  },
];

const FeatureCard = ({ feature, index, visible }) => {
  const [hovered, setHovered] = useState(false);
  const Icon = feature.icon;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'white' : 'rgba(255,255,255,0.7)',
        borderRadius: '28px',
        padding: '2.75rem 2.25rem',
        border: `1.5px solid ${hovered ? feature.color + '40' : '#F1F5F9'}`,
        display: 'flex', flexDirection: 'column', gap: '1.25rem',
        boxShadow: hovered
          ? `0 24px 64px ${feature.glow}, 0 4px 12px rgba(0,0,0,0.04)`
          : '0 2px 12px rgba(0,0,0,0.03)',
        transform: hovered
          ? 'translateY(-10px) scale(1.012)'
          : visible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: `all 0.5s cubic-bezier(0.34,1,0.64,1) ${index * 80}ms`,
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)'
      }}
    >
      {/* Hover gradient bg */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '28px',
        background: hovered ? `radial-gradient(circle at 30% 30%, ${feature.bg} 0%, transparent 70%)` : 'transparent',
        transition: 'all 0.5s ease', pointerEvents: 'none'
      }} />

      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: '2.25rem', right: '2.25rem', height: '2px',
        background: `linear-gradient(90deg, transparent, ${feature.color}, transparent)`,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.5s ease', borderRadius: '0 0 4px 4px'
      }} />

      {/* Icon */}
      <div style={{
        width: '72px', height: '72px',
        background: feature.bg,
        border: `1px solid ${feature.color}25`,
        borderRadius: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: hovered ? `0 8px 24px ${feature.glow}` : 'none',
        transition: 'all 0.4s ease',
        transform: hovered ? 'scale(1.1) rotate(-3deg)' : 'scale(1) rotate(0deg)',
        position: 'relative', zIndex: 1
      }}>
        <Icon size={36} color={feature.color} strokeWidth={1.8} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <h3 style={{
          fontSize: '1.25rem', fontWeight: '800', color: '#1F332C',
          marginBottom: '0.6rem', letterSpacing: '-0.02em'
        }}>{feature.title}</h3>
        <p style={{ fontSize: '0.95rem', color: '#687D75', lineHeight: '1.65' }}>{feature.desc}</p>
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: feature.color, fontSize: '0.8rem', fontWeight: '700',
        opacity: hovered ? 1 : 0, transform: hovered ? 'translateX(0)' : 'translateX(-8px)',
        transition: 'all 0.35s ease', letterSpacing: '0.04em', position: 'relative', zIndex: 1
      }}>
        Learn more →
      </div>
    </div>
  );
};

const EnhancedFeatures = () => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      background: '#F6F8FA',
      padding: '5rem 2rem',
      maxWidth: '1200px',
      margin: '0 auto',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', marginBottom: '5rem',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.7s ease'
      }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.15em', color: '#6A8F90', textTransform: 'uppercase', marginBottom: '1rem' }}>
          PLATFORM CAPABILITIES
        </p>
        <h2 style={{
          fontSize: '3.2rem', fontWeight: '900', color: '#1F332C',
          marginBottom: '1rem', letterSpacing: '-0.03em', lineHeight: 1.1
        }}>
          Everything Your Practice Needs
        </h2>
        <p style={{ color: '#687D75', fontSize: '1.1rem', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
          Built ground-up for healthcare compliance and patient sovereignty.
        </p>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.75rem',
      }}>
        {features.map((f, i) => (
          <FeatureCard key={i} feature={f} index={i} visible={visible} />
        ))}
      </div>
    </div>
  );
};

export default EnhancedFeatures;
