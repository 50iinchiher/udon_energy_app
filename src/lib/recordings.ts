import { Directory, File, Paths } from 'expo-file-system';

import { parseReading } from '@/lib/telemetry';
import { createInitialState, reducer, toSample, type Sample } from '@/state/energySession';

// Recordings of real ESP32 sessions, stored on the phone as JSON Lines: one line per received
// response, holding the full JSON exactly as the ESP32 sent it plus the time it arrived.

export type RecordedLine = { t: number; ambientC: number; json: unknown };
export type RecordingInfo = { id: string; startedAt: number; endedAt: number; sampleCount: number; totalEnergyJ: number };

const recordingsDir = () => new Directory(Paths.document, 'recordings');
const recordingFile = (id: string) => new File(recordingsDir(), `${id}.jsonl`);

export function createRecordingFile(startedAt: number) {
  const directory = recordingsDir();
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const id = `rec-${startedAt}`;
  recordingFile(id).create({ overwrite: true });
  return id;
}

export function appendRecordedLine(id: string, line: RecordedLine) {
  recordingFile(id).write(`${JSON.stringify(line)}\n`, { append: true });
}

function isRecordedLine(value: unknown): value is RecordedLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as RecordedLine;
  return typeof line.t === 'number' && typeof line.ambientC === 'number' && 'json' in line;
}

export async function readRecording(id: string): Promise<RecordedLine[]> {
  const text = await recordingFile(id).text();
  return text.split('\n').flatMap((row) => {
    if (!row.trim()) return [];
    try {
      const parsed: unknown = JSON.parse(row);
      return isRecordedLine(parsed) ? [parsed] : [];
    } catch {
      // A partially written last line (app closed mid-write) is skipped.
      return [];
    }
  });
}

// Recorded JSON goes through the same parser and sample builder as live data.
export function lineToSample(line: RecordedLine, t: number): Sample | null {
  try {
    return toSample(parseReading(line.json), t, line.ambientC);
  } catch {
    return null;
  }
}

export function summarizeRecording(id: string, lines: RecordedLine[]): RecordingInfo | null {
  if (lines.length < 2) return null;
  let state = createInitialState(lines[0].t);
  for (const line of lines) {
    const sample = lineToSample(line, line.t);
    if (sample) state = reducer(state, { type: 'sample', mode: 'real', sample });
  }
  return { id, startedAt: lines[0].t, endedAt: lines[lines.length - 1].t, sampleCount: lines.length, totalEnergyJ: state.channels.real.session.totalEnergyJ };
}

// Newest first.
export async function listRecordings(): Promise<RecordingInfo[]> {
  try {
    const directory = recordingsDir();
    if (!directory.exists) return [];
    const ids = directory
      .list()
      .filter((entry): entry is File => entry instanceof File && entry.name.endsWith('.jsonl'))
      .map((file) => file.name.replace(/\.jsonl$/, ''));
    const infos = await Promise.all(ids.map(async (id) => summarizeRecording(id, await readRecording(id))));
    return infos.filter((info): info is RecordingInfo => info !== null).sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

export function deleteRecording(id: string) {
  const file = recordingFile(id);
  if (file.exists) file.delete();
}

// "Oct 6, 14:32"
export function formatRecordingStamp(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
  return `${month} ${date.getDate()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
