import type { FC } from 'react';
import { Wine, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

interface AlcoholGaugeProps {
  alcoholLevel: number;
}

export const AlcoholGauge: FC<AlcoholGaugeProps> = ({ alcoholLevel }) => {
  const ALCOHOL_THRESHOLD = 3000;
  const isAlcoholDetected = alcoholLevel > ALCOHOL_THRESHOLD;

  // Percentage on 0 - 4095 scale
  const percentage = Math.min(100, Math.max(0, (alcoholLevel / 4095) * 100));

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 p-6 flex flex-col justify-between ${
        isAlcoholDetected
          ? 'bg-rose-50/70 border-rose-300 shadow-md shadow-rose-500/10'
          : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                isAlcoholDetected
                  ? 'bg-rose-600 text-white animate-bounce'
                  : 'bg-blue-50 text-blue-600'
              }`}
            >
              <Wine className="w-4 h-4" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-slate-800">
              MQ-3 Alcohol Sensor
            </h3>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
            ADC: 12-bit (0–4095)
          </span>
        </div>

        {/* Prominent Warning Banner if alcohol > 3000 */}
        {isAlcoholDetected && (
          <div className="mt-4 p-3 bg-rose-600 text-white rounded-xl flex items-center justify-between shadow-md animate-pulse">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-bold text-xs uppercase tracking-wider">
                  ⚠️ ALCOHOL DETECTED
                </div>
                <div className="text-[11px] text-rose-100">
                  Breath level exceeded safety threshold (&gt; 3000)
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-white/20 rounded-md text-[10px] font-mono font-bold">
              IGNITION LOCK
            </span>
          </div>
        )}

        {/* Metric Readout */}
        <div className="my-6 text-center">
          <div className="flex items-baseline justify-center space-x-2">
            <span
              className={`font-heading font-black text-4xl tracking-tight transition-colors ${
                isAlcoholDetected ? 'text-rose-600 font-mono' : 'text-slate-900'
              }`}
            >
              {Math.round(alcoholLevel)}
            </span>
            <span className="text-xs font-semibold text-slate-400">/ 4095 ADC</span>
          </div>

          <div className="flex items-center justify-center mt-2 space-x-1.5">
            {isAlcoholDetected ? (
              <span className="inline-flex items-center text-xs font-bold text-rose-600">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Intoxication Risk Detected
              </span>
            ) : alcoholLevel > 1500 ? (
              <span className="inline-flex items-center text-xs font-medium text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Elevated Sensor Reading
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-medium text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Sober / Safe Operation Level
              </span>
            )}
          </div>
        </div>

        {/* Multi-tier Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
            <span>0</span>
            <span className="text-amber-600 font-semibold">1500</span>
            <span className="text-rose-600 font-bold">Threshold: 3000</span>
            <span>4095</span>
          </div>

          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isAlcoholDetected
                  ? 'bg-rose-600 animate-pulse'
                  : alcoholLevel > 1500
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between items-center">
        <span>Hardware Alarm</span>
        <span className="font-semibold text-slate-700">
          {isAlcoholDetected ? 'Buzzer & Red LED Active' : 'Normal Standby'}
        </span>
      </div>
    </div>
  );
};
