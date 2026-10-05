import type { FC } from 'react';
import { Activity, Zap, Wine } from 'lucide-react';
import type { Telemetry } from '../lib/supabase';

interface TelemetryTableProps {
  telemetryList: Telemetry[];
  isTripActive: boolean;
}

export const TelemetryTable: FC<TelemetryTableProps> = ({
  telemetryList,
  isTripActive,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-sm text-slate-800">
              Live Telemetry Stream
            </h3>
            <p className="text-xs text-slate-400">
              Real-time feed streamed from ESP32 via Supabase Realtime channel
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isTripActive && (
            <span className="inline-flex items-center text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-ping" />
              10s Polling Cycle Active
            </span>
          )}
          <span className="text-xs font-mono text-slate-500">
            {telemetryList.length} Packets
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        {telemetryList.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2 animate-pulse" />
            <p className="text-xs font-medium">Waiting for ESP32 telemetry transmission...</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {isTripActive
                ? 'Packets stream every 10 seconds while trip is ongoing.'
                : 'Start a trip above to begin receiving telemetry.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Packet ID</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Speed (km/h)</th>
                <th className="py-2.5 px-3">Alcohol (ADC)</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {telemetryList.slice(0, 10).map((tel, idx) => {
                const isOverThreshold = tel.alcohollevel > 3000;
                return (
                  <tr
                    key={tel.id || idx}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      idx === 0 ? 'bg-blue-50/30 font-medium' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-500">#{tel.id}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {new Date(tel.time).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center text-slate-900 font-semibold">
                        <Zap className="w-3 h-3 text-blue-500 mr-1" />
                        {Number(tel.speed).toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center font-semibold ${
                          isOverThreshold ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        <Wine className="w-3 h-3 mr-1" />
                        {Math.round(tel.alcohollevel)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      {isOverThreshold ? (
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                          Alcohol Warning
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
