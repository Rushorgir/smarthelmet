import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { User, HardHat, Phone, FileText, CheckCircle2, Cpu, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Rider, Helmet } from '../lib/supabase';

interface OnboardingFormProps {
  currentRider: Rider | null;
  currentHelmet: Helmet | null;
  onRegistered: (rider: Rider, helmet: Helmet) => void;
  disabled?: boolean;
}

export const OnboardingForm: FC<OnboardingFormProps> = ({
  currentRider,
  currentHelmet,
  onRegistered,
  disabled = false,
}) => {
  const [name, setName] = useState(currentRider?.name || '');
  const [contact, setContact] = useState(currentRider?.contact || '');
  const [license, setLicense] = useState(currentRider?.license || '');
  const [macAddress, setMacAddress] = useState(currentHelmet?.mac_address || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fillDemo = () => {
    setName('Carlos Vance');
    setContact('+1 (555) 782-9901');
    setLicense('CA-M1-8849201');
    setMacAddress('24:6F:28:B4:72:1C');
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    const cleanMac = macAddress.trim().toUpperCase();

    if (!trimmedName) {
      setError('Please enter the rider full name.');
      return;
    }

    if (!cleanMac) {
      setError('Please enter the helmet ESP32 MAC address.');
      return;
    }

    // Basic MAC address format check (standard 6 hex pairs with colons or hyphens)
    const macRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i;
    if (!macRegex.test(cleanMac)) {
      setError('Invalid MAC address format. Example: 24:6F:28:B4:72:1C');
      return;
    }

    setLoading(true);

    try {
      // 1. Insert or reuse rider
      const { data: riderData, error: riderErr } = await supabase
        .from('riders')
        .insert({
          name: trimmedName,
          contact: contact.trim() || null,
          license: license.trim() || null,
        })
        .select()
        .single();

      if (riderErr) throw riderErr;

      // 2. Check if helmet with MAC exists, otherwise insert
      let helmetResult: Helmet | null = null;
      const { data: existingHelmet, error: checkHelmetErr } = await supabase
        .from('helmets')
        .select('*')
        .ilike('mac_address', cleanMac)
        .maybeSingle();

      if (checkHelmetErr) throw checkHelmetErr;

      if (existingHelmet) {
        helmetResult = existingHelmet;
      } else {
        const { data: newHelmet, error: insertHelmetErr } = await supabase
          .from('helmets')
          .insert({
            mac_address: cleanMac,
          })
          .select()
          .single();

        if (insertHelmetErr) throw insertHelmetErr;
        helmetResult = newHelmet;
      }

      if (helmetResult) {
        setSuccess(`Profile & Helmet successfully registered! Helmet ID #${helmetResult.helmetid}`);
        onRegistered(riderData, helmetResult);
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Failed to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <h2 className="font-heading font-semibold text-lg text-slate-900">
              Rider Profile & Helmet Onboarding
            </h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Register the rider profile and pair their smart helmet ESP32 MAC address.
          </p>
        </div>

        <button
          type="button"
          onClick={fillDemo}
          disabled={disabled || loading}
          className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-500 mr-1.5" />
          Auto-Fill Demo Rider
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Rider Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={disabled || loading}
                placeholder="e.g. Alex Johnson"
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Emergency Contact Phone
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                disabled={disabled || loading}
                placeholder="e.g. +1 555-0199"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Driver License Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                disabled={disabled || loading}
                placeholder="e.g. DL-88921"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Helmet ESP32 MAC Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <HardHat className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                disabled={disabled || loading}
                placeholder="e.g. 24:6F:28:B4:72:1C"
                required
                className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white uppercase transition-all disabled:opacity-60"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Read via ESP32 WiFi.macAddress() at boot.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {currentRider && currentHelmet ? (
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <Cpu className="w-4 h-4 text-blue-500" />
              <span>
                Active Session: <strong>{currentRider.name}</strong> (Helmet #{currentHelmet.helmetid} • {currentHelmet.mac_address})
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">No active rider session</span>
          )}

          <button
            type="submit"
            disabled={disabled || loading}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="inline-flex items-center">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Registering...
              </span>
            ) : currentRider && currentHelmet ? (
              'Update / Re-register Pair'
            ) : (
              'Save & Register Helmet'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
