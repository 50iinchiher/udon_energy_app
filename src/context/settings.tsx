import { File, Paths } from 'expo-file-system';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { GRID_EF_KG_PER_KWH } from '@/lib/co2';

export type Settings = {
  espAddress: string;
  pollIntervalS: number;
  ambientC: number;
  gridEf: number;
  soupLiters: number;
  canteens: number;
  dailyLiters: number;
  hotHours: number;
};

type SettingsContextValue = Settings & {
  espUrl: string;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

export const DEFAULT_SETTINGS: Settings = {
  espAddress: '192.168.43.39/data',
  pollIntervalS: 2,
  ambientC: 25,
  gridEf: GRID_EF_KG_PER_KWH,
  soupLiters: 2.3,
  canteens: 1,
  dailyLiters: 50,
  hotHours: 8,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Saved on the phone so the ESP32 address and calculation values survive an app restart.
const settingsFile = () => new File(Paths.document, 'settings.json');

// Keeps only known keys with the right type, so an old or damaged file falls back to the defaults.
function loadSettings(): Settings {
  try {
    const file = settingsFile();
    if (!file.exists) return DEFAULT_SETTINGS;
    const saved: unknown = JSON.parse(file.textSync());
    if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;
    const values = saved as Record<string, unknown>;
    const merged = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const value = values[key];
      if (typeof value === typeof DEFAULT_SETTINGS[key] && (typeof value !== 'number' || Number.isFinite(value))) Object.assign(merged, { [key]: value });
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: Settings) {
  try {
    settingsFile().write(JSON.stringify(settings));
  } catch {
    // Not saved (e.g. on web): the values still apply for this session.
  }
}

export function toEspUrl(address: string) {
  const trimmed = address.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  return <SettingsContext.Provider value={{ ...settings, espUrl: toEspUrl(settings.espAddress), update }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const settings = useContext(SettingsContext);
  if (!settings) throw new Error('useSettings must be used inside SettingsProvider');
  return settings;
}
