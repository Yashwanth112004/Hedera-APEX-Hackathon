import React from 'react';
import { LayoutDashboard, Users, FileText, UserCircle, Building2, ShieldCheck, Settings, LogOut } from 'lucide-react';
import '../../styles/futuristic-theme.css';

const SidebarItem = ({ icon: Icon, label, active = false }) => (
  <div className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-all duration-300 group
    ${active ? 'text-[#22D3EE] bg-white/5 border-r-2 border-[#22D3EE]' : 'text-slate-400 hover:text-white hover:bg-white/5'}
  `}>
    <div className={`p-2 rounded-xl transition-all duration-300 group-hover:scale-110 
      ${active ? 'shadow-[0_0_15px_rgba(34,211,238,0.4)]' : ''}`}>
      <Icon size={22} className={active ? 'glow-active' : ''} />
    </div>
    <span className="font-medium tracking-wide text-sm">{label}</span>
  </div>
);

const Sidebar = () => {
  return (
    <div className="fixed left-0 top-0 h-screen w-72 glass-panel border-y-0 border-l-0 rounded-none z-50 flex flex-col">
      <div className="p-8 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white font-accent">HEDERA<span className="text-[#22D3EE]">CONSENT</span></h1>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <SidebarItem icon={LayoutDashboard} label="Dashboard" active />
        <SidebarItem icon={Users} label="Patients" />
        <SidebarItem icon={FileText} label="Consent Forms" />
        <SidebarItem icon={UserCircle} label="Doctors" />
        <SidebarItem icon={Building2} label="Organizations" />
        <SidebarItem icon={ShieldCheck} label="Data Fiduciaries" />
        <SidebarItem icon={Settings} label="Admin Controls" />
      </nav>

      <div className="p-6 border-t border-white/5">
        <div className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
          <LogOut size={20} className="text-slate-400 group-hover:text-red-400" />
          <span className="text-sm font-medium text-slate-400 group-hover:text-white">Sign Out</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
