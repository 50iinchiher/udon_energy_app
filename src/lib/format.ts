// Shared number and unit formatting. Every user-visible value goes through these helpers so that
// units (mW, V, mA, J, mg, g, °C, min, s) and decimal places stay consistent across all screens.

// Number and unit are joined with a non-breaking space so a line never wraps between them.
export const NBSP = '\u00A0';
export const withUnit = (value: string | number, unit: string) => `${value}${NBSP}${unit}`;

const SUPERSCRIPT: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

function finite(value: number) {
  return Number.isFinite(value) ? value : 0;
}

// 4.2e-5 → "4.2 × 10⁻⁵"
export function formatScientific(value: number, digits = 1) {
  const [mantissa, exponent] = finite(value).toExponential(digits).split('e');
  const cleanMantissa = mantissa.replace(/\.0+$/, '');
  const power = String(Number(exponent)).split('').map((char) => SUPERSCRIPT[char] ?? char).join('');
  return `${cleanMantissa}${NBSP}×${NBSP}10${power}`;
}

// Small quantities such as kWh: keep two significant digits, switch to × 10ⁿ below 0.001.
export function formatSmall(value: number) {
  const safe = finite(value);
  const abs = Math.abs(safe);
  if (abs === 0) return '0';
  if (abs >= 100) return safe.toFixed(0);
  if (abs >= 1) return safe.toFixed(2);
  if (abs >= 0.001) return String(Number(safe.toPrecision(2)));
  return formatScientific(safe);
}

export const formatPower = (mw: number) => withUnit(finite(mw).toFixed(2), 'mW');
// 3 decimals below 1 V (TEG output is often a few hundred mV), 2 otherwise.
export const formatVoltage = (v: number) => withUnit(finite(v).toFixed(Math.abs(finite(v)) < 1 ? 3 : 2), 'V');
export const formatCurrent = (ma: number) => withUnit(finite(ma).toFixed(1), 'mA');
export const formatEnergy = (j: number) => withUnit(finite(j).toFixed(1), 'J');
export const formatTemperature = (c: number) => withUnit(finite(c).toFixed(1), '°C');

// < 1000 mg → mg, otherwise g with 2 decimals.
export function formatCo2(mg: number) {
  const safe = Math.max(0, finite(mg));
  if (safe >= 1000) return withUnit((safe / 1000).toFixed(2), 'g');
  return withUnit(safe.toFixed(safe < 10 ? 2 : 1), 'mg');
}

// Below 0.01 % use scientific style: "4 × 10⁻⁵ %".
export function formatPercent(percent: number) {
  const safe = Math.max(0, finite(percent));
  if (safe === 0) return withUnit(0, '%');
  if (safe < 0.01) return withUnit(formatScientific(safe), '%');
  return withUnit(safe.toFixed(2), '%');
}

// Never show large raw seconds: "12.4 s", "36 min 22 s", "1 h 27 min", "3 d 4 h".
export function formatDuration(seconds: number) {
  const safe = Math.max(0, finite(seconds));
  if (safe < 60) return withUnit(safe.toFixed(1), 's');
  const total = Math.floor(safe);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${withUnit(days, 'd')} ${withUnit(hours, 'h')}`;
  if (hours > 0) return `${withUnit(hours, 'h')} ${withUnit(minutes, 'min')}`;
  return `${withUnit(minutes, 'min')} ${withUnit(secs, 's')}`;
}

// "Some time ago" without a decimal for short gaps: "8 s", then formatDuration.
export function formatAgo(seconds: number) {
  const safe = Math.max(0, finite(seconds));
  return safe < 60 ? withUnit(Math.floor(safe), 's') : formatDuration(safe);
}

// Metres with 1 decimal, or millimetres if below 0.1 m.
export function formatDistance(meters: number) {
  const safe = Math.max(0, finite(meters));
  if (safe < 0.1) return withUnit((safe * 1000).toFixed(1), 'mm');
  return withUnit(safe.toFixed(1), 'm');
}

export function formatClock(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Round up to 1, 2, 2.5, 5 or 10 × 10ⁿ.
function niceStep(value: number) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// Axis from 0 to a "nice" maximum ≥ rawMax with 4–5 evenly spaced ticks.
export function niceScale(rawMax: number) {
  const safeMax = rawMax > 0 && Number.isFinite(rawMax) ? rawMax : 1;
  const step = niceStep(safeMax / 4);
  const intervals = Math.max(1, Math.ceil(safeMax / step - 1e-9));
  const max = step * intervals;
  const ticks = Array.from({ length: intervals + 1 }, (_, index) => Number((step * index).toPrecision(12)));
  let decimals = 0;
  while (decimals < 4 && Math.abs(step * 10 ** decimals - Math.round(step * 10 ** decimals)) > 1e-9) decimals += 1;
  return { max, ticks, label: (tick: number) => tick.toFixed(decimals) };
}
