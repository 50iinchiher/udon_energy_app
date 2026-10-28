export const GRID_EF_KG_PER_KWH = 0.817;
export const J_PER_KWH = 3.6e6;
const WATER_SPECIFIC_HEAT = 4186;

// Assumptions shown to the user next to the equivalents.
export const CAR_G_PER_KM = 120;
export const TREE_KG_PER_YEAR = 21;
export const LED_POWER_W = 0.1;
export const SOUP_START_C = 20;
export const SOUP_END_C = 90;
export const SOURCE_URL = 'https://gec.jp/jcm/projects/p_archive/14ps_mgl_01/';

// CO₂ (mg) = E (J) / 3.6e6 × EF (kg/kWh) × 1e6
export function co2Mg(energyJ: number, efKgPerKWh = GRID_EF_KG_PER_KWH) {
  return (Math.max(0, energyJ) / J_PER_KWH) * efKgPerKWh * 1e6;
}

// Heating energy = liters × 4186 × (90 − 20) J
export function heatingEnergyJ(liters: number) {
  return Math.max(0, liters) * WATER_SPECIFIC_HEAT * (SOUP_END_C - SOUP_START_C);
}

export function recoveredPercent(sessionEnergyJ: number, liters: number) {
  const heatJ = heatingEnergyJ(liters);
  return heatJ > 0 ? (Math.max(0, sessionEnergyJ) / heatJ) * 100 : 0;
}

// Car: 120 g/km = 120 mg/m.
export function carDistanceMeters(mg: number) {
  return mg / CAR_G_PER_KM;
}

// Tree: 21 kg/year spread evenly over the year → mg/s.
export function treeSeconds(mg: number) {
  const mgPerSecond = (TREE_KG_PER_YEAR * 1e6) / (365 * 24 * 3600);
  return mg / mgPerSecond;
}
