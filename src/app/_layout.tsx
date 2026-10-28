import { useFonts } from 'expo-font';
import { DarkTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { palette } from '@/components/screen';
import { interFonts } from '@/components/text';
import { SettingsProvider } from '@/context/settings';
import { EnergyStoreProvider } from '@/state/energyStore';

SplashScreen.preventAutoHideAsync();

// The app is always dark, whatever the phone's light/dark setting.
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: palette.background, card: palette.background } };

export default function TabLayout() {
  const [fontsLoaded, fontError] = useFonts(interFonts);

  // Keep the native splash screen up until Inter is ready (on error, fall back to the system font).
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <SettingsProvider>
        <EnergyStoreProvider>
          <AnimatedSplashOverlay />
          <AppTabs />
        </EnergyStoreProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
