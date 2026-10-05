import type { FC } from 'react';
import { AlertOctagon, MapPin, Clock, ExternalLink, X, ShieldAlert } from 'lucide-react';
import type { Accident, Alert } from '../lib/supabase';

interface AccidentBannerProps {
  accident: Accident | null;
  alert: Alert | null;
  onDismiss: () => void;
}

export const AccidentBanner: FC<AccidentBannerProps> = ({
  accident,
  alert,
  onDismiss,
}) => {
  if (!accident) return null;

  const locationUrl =
    accident.location && accident.location !== 'NO_FIX' && accident.location !== 'Unknown Location'
      ? `https://maps.google.com/?q=${encodeURIComponent(accident.location)}`
      : null;

  const severityColor = (sev: string | null) => {
    switch (sev?.toLowerCase()) {
      case 'extreme':
        return 'bg-purple-950 text-purple-200 border-purple-500';
      case 'high':
        return 'bg-rose-950 text-rose-200 border-rose-500';
      case 'medium':
        return 'bg-amber-950 text-amber-200 border-amber-500';
      default:
        return 'bg-slate-900 text-slate-200 border-slate-700';
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-rose-600 text-white shadow-xl animate-emergency-flash border-2 border-rose-700 p-6 mb-8">
      {/* Background Accent glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 animate-bounce">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-heading font-black text-xl tracking-tight uppercase">
                  🚨 Crash Impact Detected!
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold border uppercase tracking-wider ${severityColor(
                    accident.severity
                  )}`}
                >
                  {accident.severity || 'Impact'} Severity
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-0.5">
                Emergency protocol initiated • Database Alert Trigger fired • Resend Emergency Dispatch queued
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Acknowledge Alert"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alert Trigger Message Box */}
        {alert && (
          <div className="mt-4 p-3 bg-black/30 backdrop-blur-xs rounded-xl border border-white/20 text-xs font-mono text-white/95 flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">{alert.message}</span>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center space-x-2 text-xs">
            <MapPin className="w-4 h-4 text-rose-200 shrink-0" />
            <div className="truncate">
              <span className="text-rose-200 block text-[10px] uppercase font-semibold">
                GPS Location
              </span>
              <span className="font-mono font-semibold">
                {accident.location || 'Unknown GPS fix'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <Clock className="w-4 h-4 text-rose-200 shrink-0" />
            <div>
              <span className="text-rose-200 block text-[10px] uppercase font-semibold">
                Incident Timestamp
              </span>
              <span className="font-mono font-semibold">
                {new Date(accident.reporttime).toLocaleTimeString()} ({new Date(accident.reporttime).toLocaleDateString()})
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2">
            {locationUrl && (
              <a
                href={locationUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs font-bold px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 mr-1.5" />
                View in Maps
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
