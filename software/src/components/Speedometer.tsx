import type { FC } from 'react';
import { Gauge } from 'lucide-react';

interface SpeedometerProps {
  speed: number;
  maxRecordedSpeed: number;
}

export const Speedometer: FC<SpeedometerProps> = ({
  speed,
  maxRecordedSpeed,
}) => {
  // Clamped speed between 0 and 140 km/h
  const safeSpeed = Math.max(0, Math.min(140, Number(speed) || 0));
  
  // Calculate angle for SVG gauge: -180 deg (0 km/h) to 0 deg (140 km/h)
  // An arc from -135 deg to +135 deg is 270 degrees total
  const minAngle = -135;
  const maxAngle = 135;
  const angleRange = maxAngle - minAngle; // 270
  const currentAngle = minAngle + (safeSpeed / 140) * angleRange;

  // Determine speed tier color
  const getSpeedColor = (val: number) => {
    if (val > 80) return 'text-rose-600 stroke-rose-500';
    if (val > 50) return 'text-amber-500 stroke-amber-500';
    return 'text-blue-600 stroke-blue-500';
  };

  const speedColorClass = getSpeedColor(safeSpeed);

  // SVG arc calculation
  // Radius = 80, Center = (100, 100)
  const radius = 75;
  const circumference = 2 * Math.PI * radius; // ~471.24
  // We use 75% of circumference (270 degrees arc) = ~353.43
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (safeSpeed / 140) * arcLength;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-between">
      <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Gauge className="w-4 h-4" />
          </div>
          <h3 className="font-heading font-semibold text-sm text-slate-800">
            Speedometer
          </h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
          GPS NEO-6M
        </span>
      </div>

      {/* SVG Arc Gauge */}
      <div className="relative w-48 h-48 my-2 flex items-center justify-center">
        <svg className="w-full h-full -rotate-225" viewBox="0 0 200 200">
          {/* Background track arc (270 deg) */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="12"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Active speed progress arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            className={`${speedColorClass} transition-all duration-700 ease-out`}
            strokeWidth="12"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Needle / Center Hub */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-700 ease-out"
          style={{ transform: `rotate(${currentAngle}deg)` }}
        >
          <div className="w-1 h-20 bg-slate-800 rounded-full origin-bottom mb-20 shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 -ml-[3px] -mt-1 shadow-xs" />
          </div>
        </div>

        {/* Center Digital Readout */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <div className="w-6 h-6 rounded-full bg-slate-900 border-2 border-white shadow-sm mb-1" />
          <span className="font-heading font-black text-3xl text-slate-900 tracking-tight">
            {safeSpeed.toFixed(1)}
          </span>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            km / h
          </span>
        </div>
      </div>

      {/* Speed Metrics Footer */}
      <div className="w-full grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center">
        <div className="p-2 rounded-lg bg-slate-50">
          <span className="text-[10px] text-slate-400 block uppercase tracking-wide">
            Peak Velocity
          </span>
          <span className="text-xs font-bold font-mono text-slate-700">
            {Math.max(maxRecordedSpeed, safeSpeed).toFixed(1)} km/h
          </span>
        </div>
        <div className="p-2 rounded-lg bg-slate-50">
          <span className="text-[10px] text-slate-400 block uppercase tracking-wide">
            Current Status
          </span>
          <span
            className={`text-xs font-bold ${
              safeSpeed > 80
                ? 'text-rose-600'
                : safeSpeed > 50
                ? 'text-amber-600'
                : 'text-emerald-600'
            }`}
          >
            {safeSpeed === 0
              ? 'Stationary'
              : safeSpeed > 80
              ? 'High Speed'
              : safeSpeed > 50
              ? 'Cruising'
              : 'Urban Speed'}
          </span>
        </div>
      </div>
    </div>
  );
};
