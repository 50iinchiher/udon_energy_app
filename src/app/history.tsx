import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Card, CardTitle } from '@/components/controls';
import { RecordingCard } from '@/components/recording-card';
import { palette, Screen, ScreenHeader } from '@/components/screen';
import { formatClock, formatDuration, formatEnergy, formatPower, formatTemperature } from '@/lib/format';
import { useEnergyStore, type Sample } from '@/state/energyStore';

function toCsv(samples: Sample[]) {
  const header = 'timestamp_ms,teg_V,teg_mA,teg_mW,hydro_V,hydro_mA,hydro_mW,total_mW,soup_C,deltaT_C,deltaT_source,battery_V,seq';
  const cell = (value: number | undefined, decimals: number) => (value === undefined ? '' : value.toFixed(decimals));
  const rows = samples.map((sample) => [
    sample.t,
    cell(sample.teg.voltage, 3), cell(sample.teg.current_mA, 2), cell(sample.teg.power_mW, 3),
    cell(sample.hydro.voltage, 3), cell(sample.hydro.current_mA, 2), cell(sample.hydro.power_mW, 3),
    cell(sample.totalPowerMw, 3), cell(sample.soupC, 2), cell(sample.deltaTC, 2), sample.deltaTSource,
    cell(sample.batteryV, 3), sample.seq ?? '',
  ].join(','));
  return [header, ...rows].join('\n');
}

export default function HistoryScreen() {
  const { history, mode, totalEnergyJ, peakPowerMw, integratedSeconds, tegAvgMw, hydroAvgMw } = useEnergyStore();
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const replaying = mode === 'replay';
  const demo = mode === 'demo';
  // Only live measurements are exported: replay shifts timestamps, demo data is synthetic.
  const exportDisabled = replaying || demo || !history.length;
  const recent = history.slice(-8).reverse();

  const exportCsv = async () => {
    if (exportDisabled) return;
    try {
      const file = new File(Paths.cache, 'thermotrack-session.csv');
      file.write(toCsv(history));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Share measurement file' });
        setExportMessage(null);
      } else {
        setExportMessage('File sharing is not available on this device.');
      }
    } catch {
      setExportMessage('Could not create the file.');
    }
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow={replaying ? 'RECORDING' : demo ? 'MEASUREMENT HISTORY' : 'LIVE MEASUREMENT HISTORY'}
        title="History"
        subtitle={replaying ? 'Playing back a previously saved real measurement.' : demo ? 'Measurements from this session.' : 'Real measurements from this session.'}
      />

      <View style={styles.stats}>
        <Stat label="Total energy" value={formatEnergy(totalEnergyJ)} />
        <Stat label="Time measured" value={formatDuration(integratedSeconds)} />
        <Stat label="Peak power" value={formatPower(peakPowerMw)} />
        <Stat label="Average power" value={formatPower(tegAvgMw + hydroAvgMw)} />
      </View>

      <Card>
        <CardTitle title="Latest measurements" />
        {recent.map((sample) => (
          <View key={sample.t} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.time}>{formatClock(sample.t)}</Text>
              <Text style={styles.rowValue}>{formatPower(sample.totalPowerMw)}</Text>
            </View>
            <Text style={styles.rowDetail}>
              {`TEG ${formatPower(sample.teg.power_mW)} · Hydro ${formatPower(sample.hydro.power_mW)}${sample.soupC !== undefined ? ` · Soup ${formatTemperature(sample.soupC)}` : ''}`}
            </Text>
          </View>
        ))}
        {!recent.length && <Text style={styles.empty}>No measurements have arrived in this session yet.</Text>}
      </Card>

      <Pressable accessibilityRole="button" accessibilityState={{ disabled: exportDisabled }} disabled={exportDisabled} onPress={exportCsv} style={[styles.exportButton, exportDisabled && styles.exportDisabled]}>
        <Text style={[styles.exportText, exportDisabled && styles.exportTextDisabled]}>Share measurements as a CSV file</Text>
      </Pressable>
      {replaying && <Text style={styles.hint}>Export is unavailable while a recording plays. Go back to live data to export.</Text>}
      {demo && <Text style={styles.hint}>Demo data cannot be exported.</Text>}
      {!replaying && !demo && !history.length && <Text style={styles.hint}>Collect some measurements before exporting.</Text>}
      {exportMessage && <Text style={styles.hint}>{exportMessage}</Text>}
      <RecordingCard />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { backgroundColor: palette.card, borderColor: palette.border, borderRadius: 12, borderWidth: 1, flexBasis: '46%', flexGrow: 1, padding: 14 },
  statLabel: { color: palette.textFaint, fontSize: 12 },
  statValue: { fontVariant: ['tabular-nums'], color: palette.text, fontSize: 18, fontWeight: '800', marginTop: 6 },
  row: { borderBottomColor: '#293943', borderBottomWidth: 1, paddingVertical: 10 },
  rowTop: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontVariant: ['tabular-nums'], color: palette.textMuted, fontSize: 12 },
  rowValue: { fontVariant: ['tabular-nums'], color: palette.text, fontSize: 16, fontWeight: '800' },
  rowDetail: { fontVariant: ['tabular-nums'], color: palette.textFaint, fontSize: 12, marginTop: 3 },
  empty: { color: palette.textFaint, fontSize: 13, marginTop: 10 },
  exportButton: { alignItems: 'center', backgroundColor: '#1d3039', borderColor: '#35505b', borderRadius: 10, borderWidth: 1, marginTop: 14, padding: 13 },
  exportDisabled: { backgroundColor: '#1a2228', borderColor: '#26323b' },
  exportText: { color: '#c9e9df', fontSize: 13, fontWeight: '800' },
  exportTextDisabled: { color: '#5c6b74' },
  hint: { color: palette.textFaint, fontSize: 12, lineHeight: 17, marginTop: 8, textAlign: 'center' },
});
