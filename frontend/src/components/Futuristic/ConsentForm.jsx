import React, { useState } from 'react';
import { Shield, MapPin, Edit3, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import '../../styles/futuristic-theme.css';

const ConsentForm = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    wallet: '0.0.123456...',
    hospital: '',
    purpose: '',
    duration: ''
  });

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const StepIndicator = () => (
    <div className="flex items-center gap-4 mb-10">
      {[1, 2, 3].map((num) => (
        <React.Fragment key={num}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all duration-500
            ${step === num ? 'bg-[#22D3EE] text-[#0a192f] shadow-[0_0_20px_#22D3EE]' : 
              step > num ? 'bg-emerald-400 text-[#0a192f]' : 'bg-white/5 text-slate-500 border border-white/10'}`}>
            {step > num ? <CheckCircle size={20} /> : num}
          </div>
          {num < 3 && <div className={`h-px w-10 transition-colors duration-500 ${step > num ? 'bg-emerald-400' : 'bg-white/10'}`}></div>}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="max-w-xl mx-auto glass-panel p-10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#22D3EE] to-transparent opacity-50"></div>
      
      <StepIndicator />

      <div className="min-h-[300px]">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Initialize Consent</h3>
              <p className="text-slate-400 text-sm">Verify your wallet and select the destination fiduciary.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Connected Wallet</label>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 text-[#22D3EE] font-mono text-sm leading-none">
                  <Shield size={18} />
                  {formData.wallet}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Healthcare Provider</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#22D3EE]" size={18} />
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-[#22D3EE]/50 appearance-none text-white"
                    onChange={(e) => setFormData({...formData, hospital: e.target.value})}
                  >
                    <option value="">Choose a Hospital</option>
                    <option value="central">Central City Hospital</option>
                    <option value="metro">Metro General Lab</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Access Scope</h3>
              <p className="text-slate-400 text-sm">Define exactly what data you are sharing and for how long.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {['Diagnosis', 'Radiology', 'Prescriptions', 'Lab Results'].map(item => (
                  <div key={item} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#22D3EE]/30 cursor-pointer transition-all flex items-center gap-3">
                    <div className="w-4 h-4 rounded border border-white/20 group-hover:border-[#22D3EE]"></div>
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Duration of Access</label>
                <div className="grid grid-cols-3 gap-3">
                  {['24 Hours', '1 Week', 'Permanent'].map(d => (
                    <button key={d} className="py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-[#22D3EE]/10 hover:border-[#22D3EE]/30 transition-all">
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Digital Authorization</h3>
              <p className="text-slate-400 text-sm">Provide your digital signature to finalize the blockchain entry.</p>
            </div>

            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl bg-[#020617] border border-white/10 relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#22D3EE]/5 to-transparent pointer-events-none"></div>
                <div className="absolute flex flex-col items-center justify-center inset-0 text-slate-600 group-hover:text-[#22D3EE]/40 transition-colors">
                  <Edit3 size={32} strokeWidth={1} />
                  <span className="text-[10px] uppercase tracking-widest font-bold mt-2">Sign in this area</span>
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-4/5 h-px bg-white/5"></div>
              </div>
              
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-400/5 border border-emerald-400/20 text-emerald-400/80 text-[10px] leading-relaxed">
                <Shield size={14} className="shrink-0" />
                This action will be recorded on the Hedera Consensus Service. Your keys never leave your device.
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-10">
        <button 
          onClick={prevStep}
          className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-all
            ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-white'}`}
        >
          <ChevronLeft size={18} />
          Back
        </button>
        
        <button 
          onClick={step === 3 ? () => {} : nextStep}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#22D3EE] text-[#0a192f] font-bold text-xs uppercase tracking-[0.2em] shadow-[0_4px_20px_rgba(34,211,238,0.4)] hover:shadow-[0_4px_30px_rgba(34,211,238,0.6)] transition-all transform active:scale-95"
        >
          {step === 3 ? 'Finalize & Submit' : 'Continue'}
          {step !== 3 && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
};

export default ConsentForm;
