export type SourceReading = { voltage: number; current_mA: number; power_mW: number };

// One reading as received from the ESP32, before the store adds a timestamp.
export type Reading = {
  teg: SourceReading;
  hydro: SourceReading;
  soupC?: number;
  // Second (heatsink) sensor, if the ESP32 reports one.
  heatsinkC?: number;
  // ΔT sent directly by the ESP32 (assumed soup − heatsink).
  deltaTC?: number;
  batteryV?: number;
  charging?: boolean;
  deliveredJ?: number;
  seq?: number;
};

export const emptySource: SourceReading = { voltage: 0, current_mA: 0, power_mW: 0 };

function parseSource(value: unknown): SourceReading | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const voltage = source.voltage ?? source.voltage_V ?? source.bus_V;
  const current = source.current_mA ?? source.current;
  const power = source.power_mW ?? source.power;
  if (typeof voltage !== 'number' || typeof current !== 'number' || typeof power !== 'number') return null;
  // INA219 can report tiny negative noise at zero flow; harvested power cannot be negative.
  return { voltage, current_mA: current, power_mW: Math.max(0, power) };
}

// Accepts the current { teg, turbine|hydro, storage } format and the legacy flat single-source format.
export function parseReading(value: unknown): Reading {
  if (!value || typeof value !== 'object') throw new Error('invalid');
  const json = value as Record<string, unknown>;
  const readNumber = (...keys: string[]) => keys.map((key) => json[key]).find((item): item is number => typeof item === 'number' && Number.isFinite(item));

  const heatsinkC = readNumber('heatsinkTemperature_C', 'heatsink_C', 'coldTemperature_C', 'cold_temp_C', 'coldTemperature', 'cold_temp', 'coldTemp');
  const hotC = readNumber('hotTemperature_C', 'hot_temp_C', 'hotTemperature', 'hot_temp', 'hotTemp');
  const soupC = readNumber('soupTemperature_C', 'soup_temp_C', 'soup_C', 'temperature_C', 'temperature', 'temp_C', 'temp') ?? hotC;
  const deltaTC = readNumber('deltaT_C', 'delta_T_C');

  const storage = json.storage && typeof json.storage === 'object' ? (json.storage as Record<string, unknown>) : {};
  const batteryV = typeof storage.battery_v === 'number' ? storage.battery_v : undefined;
  const charging = typeof storage.charging === 'boolean' ? storage.charging : typeof storage.charging === 'number' ? storage.charging !== 0 : undefined;
  const deliveredJ = typeof storage.delivered_j === 'number' ? storage.delivered_j : undefined;
  const seq = typeof json.seq === 'number' ? json.seq : undefined;
  const extras = { soupC, heatsinkC, deltaTC, batteryV, charging, deliveredJ, seq };

  const teg = parseSource(json.teg);
  const hydro = parseSource(json.hydro ?? json.turbine);
  if (teg || hydro) return { teg: teg ?? emptySource, hydro: hydro ?? emptySource, ...extras };

  const single = parseSource(json);
  if (single) return { teg: single, hydro: emptySource, ...extras };

  throw new Error('invalid');
}
