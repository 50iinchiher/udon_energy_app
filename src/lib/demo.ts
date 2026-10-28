import type { Reading } from '@/lib/telemetry';

// Synthetic example data. It is marked "DEMO" in the header of every tab and kept in a separate store
// from real measurements, so it is never saved into real history or exported.

const AMBIENT_C = 25;
const SOUP_START_C = 85;
const SOUP_AFTER_20_MIN_C = 60;
// Newton cooling: T(t) = ambient + (T0 − ambient)·e^(−t/τ), with T(20 min) = 60 °C.
const COOLING_TAU_S = (20 * 60) / Math.log((SOUP_START_C - AMBIENT_C) / (SOUP_AFTER_20_MIN_C - AMBIENT_C));
// P = k·ΔT²: 36 mW at ΔT = 60 °C.
const TEG_K_MW_PER_C2 = 0.01;
// Two SP1848 modules in series ≈ 4 Ω internal resistance, matched load.
const TEG_LOAD_OHM = 4;

// A simulated run of the hydro generator: power rises, holds and falls over 40–80 s.
const HYDRO_RISE_S = 6;
const HYDRO_FALL_S = 10;

export type HydroBurst = { startedAt: number; durationS: number; peakMw: number };

export function createHydroBurst(now: number): HydroBurst {
  return { startedAt: now, durationS: 40 + Math.random() * 40, peakMw: 50 + Math.random() * 25 };
}

export function isHydroBurstActive(burst: HydroBurst | null, now: number) {
  return burst !== null && now - burst.startedAt <= burst.durationS * 1000;
}

function noise(fraction: number) {
  return 1 + (Math.random() * 2 - 1) * fraction;
}

function hydroPower(burst: HydroBurst | null, now: number) {
  if (!burst) return 0;
  const t = (now - burst.startedAt) / 1000;
  if (t < 0 || t > burst.durationS) return 0;
  const rise = Math.min(1, t / HYDRO_RISE_S);
  const fall = Math.min(1, (burst.durationS - t) / HYDRO_FALL_S);
  return burst.peakMw * Math.min(rise, fall) * noise(0.08);
}

export function createDemoReading(startedAt: number, burst: HydroBurst | null, now: number, seq: number): Reading {
  const elapsedS = Math.max(0, (now - startedAt) / 1000);
  const soupC = AMBIENT_C + (SOUP_START_C - AMBIENT_C) * Math.exp(-elapsedS / COOLING_TAU_S);
  const deltaT = soupC - AMBIENT_C;
  const tegMw = TEG_K_MW_PER_C2 * deltaT * deltaT * noise(0.03);
  const tegV = Math.sqrt((tegMw / 1000) * TEG_LOAD_OHM);
  const hydroMw = hydroPower(burst, now);
  const hydroV = hydroMw > 0 ? 3.2 + (hydroMw / 75) * 1.6 : 0;

  return {
    teg: { voltage: tegV, current_mA: tegV > 0 ? tegMw / tegV : 0, power_mW: tegMw },
    hydro: { voltage: hydroV, current_mA: hydroV > 0 ? hydroMw / hydroV : 0, power_mW: hydroMw },
    soupC,
    seq,
  };
}
