import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 
  import.meta.env.VITE_SUPABASE_URL || '';

export const SUPABASE_ANON_KEY = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[SmartHelmet] Supabase environment variables missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in software/.env'
  );
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder-anon-key', 
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

export interface Rider {
  riderid: number;
  name: string;
  contact: string | null;
  license: string | null;
}

export interface Helmet {
  helmetid: number;
  mac_address: string;
}

export interface Trip {
  tripid: number;
  riderid: number;
  helmetid: number;
  starttime: string;
  status: 'ongoing' | 'ended';
  safetyscore: number;
}

export interface Telemetry {
  id: number;
  time: string;
  tripid: number;
  speed: number;
  alcohollevel: number;
}

export interface Accident {
  accidentid: number;
  tripid: number;
  location: string | null;
  severity: string | null;
  reporttime: string;
}

export interface Alert {
  alertid: number;
  accidentid: number;
  message: string;
  alerttime: string;
}
