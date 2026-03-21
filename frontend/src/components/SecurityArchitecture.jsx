import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ArrowRight, Zap, Lock, Database } from 'lucide-react';

const SecurityArchitecture = () => {
  const [visible, setVisible] = useState(false);
  const [activeNode, setActiveNode] = useState(1);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.25 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setActiveNode(n => (n + 1) % 3), 1800);
    return () => clearInterval(t);
  }, [visible]);

  const points = [
    { label: 'Blockchain Verification', color: '#A8C256' },
    { label: 'End-to-End Encrypted Data', color: '#A8C256' },
    { label: 'Decentralized Identity (DID)', color: '#A8C256' },
  ];

  const archNodes = [
    { label: 'PATIENT', icon: <Database size={14} />, color: '#315046' },
    { label: 'SMART\nCONTRACT', icon: <Zap size={14} />, color: '#6A8F90', featured: true },
    { label: 'HOSPITAL', icon: <Lock size={14} />, color: '#D4A373' },
  ];

  return (
    <div ref={ref} style={{
      padding: '5rem 2rem',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      <style>{`
        @keyframes secPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(106,143,144,0.3), 0 4px 32px rgba(106,143,144,0.15); }
          50% { box-shadow: 0 0 0 12px rgba(106,143,144,0), 0 4px 32px rgba(106,143,144,0.30); }
        }
        @keyframes flowArrow {
          0%,100% { opacity: 0.3; transform: translateX(0); }
          50% { opacity: 1; transform: translateX(4px); }
        }
        @keyframes dataPacket {
          0% { left: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        .arch-arrow { animation: flowArrow 1.5s ease-in-out infinite; }
        .sec-check { transition: transform 0.3s ease, color 0.3s ease; }
        .sec-check:hover { transform: translateX(6px); }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '5rem', flexWrap: 'wrap' }}>
        {/* Left column */}
        <div style={{
          flex: '1', minWidth: '340px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(-40px)',
          transition: 'all 0.8s cubic-bezier(0.4,0,0.2,1)'
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(168,194,86,0.08)',
            border: '1px solid rgba(168,194,86,0.2)',
            borderRadius: '100px', padding: '6px 16px',
            marginBottom: '1.5rem'
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#A8C256', animation: 'shieldPulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#A8C256', letterSpacing: '0.08em' }}>ZERO TRUST ARCHITECTURE</span>
          </div>

          <h2 style={{
            fontSize: '3.6rem', fontWeight: '900', color: '#315046',
            marginBottom: '2.5rem', lineHeight: '1.05', letterSpacing: '-0.03em'
          }}>
            Zero Trust<br />Security<br />
            <span style={{ background: 'linear-gradient(135deg,#6A8F90,#A8C256)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', display: 'inline-block' }}>Architecture</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {points.map((pt, i) => (
              <div
                key={i}
                className="sec-check"
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  opacity: visible ? 1 : 0,
                  transition: `opacity 0.5s ease ${300 + i * 120}ms, transform 0.5s ease ${300 + i * 120}ms`,
                  transform: visible ? 'translateX(0)' : 'translateX(-20px)'
                }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(168,194,86,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CheckCircle2 size={20} color="#A8C256" />
                </div>
                <span style={{ fontSize: '1.05rem', fontWeight: '600', color: '#1F332C' }}>{pt.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: diagram */}
        <div style={{
          flex: '1.3', minWidth: '380px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.9s cubic-bezier(0.4,0,0.2,1) 0.2s'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #F8FAFF 0%, #EEF4FF 100%)',
            border: '1px solid #E2E8F0',
            borderRadius: '32px',
            padding: '3.5rem 2.5rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 80px rgba(59,130,246,0.07), inset 0 1px 0 rgba(255,255,255,0.8)'
          }}>
            {/* Background grid */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(circle, #CBD5E140 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              borderRadius: '32px'
            }} />

            {/* Data flow bar */}
            <div style={{ position: 'relative', marginBottom: '2rem', height: '4px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0,
                height: '100%', width: '40%',
                background: 'linear-gradient(90deg, transparent, #3B82F6, transparent)',
                animation: 'dataPacket 2s linear infinite'
              }} />
            </div>

            {/* Nodes */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', position: 'relative', zIndex: 2 }}>
              {archNodes.map((node, i) => (
                <React.Fragment key={i}>
                  <div
                    onClick={() => setActiveNode(i)}
                    style={{
                      padding: node.featured ? '1.6rem 1.8rem' : '1.1rem 1.6rem',
                      background: activeNode === i
                        ? 'white'
                        : 'rgba(255,255,255,0.7)',
                      border: activeNode === i
                        ? `1.5px solid ${node.color}`
                        : '1px solid #E2E8F0',
                      borderRadius: node.featured ? '20px' : '14px',
                      fontWeight: '900',
                      fontSize: node.featured ? '0.85rem' : '0.75rem',
                      textAlign: 'center',
                      color: activeNode === i ? node.color : '#94A3B8',
                      whiteSpace: 'pre-line',
                      lineHeight: 1.3,
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
                      animation: activeNode === i ? 'secPulse 2s ease-in-out infinite' : 'none',
                      backdropFilter: 'blur(8px)',
                      minWidth: node.featured ? '110px' : '80px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: '50%',
                      background: activeNode === i ? `${node.color}18` : '#F1F5F9',
                      color: activeNode === i ? node.color : '#94A3B8',
                      transition: 'all 0.4s ease'
                    }}>
                      {node.icon}
                    </span>
                    {node.label}
                  </div>
                  {i < archNodes.length - 1 && (
                    <div className="arch-arrow" style={{ color: '#94A3B8', animationDelay: `${i * 0.3}s` }}>
                      <ArrowRight size={20} />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Badges */}
            <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.75rem', display: 'flex', gap: '8px' }}>
              <div style={{
                padding: '5px 14px',
                background: 'linear-gradient(135deg,#E6F0CA,#C0D87E)',
                color: '#315046', borderRadius: '100px', fontSize: '0.72rem', fontWeight: '800',
                letterSpacing: '0.05em', boxShadow: '0 2px 8px rgba(168,194,86,0.2)'
              }}>
                ✓ Audit Log
              </div>
              <div style={{
                padding: '5px 14px',
                background: 'linear-gradient(135deg,#D5E6E6,#ABC5C6)',
                color: '#315046', borderRadius: '100px', fontSize: '0.72rem', fontWeight: '800',
                letterSpacing: '0.05em', boxShadow: '0 2px 8px rgba(106,143,144,0.2)'
              }}>
                🔒 Encrypted
              </div>
            </div>

            {/* Status dot */}
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%', background: '#A8C256',
                animation: 'shieldPulse 2s ease-in-out infinite'
              }} />
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#A8C256', letterSpacing: '0.06em' }}>LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityArchitecture;
