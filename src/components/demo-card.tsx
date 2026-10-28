import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Card, CardTitle } from '@/components/controls';
import { palette } from '@/components/screen';
import { Text } from '@/components/text';
import { formatRecordingStamp } from '@/lib/recordings';
import { useEnergyStore } from '@/state/energyStore';

// Two ways to show the app without live ESP32 data: replay the latest real recording,
// or generate simulated data (with an optional simulated hydro generator run).
export function DemoCard() {
  const { mode, recordings, setDemo, startReplay, stopReplay, hydroBurstActive, runHydroGenerator } = useEnergyStore();
  const latest = recordings[0];
  const simulated = mode === 'demo';
  const generatorDisabled = !simulated || hydroBurstActive;

  const toggleRecorded = (enabled: boolean) => {
    if (enabled && latest) startReplay(latest.id);
    else if (!enabled) stopReplay();
  };
  // Switching to simulated data also ends a running replay (the store only has one mode at a time).
  const toggleSimulated = (enabled: boolean) => setDemo(enabled);

  return (
    <Card>
      <CardTitle title="Demo" />
      <View style={styles.row}>
        <View style={styles.flexText}>
          <Text style={styles.rowTitle}>Recorded data</Text>
          <Text style={styles.small}>
            {latest ? `Plays your latest saved recording (${formatRecordingStamp(latest.startedAt)}).` : 'No recording saved yet. Record a test run in History first.'}
          </Text>
        </View>
        <Switch accessibilityLabel="Recorded data demo" disabled={!latest} value={mode === 'replay'} onValueChange={toggleRecorded} trackColor={{ true: palette.teg, false: '#3a4a55' }} thumbColor="#f5f7f8" />
      </View>

      <View style={[styles.row, styles.divider]}>
        <View style={styles.flexText}>
          <Text style={styles.rowTitle}>Simulated data</Text>
          <Text style={styles.small}>Generated data for practising without the hardware. Never saved to the live history.</Text>
        </View>
        <Switch accessibilityLabel="Simulated data demo" value={simulated} onValueChange={toggleSimulated} trackColor={{ true: palette.teg, false: '#3a4a55' }} thumbColor="#f5f7f8" />
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: generatorDisabled }} disabled={generatorDisabled} onPress={runHydroGenerator} style={[styles.button, generatorDisabled && styles.buttonDisabled]}>
        <Text style={[styles.buttonText, generatorDisabled && styles.textDisabled]}>{hydroBurstActive ? 'Hydro generator running…' : 'Run hydro generator'}</Text>
      </Pressable>
      {!simulated && <Text style={styles.small}>“Run hydro generator” works while simulated data is on.</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  small: { color: palette.textFaint, fontSize: 11, lineHeight: 16, marginTop: 4 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 10 },
  divider: { borderTopColor: palette.border, borderTopWidth: 1, paddingTop: 12 },
  flexText: { flex: 1, minWidth: 0 },
  rowTitle: { color: palette.text, fontSize: 14, fontWeight: '700' },
  button: { alignItems: 'center', borderColor: '#35505b', borderRadius: 10, borderWidth: 1, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10 },
  buttonText: { color: '#c6d1d5', fontSize: 13, fontWeight: '700' },
  buttonDisabled: { backgroundColor: '#26323b', borderColor: '#26323b' },
  textDisabled: { color: '#6f7f88' },
});
