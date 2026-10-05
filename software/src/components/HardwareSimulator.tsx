import { useState } from 'react';
import type { FC } from 'react';
import { Terminal, Send, AlertTriangle, Radio } from 'lucide-react';
import type { Helmet } from '../lib/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

interface HardwareSimulatorProps {
  currentHelmet: Helmet | null;
  isTripActive: boolean;
  onSimulateSuccess?: () => void;
}

export const HardwareSimulator: FC<HardwareSimulatorProps> = ({
  currentHelmet,
  isTripActive,
}) => {
  const [simSpeed, setSimSpeed] = useState<number>(48.5);
  const [simAlcohol, setSimAlcohol] = useState<number>(350);
  const [simSeverity, setSimSeverity] = useState<string>('High');
  const [loading, setLoading] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);

  const mac = currentHelmet?.mac_address || '24:6F:28:B4:72:1C';

  const sendSimulatedTelemetry = async (alcoholVal?: number) => {
    setLoading('telemetry');
    setLog(null);

    const targetAlcohol = alcoholVal !== undefined ? alcoholVal : simAlcohol;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ingest-telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          mac_address: mac,
          time: new Date().toISOString(),
          speed: simSpeed,
          alcohollevel: targetAlcohol,
        }),
      });

      const resData = await response.json();
      setLog(`[TELEMETRY] HTTP ${response.status} => ${JSON.stringify(resData)}`);
    } catch (err: any) {
      setLog(`[TELEMETRY ERROR] ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const sendSimulatedAccident = async () => {
    setLoading('accident');
    setLog(null);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/log-accident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          mac_address: mac,
          location: '37.7749, -122.4194',
          reporttime: new Date().toISOString(),
          severity: simSeverity,
        }),
      });

      const resData = await response.json();
      setLog(`[ACCIDENT] HTTP ${response.status} => ${JSON.stringify(resData)}`);
    } catch (err: any) {
      setLog(`[ACCIDENT ERROR] ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-md border border-slate-800">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-sm text-white">
              ESP32 Hardware Payload Simulator
            </h3>
            <p className="text-xs text-slate-400">
              Trigger live HTTP POST requests to Supabase Edge Functions matching firmware main.cpp
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
          Target MAC: {mac}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-5">
        {/* Telemetry Simulator Box */}
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center">
                <Radio className="w-3.5 h-3.5 text-blue-400 mr-1.5" />
                10s Telemetry Ingest
              </span>
              <span className="text-[10px] font-mono text-blue-400">/ingest-telemetry</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Speed (km/h): {simSpeed}
                </label>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="0.5"
                  value={simSpeed}
                  onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Alcohol ADC: {simAlcohol}
                </label>
                <input
                  type="range"
                  min="100"
                  max="4000"
                  step="50"
                  value={simAlcohol}
                  onChange={(e) => setSimAlcohol(parseInt(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/50">
            <button
              onClick={() => sendSimulatedTelemetry()}
              disabled={loading !== null}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3 h-3 mr-1.5" />
              {loading === 'telemetry' ? 'Sending...' : 'Send Normal Packet'}
            </button>

            <button
              onClick={() => sendSimulatedTelemetry(3500)}
              disabled={loading !== null}
              className="inline-flex items-center px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              title="Test Alcohol Warning (> 3000 ADC)"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Test Alcohol (&gt;3000)
            </button>
          </div>
        </div>

        {/* Accident Simulator Box */}
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mr-1.5" />
                Emergency Crash Trigger
              </span>
              <span className="text-[10px] font-mono text-rose-400">/log-accident</span>
            </div>

            <div className="mb-4">
              <label className="text-[11px] text-slate-400 block mb-1">
                Simulated Crash Severity
              </label>
              <div className="flex gap-2">
                {['Medium', 'High', 'Extreme'].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSimSeverity(sev)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      simSeverity === sev
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700/50">
            <button
              onClick={sendSimulatedAccident}
              disabled={loading !== null}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-rose-900/40 transition-all disabled:opacity-50 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
              {loading === 'accident'
                ? 'Dispatching Emergency Alert...'
                : 'Simulate ESP32 Impact Collision'}
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Terminal Output Log */}
      {log && (
        <div className="mt-3 p-3 rounded-lg bg-black/60 border border-slate-800 text-[11px] font-mono text-emerald-400 break-all flex items-start space-x-2">
          <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span className="flex-1">{log}</span>
        </div>
      )}

      {!isTripActive && (
        <p className="text-[11px] text-amber-400/90 text-center mt-3">
          ⚠️ Note: The edge functions require an active ongoing trip for this helmet MAC. Start a trip first!
        </p>
      )}
    </div>
  );
};
