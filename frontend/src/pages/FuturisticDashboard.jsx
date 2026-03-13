import React from 'react';
import Sidebar from '../components/Futuristic/Sidebar';
import Topbar from '../components/Futuristic/Topbar';
import ParticleBackground from '../components/Futuristic/ParticleBackground';
import StatCard from '../components/Futuristic/StatCard';
import { ConsentCard } from '../components/Futuristic/ConsentCard';
import ConsentForm from '../components/Futuristic/ConsentForm';
import { Users, FileCheck, Clock, Shield, X } from 'lucide-react';
import '../styles/futuristic-theme.css';

const FuturisticDashboard = () => {
  const [showConsentForm, setShowConsentForm] = React.useState(false);
  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-[#22D3EE] selection:text-[#0a192f]">
      <ParticleBackground />
      <Sidebar />
      <Topbar />

      <main className="pl-72 pt-20 relative z-10">
        <div className="p-10 space-y-10">
          {/* Header Section */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#22D3EE] glow-active"></span>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#22D3EE]/80">System Monitoring Operational</span>
            </div>
            <h2 className="text-4xl font-bold tracking-tight font-accent">
              Welcome back, <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Dr. Chen</span>
            </h2>
            <p className="text-slate-400 max-w-2xl text-lg">
              Manage hospital-wide consent requests with AI-powered verification and Hedera blockchain security.
            </p>
          </section>

          {/* Stats Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Total Patients" 
              value="12,584" 
              change="12" 
              icon={Users} 
              trend="up" 
            />
            <StatCard 
              title="Active Consents" 
              value="842" 
              change="5.4" 
              icon={FileCheck} 
              trend="up" 
            />
            <StatCard 
              title="Pending Approvals" 
              value="14" 
              change="2" 
              icon={Clock} 
              trend="down" 
            />
            <StatCard 
              title="Security Nodes" 
              value="128" 
              change="0.5" 
              icon={Shield} 
              trend="up" 
            />
          </section>

          {/* Consent Management Area */}
          <section className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-2xl font-bold tracking-tight mb-1">Recent Consent Requests</h3>
                <p className="text-slate-400 text-sm">Real-time requests awaiting clinical verification</p>
              </div>
              <button 
                onClick={() => setShowConsentForm(true)}
                className="px-6 py-2.5 rounded-xl bg-[#22D3EE] text-[#0a192f] text-sm font-bold hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all"
              >
                + New Consent Request
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ConsentCard 
                patientName="Alexander Wright" 
                hospital="Central City Hospital" 
                requestType="Radiology Reports v2.4" 
                date="May 24, 2026"
              />
              <ConsentCard 
                patientName="Elena Rodriguez" 
                hospital="Metro General Lab" 
                requestType="DNA Sequence Analysis" 
                date="May 24, 2026"
              />
              <ConsentCard 
                patientName="James Wilson" 
                hospital="Cardio-Health Center" 
                requestType="Historical Cardiac Data" 
                date="May 24, 2026"
              />
            </div>
          </section>

          {/* Background Decorative Elements */}
          <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-[#22D3EE] opacity-5 blur-[150px] rounded-full pointer-events-none"></div>
          <div className="fixed -top-40 left-80 w-80 h-80 bg-[#3B82F6] opacity-[0.03] blur-[120px] rounded-full pointer-events-none"></div>

          {/* Consent Form Modal */}
          {showConsentForm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm" onClick={() => setShowConsentForm(false)}></div>
              <div className="relative z-10 w-full max-w-2xl animate-in zoom-in-95 duration-300">
                <button 
                  onClick={() => setShowConsentForm(false)}
                  className="absolute -top-12 right-0 text-white/50 hover:text-white transition-colors"
                >
                  <X size={32} />
                </button>
                <ConsentForm />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FuturisticDashboard;
