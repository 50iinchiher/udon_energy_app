import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { createContext, useContext } from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';

// Inter covers Latin and Cyrillic. Only these four weights are bundled.
export const interFonts = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold };

// Digits keep a fixed width so live values do not jitter when they update.
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

const isWeb = process.env.EXPO_OS === 'web';

// Custom fonts cannot be synthesised to other weights on Android, so each weight maps to its own family.
// 800/900 are not bundled and fall back to Bold.
export function interFamily(weight: TextStyle['fontWeight']) {
  const numeric = weight === undefined || weight === 'normal' ? 400 : weight === 'bold' ? 700 : Number(weight);
  if (numeric >= 700) return 'Inter_700Bold';
  if (numeric >= 600) return 'Inter_600SemiBold';
  if (numeric >= 500) return 'Inter_500Medium';
  return 'Inter_400Regular';
}

const InsideText = createContext(false);

// Drop-in replacement for React Native's Text that applies Inter by default.
// Nested Text without its own fontWeight inherits the parent's font instead of resetting to Regular.
export function Text({ style, children, ...rest }: TextProps) {
  const nested = useContext(InsideText);
  const flat = StyleSheet.flatten(style) ?? {};
  const needsFont = !flat.fontFamily && (flat.fontWeight !== undefined || !nested);
  // Web keeps fontWeight and falls back to the --font-display stack from global.css.
  const fontStyle: TextStyle | null = !needsFont ? null : isWeb ? { fontFamily: `${interFamily(flat.fontWeight)}, var(--font-display)` } : { fontFamily: interFamily(flat.fontWeight), fontWeight: 'normal' };

  return (
    <InsideText.Provider value>
      <RNText {...rest} style={[style, fontStyle]}>
        {children}
      </RNText>
    </InsideText.Provider>
  );
}
