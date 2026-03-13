import React, { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import '../../styles/futuristic-theme.css';

const StatCard = ({ title, value, change, icon: Icon, trend = 'up' }) => {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    setRotate({ x, y });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div 
      className="glass-card p-6 flex flex-col justify-between h-44 relative overflow-hidden group perspective-1000"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotate.y}deg) rotateY(${rotate.x}deg)`,
      }}
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#22D3EE] opacity-5 blur-3xl group-hover:opacity-10 transition-opacity"></div>
      
      <div className="flex justify-between items-start">
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:border-[#22D3EE]/30 group-hover:bg-white/10 transition-all">
          <Icon size={24} className="text-[#22D3EE]" />
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase
          ${trend === 'up' ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
          {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change}%
        </div>
      </div>

      <div>
        <h3 className="text-slate-400 text-xs font-semibold tracking-widest uppercase mb-1">{title}</h3>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#22D3EE]/20 to-transparent"></div>
    </div>
  );
};

export default StatCard;
