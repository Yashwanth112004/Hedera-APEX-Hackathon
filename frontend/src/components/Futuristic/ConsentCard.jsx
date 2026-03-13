import React from 'react';
import { ShieldCheck, Calendar, Clock, User, ChevronRight } from 'lucide-react';
import '../../styles/futuristic-theme.css';

const BlockchainBadge = () => (
  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
    <ShieldCheck size={14} className="text-[#22D3EE]" />
    <span className="text-[10px] font-bold text-[#22D3EE] tracking-widest uppercase">Secured by Hedera</span>
  </div>
);

const ConsentCard = ({ patientName, requestType, hospital, date, status = 'pending' }) => {
  return (
    <div className="glass-card p-6 group cursor-pointer relative overflow-hidden flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] p-[1.5px]">
            <div className="w-full h-full rounded-[14px] bg-[#020617] flex items-center justify-center overflow-hidden">
              <User size={24} className="text-white opacity-80" />
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold tracking-tight">{patientName}</h4>
            <p className="text-slate-400 text-xs">{hospital}</p>
          </div>
        </div>
        <BlockchainBadge />
      </div>

      <div className="flex gap-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Calendar size={14} />
          <span className="text-xs">{date}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Clock size={14} />
          <span className="text-xs">2 hours ago</span>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-all">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Requesting Access To</p>
            <p className="text-sm font-semibold text-white">{requestType}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center text-[#22D3EE]">
            <ChevronRight size={18} />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 py-2.5 rounded-xl border border-white/10 text-white text-xs font-bold tracking-widest uppercase hover:bg-white/5 transition-all">
          Reject
        </button>
        <button className="flex-1 py-2.5 rounded-xl bg-[#22D3EE] text-[#0a192f] text-xs font-bold tracking-widest uppercase shadow-[0_4px_15px_rgba(34,211,238,0.3)] hover:shadow-[0_4px_25px_rgba(34,211,238,0.5)] transition-all transform active:scale-95">
          Approve
        </button>
      </div>
    </div>
  );
};

export { ConsentCard, BlockchainBadge };
