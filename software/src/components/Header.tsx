import type { FC } from 'react';
import { Shield, Radio, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  activeTripId: number | null;
  hasEmergency: boolean;
  hasAlcoholAlert: boolean;
}

export const Header: FC<HeaderProps> = ({
  isConnected,
  activeTripId,
  hasEmergency,
  hasAlcoholAlert,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-heading font-bold text-xl tracking-tight text-slate-900">
                  SMART<span className="text-blue-600">HELMET</span>
                </span>
                <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium border border-blue-200">
                  v2.0 IoT
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Intelligent Rider Safety & Telemetry Control
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {hasEmergency && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                CRASH ALERT ACTIVE
              </span>
            )}

            {hasAlcoholAlert && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                ALCOHOL WARNING
              </span>
            )}

            {activeTripId ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-ping" />
                Trip #{activeTripId} Active
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Standby
              </span>
            )}

            <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Radio
                className={`w-3.5 h-3.5 ${
                  isConnected ? 'text-emerald-500 animate-pulse' : 'text-slate-400'
                }`}
              />
              <span className="font-medium">
                {isConnected ? 'Realtime Connected' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
