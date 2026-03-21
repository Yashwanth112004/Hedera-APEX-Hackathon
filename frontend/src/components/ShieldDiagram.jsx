import React, { useEffect, useRef, useState } from 'react';
import { Shield, User, Stethoscope, Building2, Beaker } from 'lucide-react';

/* ── animated dashed line drawn over time ─────────────────────────── */
const AnimLine = ({ x1, y1, x2, y2, delay = 0 }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    el.style.transition = 'none';
    setTimeout(() => {
      el.style.transition = `stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) ${delay}ms`;
      el.style.strokeDashoffset = '0';
    }, 200 + delay);
  }, [delay]);

  return (
    <line
      ref={ref}
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="url(#lineGrad)"
      strokeWidth="1.5"
    />
  );
};

/* ── pulsing dot that travels along line ──────────────────────────── */
const TravelDot = ({ x1, y1, x2, y2, dur = '3s', delay = '0s', color = '#3B82F6' }) => (
  <circle r="4" fill={color} opacity="0.9">
    <animateMotion dur={dur} begin={delay} repeatCount="indefinite" calcMode="linear">
      <mpath xlinkHref={`#path-${x1}-${y1}-${x2}-${y2}`} />
    </animateMotion>
  </circle>
);

/* ── orbit ring ───────────────────────────────────────────────────── */
const OrbitRing = ({ r, duration, opacity = 0.15 }) => (
  <circle
    cx="50%" cy="50%" r={r}
    fill="none"
    stroke="#3B82F6"
    strokeWidth="1"
    strokeDasharray="6 6"
    opacity={opacity}
    style={{ animation: `spin ${duration}s linear infinite`, transformOrigin: '50% 50%' }}
  />
);

const ShieldDiagram = () => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const nodes = [
    { icon: <Building2 size={26} color="#6A8F90" />, label: 'Hospital', top: '16%', left: '12%', color: '#6A8F90', bg: 'rgba(106,143,144,0.1)', delay: 0 },
    { icon: <Stethoscope size={26} color="#A8C256" />, label: 'Doctor', top: '16%', right: '12%', color: '#A8C256', bg: 'rgba(168,194,86,0.1)', delay: 150 },
    { icon: <User size={26} color="#315046" />, label: 'Patient', bottom: '16%', left: '12%', color: '#475569', bg: 'rgba(49,80,70,0.08)', delay: 300 },
    { icon: <Beaker size={26} color="#D4A373" />, label: 'Lab', bottom: '16%', right: '12%', color: '#D4A373', bg: 'rgba(212,163,115,0.1)', delay: 450 },
  ];

  return (
    <div ref={ref} style={{ position: 'relative', height: '540px', width: '100%', maxWidth: '860px', margin: '2rem auto', overflow: 'visible' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spinRev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes shieldPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(168,194,86,0.2), 0 20px 60px rgba(106,143,144,0.18); }
          50% { box-shadow: 0 0 0 18px rgba(168,194,86,0), 0 20px 60px rgba(106,143,144,0.30); }
        }
        @keyframes nodeFloat {
          0%,100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
        .shield-node { animation: nodeFloat 4s ease-in-out infinite; }
      `}</style>

      {/* SVG layer */}
      <svg style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 1, overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A8C256" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#6A8F90" stopOpacity="0.4" />
          </linearGradient>
          <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A8C256" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#A8C256" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glow behind centre */}
        <ellipse cx="50%" cy="50%" rx="130" ry="130" fill="url(#glowGrad)" />

        {/* Orbit rings */}
        <OrbitRing r={160} duration={36} opacity={0.10} />
        <OrbitRing r={220} duration={56} opacity={0.07} />

        {/* Animated lines */}
        {visible && (
          <>
            <AnimLine x1="50%" y1="50%" x2="18%" y2="22%" delay={0} />
            <AnimLine x1="50%" y1="50%" x2="82%" y2="22%" delay={150} />
            <AnimLine x1="50%" y1="50%" x2="18%" y2="78%" delay={300} />
            <AnimLine x1="50%" y1="50%" x2="82%" y2="78%" delay={450} />
          </>
        )}

        {/* Travelling dots */}
        {visible && (
          <>
            <defs>
              <path id="path-50%-50%-18%-22%" d="M 430 270 L 155 119" />
              <path id="path-50%-50%-82%-22%" d="M 430 270 L 705 119" />
              <path id="path-50%-50%-18%-78%" d="M 430 270 L 155 421" />
              <path id="path-50%-50%-82%-78%" d="M 430 270 L 705 421" />
            </defs>
            <circle r="4" fill="#6A8F90" opacity="0.85">
              <animateMotion dur="2.8s" begin="0.5s" repeatCount="indefinite">
                <mpath xlinkHref="#path-50%-50%-18%-22%" />
              </animateMotion>
            </circle>
            <circle r="4" fill="#A8C256" opacity="0.85">
              <animateMotion dur="3.2s" begin="1s" repeatCount="indefinite">
                <mpath xlinkHref="#path-50%-50%-82%-22%" />
              </animateMotion>
            </circle>
            <circle r="4" fill="#315046" opacity="0.85">
              <animateMotion dur="3s" begin="0.2s" repeatCount="indefinite">
                <mpath xlinkHref="#path-50%-50%-18%-78%" />
              </animateMotion>
            </circle>
            <circle r="4" fill="#D4A373" opacity="0.85">
              <animateMotion dur="2.6s" begin="0.8s" repeatCount="indefinite">
                <mpath xlinkHref="#path-50%-50%-82%-78%" />
              </animateMotion>
            </circle>
          </>
        )}
      </svg>

      {/* Central shield */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '128px', height: '128px',
        background: 'white',
        borderRadius: '28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 0 0 rgba(59,130,246,0.3)',
        border: '1.5px solid rgba(59,130,246,0.2)',
        animation: 'shieldPulse 3s ease-in-out infinite',
        zIndex: 10,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease'
      }}>
        <div style={{
          position: 'absolute', inset: '-20px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          borderRadius: '50%', zIndex: -1
        }} />
        <Shield size={62} color="#3B82F6" fill="#EFF6FF" />
      </div>

      {/* Satellite nodes */}
      {nodes.map((n, i) => (
        <div
          key={i}
          className="shield-node"
          style={{
            position: 'absolute', zIndex: 10,
            top: n.top, bottom: n.bottom, left: n.left, right: n.right,
            animationDelay: `${i * 0.6}s`,
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.5)',
            transition: `opacity 0.5s ease ${n.delay}ms, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${n.delay}ms`
          }}
        >
          <div style={{
            width: '72px', height: '72px',
            background: 'white',
            border: `1.5px solid ${n.color}30`,
            borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 8px 32px ${n.color}20, 0 2px 8px rgba(0,0,0,0.04)`,
            backdropFilter: 'blur(8px)',
            position: 'relative',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            cursor: 'default'
          }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '20px',
              background: n.bg, zIndex: 0
            }} />
            <span style={{ position: 'relative', zIndex: 1 }}>{n.icon}</span>
          </div>
          <p style={{
            textAlign: 'center', fontSize: '0.72rem', fontWeight: '700',
            color: n.color, marginTop: '8px', letterSpacing: '0.06em', textTransform: 'uppercase'
          }}>{n.label}</p>
        </div>
      ))}
    </div>
  );
};

export default ShieldDiagram;
