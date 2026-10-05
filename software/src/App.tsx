import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { OnboardingForm } from './components/OnboardingForm';
import { TripControl } from './components/TripControl';
import { Speedometer } from './components/Speedometer';
import { AlcoholGauge } from './components/AlcoholGauge';
import { AccidentBanner } from './components/AccidentBanner';
import { TelemetryTable } from './components/TelemetryTable';
import { HardwareSimulator } from './components/HardwareSimulator';
import { supabase } from './lib/supabase';
import type { Rider, Helmet, Trip, Telemetry, Accident, Alert } from './lib/supabase';
import { Activity } from 'lucide-react';

export function App() {
  // Session State
  const [currentRider, setCurrentRider] = useState<Rider | null>(() => {
    const saved = localStorage.getItem('sh_rider');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentHelmet, setCurrentHelmet] = useState<Helmet | null>(() => {
    const saved = localStorage.getItem('sh_helmet');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTrip, setActiveTrip] = useState<Trip | null>(() => {
    const saved = localStorage.getItem('sh_trip');
    return saved ? JSON.parse(saved) : null;
  });

  // Telemetry & Sensor State
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [maxSpeed, setMaxSpeed] = useState<number>(0);
  const [currentAlcohol, setCurrentAlcohol] = useState<number>(0);
  const [telemetryHistory, setTelemetryHistory] = useState<Telemetry[]>([]);

  // Emergency / Accident State
  const [activeAccident, setActiveAccident] = useState<Accident | null>(null);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);

  // Connection & Channel State
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const channelRef = useRef<any>(null);

  // Persist session to localStorage
  useEffect(() => {
    if (currentRider) localStorage.setItem('sh_rider', JSON.stringify(currentRider));
    else localStorage.removeItem('sh_rider');
  }, [currentRider]);

  useEffect(() => {
    if (currentHelmet) localStorage.setItem('sh_helmet', JSON.stringify(currentHelmet));
    else localStorage.removeItem('sh_helmet');
  }, [currentHelmet]);

  useEffect(() => {
    if (activeTrip) localStorage.setItem('sh_trip', JSON.stringify(activeTrip));
    else localStorage.removeItem('sh_trip');
  }, [activeTrip]);

  // Check Supabase for existing ongoing trip if helmet is selected
  useEffect(() => {
    if (!currentHelmet) return;

    const checkExistingTrip = async () => {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('helmetid', currentHelmet.helmetid)
          .eq('status', 'ongoing')
          .order('starttime', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error checking ongoing trip:', error);
          return;
        }

        if (data) {
          setActiveTrip(data);
        } else if (activeTrip?.status === 'ongoing') {
          setActiveTrip(null);
        }
      } catch (err) {
        console.error('Failed to sync trip status:', err);
      }
    };

    checkExistingTrip();
  }, [currentHelmet?.helmetid]);

  // Load initial telemetry and accidents history when an active trip is ongoing
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'ongoing') {
      setCurrentSpeed(0);
      setCurrentAlcohol(0);
      setTelemetryHistory([]);
      return;
    }

    const loadTripData = async () => {
      // 1. Fetch latest telemetry
      const { data: telData } = await supabase
        .from('telemetry')
        .select('*')
        .eq('tripid', activeTrip.tripid)
        .order('time', { ascending: false })
        .limit(20);

      if (telData && telData.length > 0) {
        setTelemetryHistory(telData);
        setCurrentSpeed(Number(telData[0].speed) || 0);
        setCurrentAlcohol(Number(telData[0].alcohollevel) || 0);
        const max = Math.max(...telData.map((t) => Number(t.speed) || 0));
        setMaxSpeed(max);
      }

      // 2. Fetch latest accident if any
      const { data: accData } = await supabase
        .from('accidents')
        .select('*')
        .eq('tripid', activeTrip.tripid)
        .order('reporttime', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (accData) {
        setActiveAccident(accData);
        // Fetch corresponding alert
        const { data: alertData } = await supabase
          .from('alerts')
          .select('*')
          .eq('accidentid', accData.accidentid)
          .maybeSingle();

        if (alertData) setActiveAlert(alertData);
      }
    };

    loadTripData();
  }, [activeTrip?.tripid]);

  // Set up Supabase Realtime Channels for telemetry & accidents
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'ongoing') {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const tripId = activeTrip.tripid;
    const channelName = `trip-room-${tripId}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      // 1. Subscribe to new telemetry rows for this trip
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'telemetry',
          filter: `tripid=eq.${tripId}`,
        },
        (payload) => {
          const newRow = payload.new as Telemetry;
          if (!newRow) return;

          const speedVal = Number(newRow.speed) || 0;
          const alcoholVal = Number(newRow.alcohollevel) || 0;

          setCurrentSpeed(speedVal);
          setCurrentAlcohol(alcoholVal);
          setMaxSpeed((prev) => Math.max(prev, speedVal));

          setTelemetryHistory((prev) => [newRow, ...prev.slice(0, 19)]);
        }
      )
      // 2. Subscribe to new accidents for this trip
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'accidents',
          filter: `tripid=eq.${tripId}`,
        },
        async (payload) => {
          const newAccident = payload.new as Accident;
          if (!newAccident) return;

          setActiveAccident(newAccident);

          // Fetch auto-generated alert from trigger
          setTimeout(async () => {
            const { data: alertData } = await supabase
              .from('alerts')
              .select('*')
              .eq('accidentid', newAccident.accidentid)
              .maybeSingle();

            if (alertData) {
              setActiveAlert(alertData);
            }
          }, 600);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [activeTrip?.tripid]);

  const handleRegistered = (rider: Rider, helmet: Helmet) => {
    setCurrentRider(rider);
    setCurrentHelmet(helmet);
  };

  const handleTripStarted = (trip: Trip) => {
    setActiveTrip(trip);
    setActiveAccident(null);
    setActiveAlert(null);
    setCurrentSpeed(0);
    setMaxSpeed(0);
    setCurrentAlcohol(0);
    setTelemetryHistory([]);
  };

  const handleTripEnded = () => {
    if (activeTrip) {
      setActiveTrip({ ...activeTrip, status: 'ended' });
    }
  };

  const isTripOngoing = Boolean(activeTrip && activeTrip.status === 'ongoing');
  const isAlcoholAlert = currentAlcohol > 3000;
  const hasEmergency = Boolean(activeAccident);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        isConnected={isConnected}
        activeTripId={isTripOngoing ? activeTrip?.tripid || null : null}
        hasEmergency={hasEmergency}
        hasAlcoholAlert={isAlcoholAlert}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Emergency Accident Alert Banner */}
        <AccidentBanner
          accident={activeAccident}
          alert={activeAlert}
          onDismiss={() => {
            setActiveAccident(null);
            setActiveAlert(null);
          }}
        />

        {/* Section 1: Onboarding Card */}
        <OnboardingForm
          currentRider={currentRider}
          currentHelmet={currentHelmet}
          onRegistered={handleRegistered}
          disabled={isTripOngoing}
        />

        {/* Section 2: Trip Controls */}
        <TripControl
          currentRider={currentRider}
          currentHelmet={currentHelmet}
          activeTrip={activeTrip}
          onTripStarted={handleTripStarted}
          onTripEnded={handleTripEnded}
        />

        {/* Section 3: Live Telemetry & Safety Monitor */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="font-heading font-bold text-lg text-slate-900">
              Live Telemetry & Safety Monitor
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Speedometer
              speed={currentSpeed}
              maxRecordedSpeed={maxSpeed}
            />

            <AlcoholGauge
              alcoholLevel={currentAlcohol}
            />
          </div>
        </div>

        {/* Section 4: Live Telemetry Packet Stream Table */}
        <TelemetryTable
          telemetryList={telemetryHistory}
          isTripActive={isTripOngoing}
        />

        {/* Section 5: Hardware Simulator */}
        <HardwareSimulator
          currentHelmet={currentHelmet}
          isTripActive={isTripOngoing}
        />
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Intelligent Helmet for Rider Safety • ESP32 IoT & Supabase Architecture
          </span>
          <span className="font-mono text-slate-400">
            Postgres Triggers • Edge Functions • Realtime
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
