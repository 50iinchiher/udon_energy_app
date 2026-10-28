import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { BottomTabInset } from '@/constants/theme';
import { useSettings } from '@/context/settings';
import { formatAgo } from '@/lib/format';
import { formatRecordingStamp } from '@/lib/recordings';
import { STATUS_COLOR, useEnergyStore } from '@/state/energyStore';

export const palette = {
  background: '#10151b',
  card: '#18232c',
  cardInner: '#121d26',
  border: '#2b3b47',
  text: '#f5f7f8',
  textMuted: '#9eb0b8',
  textFaint: '#7d8d97',
  teg: '#4ecca3',
  hydro: '#f39c12',
  danger: '#e74c3c',
};

// Thin, calm line while a saved recording or simulated data is shown instead of live ESP32 data.
function DemoLine() {
  const { mode, replaying, setDemo, stopReplay } = useEnergyStore();
  if (mode === 'real') return null;
  const text = replaying ? `Showing recorded data · ${formatRecordingStamp(replaying.startedAt)}` : 'Showing demo (simulated) data';
  const stop = () => (mode === 'replay' ? stopReplay() : setDemo(false));
  return (
    <View style={styles.demoLine}>
      <Text style={styles.demoText}>{text}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to live data" onPress={stop} hitSlop={10}>
        <Text style={styles.demoStop}>Stop</Text>
      </Pressable>
    </View>
  );
}

// Red banner when real mode has no valid sample for more than 6 s.
function ConnectionBanner() {
  const { status, mode, secondsSinceData, hasEverReceived, recordings, startReplay } = useEnergyStore();
  const latest = recordings[0];
  const { espAddress } = useSettings();
  if (mode !== 'real' || status !== 'offline' || secondsSinceData <= 6) return null;
  return (
    <View style={styles.offlineBanner} accessibilityRole="alert">
      <Text style={styles.offlineText}>
        {hasEverReceived
          ? `Connection to ESP32 lost — last data ${formatAgo(secondsSinceData)} ago`
          : `Cannot reach the ESP32 (${espAddress}). Check Settings and the Wi-Fi network.`}
      </Text>
      {hasEverReceived && <Text style={styles.offlineHint}>Last values are shown greyed out and energy counting is paused.</Text>}
      {latest && (
        <Pressable accessibilityRole="button" onPress={() => startReplay(latest.id)} style={styles.offlineAction} hitSlop={6}>
          <Text style={styles.offlineActionText}>Play latest recording</Text>
        </Pressable>
      )}
    </View>
  );
}

// Mode badge. In the header it shows the longer label, e.g. "Recording · Oct 6, 14:32" during replay.
export function StatusBadge({ header = false }: { header?: boolean }) {
  const { status, statusLabel, headerLabel } = useEnergyStore();
  const color = STATUS_COLOR[status];
  const calm = header && status === 'replay';
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[calm ? styles.badgeTextCalm : styles.badgeText, { color }]}>{header ? headerLabel : statusLabel}</Text>
    </View>
  );
}

function RecordingIndicator() {
  const { activeRecording } = useEnergyStore();
  if (!activeRecording) return null;
  return <Text style={styles.recording}>● Recording</Text>;
}

export function SettingsButton() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.navigate('/settings')} style={styles.gear} hitSlop={6}>
      <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} tintColor={palette.textMuted} size={20} fallback={<Text style={styles.gearFallback}>⚙</Text>} />
    </Pressable>
  );
}

export function ScreenHeader({ eyebrow, title, subtitle, showSettings = false }: { eyebrow: string; title: string; subtitle?: string; showSettings?: boolean }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.headerActions}>
        {showSettings && <SettingsButton />}
        <StatusBadge header />
        <RecordingIndicator />
      </View>
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  // Keep the last item clear of the tab bar and the home indicator.
  const { bottom } = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <DemoLine />
      <ConnectionBanner />
      {/* "handled": a tap on a button (e.g. Save) works while the keyboard is open instead of only closing it. */}
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + bottom + 16 }]}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: palette.background, flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  demoLine: { alignItems: 'center', backgroundColor: '#16202a', borderBottomColor: palette.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  demoText: { color: palette.textMuted, flexShrink: 1, fontSize: 12 },
  demoStop: { color: '#c6d1d5', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  offlineBanner: { backgroundColor: '#8e1f1f', paddingHorizontal: 16, paddingVertical: 10 },
  offlineText: { fontVariant: ['tabular-nums'], color: '#fff', fontSize: 13, fontWeight: '800' },
  offlineHint: { color: '#ffc9c9', fontSize: 11, marginTop: 3 },
  offlineAction: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 7 },
  offlineActionText: { color: '#8e1f1f', fontSize: 13, fontWeight: '800' },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, marginBottom: 16 },
  headerText: { flex: 1, minWidth: 0 },
  headerActions: { alignItems: 'flex-end', flexShrink: 0, gap: 8 },
  eyebrow: { color: palette.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: palette.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  subtitle: { color: palette.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  gear: { alignItems: 'center', backgroundColor: '#1d3039', borderColor: '#35505b', borderRadius: 10, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  gearFallback: { color: palette.textMuted, fontSize: 18 },
  badge: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  badgeDot: { borderRadius: 4, height: 7, width: 7 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  badgeTextCalm: { fontVariant: ['tabular-nums'], fontSize: 11, fontWeight: '600' },
  recording: { color: '#ff8a8a', fontSize: 11, fontWeight: '700' },
});
