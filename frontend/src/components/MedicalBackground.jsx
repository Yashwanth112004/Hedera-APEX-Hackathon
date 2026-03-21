import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

const Molecule = ({ position, color, speed = 1, distort = 0.3 }) => {
  const mesh = useRef();
  
  useFrame(() => {
    // Avoid THREE.Clock deprecation and state.clock access warnings 
    // by using native performance.now() for high-precision time
    const time = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    
    if (mesh.current) {
      mesh.current.position.y += Math.sin(time * speed) * 0.002;
      mesh.current.rotation.x = mesh.current.rotation.y += 0.01;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <Sphere ref={mesh} position={position} args={[1, 32, 32]}>
        <MeshDistortMaterial
          color={color}
          speed={speed}
          distort={distort}
          radius={1}
        />
      </Sphere>
    </Float>
  );
};

const MedicalBackground = () => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: -1,
      pointerEvents: 'none',
      opacity: 0.3
    }}>
      <Canvas 
        camera={{ position: [0, 0, 10], fov: 50 }}
        dpr={[1, 2]}
        gl={{ 
            powerPreference: "high-performance",
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} />
        
        {/* Decorative Particles / Molecules - More subtle colors */}
        <Molecule position={[-6, 4, 0]} color="#3B82F6" speed={1.5} distort={0.4} />
        <Molecule position={[7, -3, -2]} color="#E2E8F0" speed={1.2} distort={0.2} />
        <Molecule position={[-3, -5, 1]} color="#CBD5E1" speed={2} distort={0.5} />
        <Molecule position={[5, 5, -3]} color="#3B82F6" speed={1} distort={0.3} />
        
        {/* Background Grid / Connection Lines style */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -10, 0]}>
          <planeGeometry args={[100, 100, 20, 20]} />
          <meshBasicMaterial color="#1E40AF" wireframe transparent opacity={0.05} />
        </mesh>
      </Canvas>
    </div>
  );
};

export default MedicalBackground;
