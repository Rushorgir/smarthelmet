import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Play, Square, Timer, ShieldCheck, Navigation, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Rider, Helmet, Trip } from '../lib/supabase';

interface TripControlProps {
  currentRider: Rider | null;
  currentHelmet: Helmet | null;
  activeTrip: Trip | null;
  onTripStarted: (trip: Trip) => void;
  onTripEnded: () => void;
}

export const TripControl: FC<TripControlProps> = ({
  currentRider,
  currentHelmet,
  activeTrip,
  onTripStarted,
  onTripEnded,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live timer for active trip
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'ongoing') {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(activeTrip.starttime).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((now - startMs) / 1000));
      setElapsedSeconds(diffSecs);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeTrip]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTrip = async () => {
    if (!currentRider || !currentHelmet) {
      setError('Please register or select a Rider and Helmet first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: tripErr } = await supabase
        .from('trips')
        .insert({
          riderid: currentRider.riderid,
          helmetid: currentHelmet.helmetid,
          status: 'ongoing',
          safetyscore: 100,
          starttime: new Date().toISOString(),
        })
        .select()
        .single();

      if (tripErr) throw tripErr;
      onTripStarted(data);
    } catch (err: any) {
      console.error('Failed to start trip:', err);
      setError(err.message || 'Could not start trip.');
    } finally {
      setLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;

    setLoading(true);
    setError(null);

    try {
      const { error: endErr } = await supabase
        .from('trips')
        .update({
          status: 'ended',
        })
        .eq('tripid', activeTrip.tripid);

      if (endErr) throw endErr;
      onTripEnded();
    } catch (err: any) {
      console.error('Failed to end trip:', err);
      setError(err.message || 'Could not end trip.');
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = Boolean(currentRider && currentHelmet);
  const isTripOngoing = Boolean(activeTrip && activeTrip.status === 'ongoing');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-semibold text-lg text-slate-900">
              Trip Control Dashboard
            </h2>
            <p className="text-xs text-slate-500">
              Control the active ride session. ESP32 telemetry ingestion is tied to ongoing trips.
            </p>
          </div>
        </div>

        {/* Live Trip Status Badge */}
        <div>
          {isTripOngoing ? (
            <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-ping" />
              Trip #{activeTrip?.tripid} Ongoing
            </span>
          ) : (
            <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              No Active Trip
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center">
          <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-xs font-medium text-slate-500 block mb-1">
            Active Rider & Helmet
          </span>
          <div className="font-semibold text-slate-800 text-sm truncate">
            {currentRider ? currentRider.name : '—'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            {currentHelmet ? currentHelmet.mac_address : 'No helmet paired'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Trip Elapsed Time</span>
            <Timer className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="font-heading font-bold text-slate-900 text-2xl tracking-tight">
            {isTripOngoing ? formatTimer(elapsedSeconds) : '00:00:00'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isTripOngoing ? 'Tracking telemetry ticks' : 'Timer stopped'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Safety Index Score</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="font-heading font-bold text-emerald-600 text-2xl tracking-tight">
            {activeTrip ? `${activeTrip.safetyscore}/100` : '100/100'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Optimal rating
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={handleStartTrip}
          disabled={!isConfigured || isTripOngoing || loading}
          className={`flex-1 inline-flex items-center justify-center py-3 px-5 rounded-xl font-semibold text-xs tracking-wide shadow-xs transition-all cursor-pointer ${
            isTripOngoing
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : !isConfigured
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 hover:shadow-md'
          }`}
        >
          <Play className="w-4 h-4 mr-2 fill-current" />
          {isTripOngoing ? 'Trip Ongoing' : 'Start New Trip'}
        </button>

        <button
          type="button"
          onClick={handleEndTrip}
          disabled={!isTripOngoing || loading}
          className={`flex-1 inline-flex items-center justify-center py-3 px-5 rounded-xl font-semibold text-xs tracking-wide shadow-xs transition-all cursor-pointer ${
            !isTripOngoing
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20 hover:shadow-md'
          }`}
        >
          <Square className="w-4 h-4 mr-2 fill-current" />
          End Current Trip
        </button>
      </div>

      {!isConfigured && (
        <p className="text-[11px] text-slate-400 text-center mt-3">
          💡 Complete the Rider Profile & Helmet Onboarding above to unlock trip controls.
        </p>
      )}
    </div>
  );
};
