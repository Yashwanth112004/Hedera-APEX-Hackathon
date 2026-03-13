import React from 'react';
import { Search, Bell, User, ChevronDown } from 'lucide-react';
import '../../styles/futuristic-theme.css';

const Topbar = () => {
  return (
    <div className="fixed top-0 right-0 left-72 h-20 glass-panel border-x-0 border-t-0 rounded-none z-40 flex items-center justify-between px-10">
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#22D3EE] transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search patients, records, or consents..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:border-[#22D3EE]/50 focus:bg-white/10 transition-all text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer group">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:border-[#22D3EE]/30 group-hover:bg-white/10 transition-all">
            <Bell size={20} className="text-slate-300 group-hover:text-white" />
          </div>
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#22D3EE] rounded-full border-2 border-[#0a192f] shadow-[0_0_10px_#22D3EE]"></span>
        </div>

        <div className="h-8 w-px bg-white/10 mx-2"></div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right">
            <p className="text-sm font-semibold text-white group-hover:text-[#22D3EE] transition-colors">Dr. Sarah Chen</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Chief Medical Officer</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] p-[1.5px] transition-transform group-hover:scale-105 active:scale-95">
            <div className="w-full h-full rounded-[10px] bg-[#020617] flex items-center justify-center overflow-hidden">
              <User size={24} className="text-white opacity-80" />
            </div>
          </div>
          <ChevronDown size={16} className="text-slate-500 group-hover:text-white transition-colors" />
        </div>
      </div>
    </div>
  );
};

export default Topbar;
