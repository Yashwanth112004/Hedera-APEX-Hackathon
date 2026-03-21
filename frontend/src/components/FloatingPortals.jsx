import React from 'react';
import { User, Stethoscope, Building2 } from 'lucide-react';

const FloatingPortals = () => {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      pointerEvents: 'none',
      perspective: '1200px', // enables 3D space
      zIndex: 1
    }}>
      <style>{`
        @keyframes float3D-1 {
          0%, 100% { transform: translate3d(0, 0, 0) rotateX(5deg) rotateY(-5deg) rotateZ(-2deg); }
          50% { transform: translate3d(-15px, -30px, 40px) rotateX(-5deg) rotateY(10deg) rotateZ(2deg); }
        }
        @keyframes float3D-2 {
          0%, 100% { transform: translate3d(0, 0, 0) rotateX(-5deg) rotateY(5deg) rotateZ(2deg); }
          50% { transform: translate3d(20px, -20px, 60px) rotateX(10deg) rotateY(-10deg) rotateZ(-3deg); }
        }
        @keyframes float3D-3 {
          0%, 100% { transform: translate3d(0, 0, 0) rotateX(5deg) rotateY(10deg) rotateZ(1deg); }
          50% { transform: translate3d(10px, 20px, 30px) rotateX(-10deg) rotateY(-5deg) rotateZ(-2deg); }
        }
        
        .portal-card {
          position: absolute;
          background: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 24px;
          box-shadow: 
            0 24px 48px -12px rgba(49, 80, 70, 0.15),
            inset 0 1px 1px rgba(255, 255, 255, 0.8),
            inset 0 -1px 1px rgba(0, 0, 0, 0.05);
        }
      `}</style>

      {/* 1. Patient Portal (Top Left) */}
      <div 
        className="portal-card"
        style={{
          top: '15%',
          left: '8%',
          animation: 'float3D-1 9s ease-in-out infinite'
        }}
      >
        <div style={{
          width: '56px', height: '56px', borderRadius: '18px',
          background: 'linear-gradient(135deg, #A8C256, #8B9A46)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(168, 194, 86, 0.3)'
        }}>
          <User size={28} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#6A8F90', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Portal</p>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#1F332C', letterSpacing: '-0.02em' }}>Patient</p>
        </div>
      </div>

      {/* 2. Doctor Portal (Middle Right) */}
      <div 
        className="portal-card"
        style={{
          top: '40%',
          right: '5%',
          animation: 'float3D-2 11s ease-in-out infinite alternate'
        }}
      >
        <div style={{
          width: '56px', height: '56px', borderRadius: '18px',
          background: 'linear-gradient(135deg, #6A8F90, #315046)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(106, 143, 144, 0.3)'
        }}>
          <Stethoscope size={28} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#6A8F90', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Portal</p>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#1F332C', letterSpacing: '-0.02em' }}>Doctor</p>
        </div>
      </div>

      {/* 3. Hospital Portal (Bottom Left) */}
      <div 
        className="portal-card"
        style={{
          bottom: '20%',
          left: '12%',
          animation: 'float3D-3 10s ease-in-out infinite'
        }}
      >
        <div style={{
          width: '56px', height: '56px', borderRadius: '18px',
          background: 'linear-gradient(135deg, #D4A373, #B88A5C)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(212, 163, 115, 0.3)'
        }}>
          <Building2 size={28} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#6A8F90', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Portal</p>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#1F332C', letterSpacing: '-0.02em' }}>Hospital</p>
        </div>
      </div>

    </div>
  );
};

export default FloatingPortals;
