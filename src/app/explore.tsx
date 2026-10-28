import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Card, CardTitle } from '@/components/controls';
import { palette, Screen, ScreenHeader } from '@/components/screen';
import { formatDuration, formatEnergy, formatPower } from '@/lib/format';
import { useEnergyStore } from '@/state/energyStore';

function ShareBar({ label, energyJ, totalJ, avgMw, color }: { label: string; energyJ: number; totalJ: number; avgMw: number; color: string }) {
  const percent = totalJ > 0 ? Math.min(100, Math.max(0, (energyJ / totalJ) * 100)) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabel}>
        <Text style={[styles.barName, { color }]}>{label}</Text>
        <Text style={styles.barValue}>{`${formatEnergy(energyJ)} · ${percent.toFixed(0)}\u00A0%`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { backgroundColor: color, width: `${percent}%` }]} />
      </View>
      <Text style={styles.barDetail}>{`Average power: ${formatPower(avgMw)}`}</Text>
    </View>
  );
}

export default function CompareScreen() {
  const { tegEnergyJ, hydroEnergyJ, totalEnergyJ, tegAvgMw, hydroAvgMw, integratedSeconds } = useEnergyStore();
  const leader = totalEnergyJ <= 0 ? null : tegEnergyJ >= hydroEnergyJ ? 'TEG (heat)' : 'Hydro (flow)';

  return (
    <Screen>
      <ScreenHeader eyebrow="SOURCE COMPARISON" title="Compare" subtitle="Shows which channel collected more energy in this session." />

      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>CHANNEL WITH THE MOST ENERGY</Text>
        <Text style={styles.heroValue}>{leader ?? 'No energy yet'}</Text>
        <Text style={styles.heroHint}>{`Total ${formatEnergy(totalEnergyJ)} · measured for ${formatDuration(integratedSeconds)}`}</Text>
      </Card>

      <Card>
        <CardTitle title="Energy contribution (this session)" />
        <ShareBar label="TEG (heat)" energyJ={tegEnergyJ} totalJ={totalEnergyJ} avgMw={tegAvgMw} color={palette.teg} />
        <ShareBar label="Hydro (flow)" energyJ={hydroEnergyJ} totalJ={totalEnergyJ} avgMw={hydroAvgMw} color={palette.hydro} />
        <Text style={styles.note}>Live voltage, current and power are shown in the “Electrical output” card on the Dashboard.</Text>
      </Card>

      <Card>
        <CardTitle title="What is the difference?" />
        <Text style={styles.body}>The TEG produces a small, continuous amount of power from the temperature difference between the soup and the heatsink. Its power drops as the soup cools.</Text>
        <Text style={styles.body}>The hydro turbine produces higher power for a short time, only while the soup is being poured. With no flow, its power is zero.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#1c2e2b', borderColor: '#376a5a', marginTop: 0 },
  heroLabel: { color: '#82cbb4', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroValue: { color: palette.text, fontSize: 28, fontWeight: '900', marginTop: 6 },
  heroHint: { fontVariant: ['tabular-nums'], color: '#8bb8aa', fontSize: 12, marginTop: 4 },
  barRow: { marginTop: 14 },
  barLabel: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', marginBottom: 7 },
  barName: { fontSize: 13, fontWeight: '800' },
  barValue: { fontVariant: ['tabular-nums'], color: palette.text, fontSize: 13, fontWeight: '800' },
  track: { backgroundColor: '#2b3b44', borderRadius: 4, height: 10, overflow: 'hidden' },
  fill: { borderRadius: 4, height: '100%' },
  barDetail: { fontVariant: ['tabular-nums'], color: palette.textFaint, fontSize: 11, marginTop: 5 },
  note: { color: palette.textFaint, fontSize: 11, lineHeight: 16, marginTop: 14 },
  body: { color: palette.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8 },
});
