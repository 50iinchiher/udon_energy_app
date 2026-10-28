import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';

import { useSettings } from '@/context/settings';
import { createDemoReading, createHydroBurst, isHydroBurstActive } from '@/lib/demo';
import { appendRecordedLine, createRecordingFile, deleteRecording, formatRecordingStamp, lineToSample, listRecordings, readRecording, summarizeRecording, type RecordedLine, type RecordingInfo } from '@/lib/recordings';
import { parseReading } from '@/lib/telemetry';
import { createInitialState, reducer, STALE_AFTER_S, toSample, type DataStatus, type Mode, type Sample, type Session } from '@/state/energySession';

export { STALE_AFTER_S, type DataStatus, type DeltaTSource, type Mode, type Sample } from '@/state/energySession';

const REQUEST_TIMEOUT_MS = 3000;
// Pause between the end of a recording and the start of the next loop.
const REPLAY_LOOP_PAUSE_MS = 2000;

export type EnergyStore = Session & {
  mode: Mode;
  status: DataStatus;
  // Short mode label for badges ("RECORDING" during replay) and the longer one for the header.
  statusLabel: string;
  headerLabel: string;
  // Real mode without fresh data: show last values greyed out.
  isStale: boolean;
  secondsSinceData: number;
  hasEverReceived: boolean;
  lastSample: Sample | null;
  history: Sample[];
  now: number;
  tegAvgMw: number;
  hydroAvgMw: number;
  recordings: RecordingInfo[];
  // Recording in progress (real mode only).
  activeRecording: { id: string; startedAt: number; lineCount: number } | null;
  replaying: RecordingInfo | null;
  resetSession: () => void;
  // Returns false if the recording file could not be created.
  startRecording: () => boolean;
  stopRecording: () => Promise<void>;
  removeRecording: (id: string) => void;
  startReplay: (id: string) => Promise<void>;
  stopReplay: () => void;
  hydroBurstActive: boolean;
  runHydroGenerator: () => void;
  setDemo: (enabled: boolean) => void;
};

const EnergyStoreContext = createContext<EnergyStore | null>(null);

export function EnergyStoreProvider({ children }: { children: ReactNode }) {
  const { espUrl, pollIntervalS, ambientC } = useSettings();
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState(Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [recordings, setRecordings] = useState<RecordingInfo[]>([]);
  const [activeRecording, setActiveRecording] = useState<EnergyStore['activeRecording']>(null);
  // Read by the polling loop without restarting it.
  const recordingId = useRef<string | null>(null);
  const [replayData, setReplayData] = useState<{ info: RecordingInfo; lines: RecordedLine[] } | null>(null);
  const demoSeq = useRef(0);
  const { mode, modeSince, hydroBurst } = state;

  // Clock for "N s ago" and stale detection.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load the list of saved recordings once at startup.
  useEffect(() => {
    let active = true;
    listRecordings().then((saved) => {
      if (active) setRecordings(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  // Real mode: poll the ESP32.
  useEffect(() => {
    if (mode !== 'real') return;
    let active = true;
    let busy = false;

    const tick = async () => {
      if (busy) return;
      busy = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(espUrl, { signal: controller.signal });
        if (!response.ok) throw new Error('http');
        const json: unknown = await response.json();
        const reading = parseReading(json);
        const t = Date.now();
        if (!active) return;
        dispatch({ type: 'sample', mode: 'real', sample: toSample(reading, t, ambientC) });
        const id = recordingId.current;
        if (id) {
          try {
            appendRecordedLine(id, { t, ambientC, json });
            setActiveRecording((current) => (current && current.id === id ? { ...current, lineCount: current.lineCount + 1 } : current));
          } catch {
            // Keep measuring even if one line could not be written.
          }
        }
      } catch {
        // No valid sample: the stale banner appears after STALE_AFTER_S and integration pauses.
      } finally {
        clearTimeout(timeout);
        busy = false;
      }
    };

    tick();
    const timer = setInterval(tick, pollIntervalS * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [mode, espUrl, pollIntervalS, ambientC]);

  // Replay mode: feed the recorded ESP32 JSON through the same pipeline at real speed, shifted to the current time.
  useEffect(() => {
    if (mode !== 'replay' || !replayData) return;
    const { lines } = replayData;
    const firstT = lines[0].t;
    let index = 0;
    let base = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      const line = lines[index];
      const sample = lineToSample(line, base + (line.t - firstT));
      if (sample) dispatch({ type: 'sample', mode: 'replay', sample });
      index += 1;
      if (index < lines.length) {
        timer = setTimeout(step, lines[index].t - lines[index - 1].t);
        return;
      }
      // End of recording: start over with a fresh session so totals match the recording again.
      timer = setTimeout(() => {
        index = 0;
        base = Date.now();
        dispatch({ type: 'reset', now: base });
        step();
      }, REPLAY_LOOP_PAUSE_MS);
    };

    step();
    return () => clearTimeout(timer);
  }, [mode, modeSince, replayData]);

  // Demo mode: synthetic example data on the same polling interval.
  useEffect(() => {
    if (mode !== 'demo') return;
    const tick = () => {
      demoSeq.current += 1;
      const now = Date.now();
      dispatch({ type: 'sample', mode: 'demo', sample: toSample(createDemoReading(modeSince, hydroBurst, now, demoSeq.current), now, ambientC) });
    };
    tick();
    const timer = setInterval(tick, pollIntervalS * 1000);
    return () => clearInterval(timer);
  }, [mode, modeSince, hydroBurst, pollIntervalS, ambientC]);

  const channel = state.channels[mode];
  const reference = channel.lastValidAt ?? modeSince;
  const secondsSinceData = Math.max(0, (now - reference) / 1000);
  const fresh = channel.lastValidAt !== null && secondsSinceData <= STALE_AFTER_S;
  const status: DataStatus = mode === 'replay' ? 'replay' : mode === 'demo' ? 'demo' : fresh ? 'live' : 'offline';
  const { session } = channel;
  const averageMw = (energyJ: number) => (session.integratedSeconds > 0 ? (energyJ / session.integratedSeconds) * 1000 : 0);

  function startRecording() {
    if (mode !== 'real' || recordingId.current) return false;
    try {
      const startedAt = Date.now();
      const id = createRecordingFile(startedAt);
      recordingId.current = id;
      setActiveRecording({ id, startedAt, lineCount: 0 });
      return true;
    } catch {
      return false;
    }
  }

  async function stopRecording() {
    const id = recordingId.current;
    if (!id) return;
    recordingId.current = null;
    setActiveRecording(null);
    try {
      const info = summarizeRecording(id, await readRecording(id));
      if (info) setRecordings((current) => [info, ...current.filter((item) => item.id !== id)]);
      // Fewer than two samples is not a usable recording.
      else deleteRecording(id);
    } catch {
      // The file stays on disk and is picked up by listRecordings on the next start.
    }
  }

  const value: EnergyStore = {
    ...session,
    mode,
    status,
    statusLabel: STATUS_LABEL[status],
    headerLabel: status === 'replay' && replayData ? `Recording · ${formatRecordingStamp(replayData.info.startedAt)}` : STATUS_LABEL[status],
    isStale: mode === 'real' && !fresh && channel.lastSample !== null,
    secondsSinceData,
    hasEverReceived: channel.lastValidAt !== null,
    lastSample: channel.lastSample,
    history: channel.history,
    now,
    tegAvgMw: averageMw(session.tegEnergyJ),
    hydroAvgMw: averageMw(session.hydroEnergyJ),
    recordings,
    activeRecording,
    replaying: mode === 'replay' && replayData ? replayData.info : null,
    resetSession: () => dispatch({ type: 'reset', now: Date.now() }),
    startRecording,
    stopRecording,
    removeRecording: (id) => {
      if (id === recordingId.current || (mode === 'replay' && replayData?.info.id === id)) return;
      try {
        deleteRecording(id);
      } finally {
        setRecordings((current) => current.filter((info) => info.id !== id));
      }
    },
    startReplay: async (id) => {
      await stopRecording();
      const info = recordings.find((item) => item.id === id);
      if (!info) return;
      try {
        const lines = await readRecording(id);
        if (lines.length < 2) return;
        setReplayData({ info, lines });
        // Switching from one recording to another keeps the replay mode, so start a fresh session explicitly.
        if (mode === 'replay') dispatch({ type: 'reset', now: Date.now() });
        dispatch({ type: 'setMode', mode: 'replay', now: Date.now() });
      } catch {
        // Unreadable file: stay in the current mode.
      }
    },
    stopReplay: () => {
      dispatch({ type: 'setMode', mode: 'real', now: Date.now() });
      setReplayData(null);
    },
    hydroBurstActive: mode === 'demo' && isHydroBurstActive(hydroBurst, now),
    runHydroGenerator: () => dispatch({ type: 'hydroBurst', burst: createHydroBurst(Date.now()) }),
    setDemo: (enabled) => {
      if (enabled) stopRecording();
      dispatch({ type: 'setMode', mode: enabled ? 'demo' : 'real', now: Date.now() });
    },
  };

  return <EnergyStoreContext.Provider value={value}>{children}</EnergyStoreContext.Provider>;
}

export function useEnergyStore() {
  const store = useContext(EnergyStoreContext);
  if (!store) throw new Error('useEnergyStore must be used inside EnergyStoreProvider');
  return store;
}

export const STATUS_LABEL: Record<DataStatus, string> = { live: 'LIVE', replay: 'RECORDING', demo: 'DEMO', offline: 'OFFLINE' };
export const STATUS_COLOR: Record<DataStatus, string> = { live: '#4ecca3', replay: '#6fb8e8', demo: '#9aa8b2', offline: '#e74c3c' };
