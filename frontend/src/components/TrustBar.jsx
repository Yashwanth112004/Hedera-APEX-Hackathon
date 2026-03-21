import React, { useEffect, useRef, useState } from 'react';

const TrustBar = () => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  // 10 items to ensure smooth infinite scroll on widescreen
  const items = Array(12).fill("dummy");

  return (
    <div ref={ref} style={{
      padding: '4rem 0',
      background: 'linear-gradient(180deg, #F0F4F2 0%, #F0F4F2 100%)',
      borderTop: '1px solid #E8EBE9',
      borderBottom: '1px solid #E8EBE9',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <style>{`
        @keyframes marqueeScrollText {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .trust-marquee-text {
          display: flex;
          align-items: center;
          width: max-content;
          animation: marqueeScrollText 30s linear infinite;
        }
        .trust-marquee-text:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Fade edges */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: '180px',
        background: 'linear-gradient(to right, #F0F4F2 20%, transparent)', zIndex: 2, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '180px',
        background: 'linear-gradient(to left, #F0F4F2 20%, transparent)', zIndex: 2, pointerEvents: 'none'
      }} />

      {/* Marquee */}
      <div style={{ overflow: 'hidden', position: 'relative' }}>
        <div className="trust-marquee-text" style={{ opacity: visible ? 1 : 0, transition: 'opacity 1s ease' }}>
          {items.map((_, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '2rem', padding: '0 2rem',
              cursor: 'default', whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#1F332C', letterSpacing: '-0.03em' }}>
                Ojasraksha
              </span>
              <span style={{ fontSize: '2rem', fontWeight: '400', color: '#6A8F90', letterSpacing: '-0.01em' }}>
                Your Health Data. Your Control. Always.
              </span>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#A8C256', opacity: 0.6 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustBar;
