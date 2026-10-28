import type { HydroBurst } from '@/lib/demo';
import type { Reading } from '@/lib/telemetry';

// Single source of truth for every energy value shown in the app.
// Each incoming sample is integrated exactly once (trapezoidal rule over the real time delta).
// Live measurements, the replay of a saved recording and synthetic example data live in separate channels;
// switching modes starts a fresh session, so nothing but live data ever enters the live history.

export type Mode = 'real' | 'replay' | 'demo';
// live = real data arriving; offline = real mode without fresh data; replay = saved real recording;
// demo = synthetic example data.
export type DataStatus = 'live' | 'offline' | 'replay' | 'demo';
export type DeltaTSource = 'heatsink' | 'ambient' | 'none';

export type Sample = Reading & {
  t: number;
  totalPowerMw: number;
  deltaTC?: number;
  deltaTSource: DeltaTSource;
  ambientC: number;
};

export type Session = {
  tegEnergyJ: number;
  hydroEnergyJ: number;
  totalEnergyJ: number;
  sessionStartTime: number;
  peakPowerMw: number;
  // Time actually covered by integration (gaps while disconnected are excluded).
  integratedSeconds: number;
};

type Channel = {
  session: Session;
  history: Sample[];
  // Last sample shown on screen (kept, greyed out, while disconnected).
  lastSample: Sample | null;
  // Previous sample used for integration; null right after a reset.
  anchor: Sample | null;
  lastValidAt: number | null;
};

export type State = {
  mode: Mode;
  modeSince: number;
  channels: Record<Mode, Channel>;
  // Simulated hydro generator run in demo mode.
  hydroBurst: HydroBurst | null;
};

export type Action =
  | { type: 'sample'; mode: Mode; sample: Sample }
  | { type: 'reset'; now: number }
  | { type: 'setMode'; mode: Mode; now: number }
  | { type: 'hydroBurst'; burst: HydroBurst };

export const STALE_AFTER_S = 6;
// 2 hours at one sample every 2 s.
const MAX_HISTORY = 3600;

const emptySession = (now: number): Session => ({ tegEnergyJ: 0, hydroEnergyJ: 0, totalEnergyJ: 0, sessionStartTime: now, peakPowerMw: 0, integratedSeconds: 0 });
const emptyChannel = (now: number): Channel => ({ session: emptySession(now), history: [], lastSample: null, anchor: null, lastValidAt: null });
export const createInitialState = (now: number): State => ({ mode: 'real', modeSince: now, channels: { real: emptyChannel(now), replay: emptyChannel(now), demo: emptyChannel(now) }, hydroBurst: null });

function integrateSample(channel: Channel, sample: Sample): Channel {
  const previous = channel.anchor;
  // A repeated seq means the ESP32 has not produced a new measurement: treat as stale.
  if (previous && sample.seq !== undefined && sample.seq === previous.seq) return channel;

  const rawSeconds = previous ? (sample.t - previous.t) / 1000 : 0;
  // Do not integrate across a disconnection gap.
  const seconds = rawSeconds > 0 && rawSeconds <= STALE_AFTER_S ? rawSeconds : 0;
  const tegJ = previous ? (seconds * (previous.teg.power_mW + sample.teg.power_mW)) / 2 / 1000 : 0;
  const hydroJ = previous ? (seconds * (previous.hydro.power_mW + sample.hydro.power_mW)) / 2 / 1000 : 0;
  const { session } = channel;

  return {
    session: {
      tegEnergyJ: session.tegEnergyJ + tegJ,
      hydroEnergyJ: session.hydroEnergyJ + hydroJ,
      totalEnergyJ: session.totalEnergyJ + tegJ + hydroJ,
      sessionStartTime: session.sessionStartTime,
      peakPowerMw: Math.max(session.peakPowerMw, sample.totalPowerMw),
      integratedSeconds: session.integratedSeconds + seconds,
    },
    history: [...channel.history, sample].slice(-MAX_HISTORY),
    lastSample: sample,
    anchor: sample,
    lastValidAt: sample.t,
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'sample':
      // A late response from the other mode must never leak into this mode's data.
      if (action.mode !== state.mode) return state;
      return { ...state, channels: { ...state.channels, [state.mode]: integrateSample(state.channels[state.mode], action.sample) } };
    case 'reset': {
      const channel = state.channels[state.mode];
      return { ...state, channels: { ...state.channels, [state.mode]: { ...channel, session: emptySession(action.now), history: [], anchor: null } } };
    }
    case 'setMode':
      if (action.mode === state.mode) return state;
      return { mode: action.mode, modeSince: action.now, channels: { ...state.channels, [action.mode]: emptyChannel(action.now) }, hydroBurst: null };
    case 'hydroBurst':
      return state.mode === 'demo' ? { ...state, hydroBurst: action.burst } : state;
  }
}

export function toSample(reading: Reading, t: number, ambientC: number): Sample {
  // Prefer a measured heatsink ΔT; otherwise soup − ambient (ambient set in Settings).
  const heatsinkDeltaT = reading.deltaTC ?? (reading.soupC !== undefined && reading.heatsinkC !== undefined ? reading.soupC - reading.heatsinkC : undefined);
  const ambientDeltaT = reading.soupC !== undefined ? reading.soupC - ambientC : undefined;
  const deltaTSource: DeltaTSource = heatsinkDeltaT !== undefined ? 'heatsink' : ambientDeltaT !== undefined ? 'ambient' : 'none';
  return {
    ...reading,
    t,
    totalPowerMw: reading.teg.power_mW + reading.hydro.power_mW,
    deltaTC: heatsinkDeltaT ?? ambientDeltaT,
    deltaTSource,
    ambientC,
  };
}
