import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ESP32_URL = 'http://172.20.xx.x/data';
type Reading = { teg: number; turbine: number; total: number; time: string };

function readPower(value: unknown): Reading {
  const json = value as Record<string, any>;
  const teg = json.teg?.power_mW ?? json.power_mW ?? json.power ?? 0;
  const turbine = json.turbine?.power_mW ?? 0;
  return { teg, turbine, total: json.total_power_mW ?? teg + turbine, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
}

export default function HistoryScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [readings, setReadings] = useState<Reading[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(ESP32_URL);
        if (!response.ok) throw new Error('HTTP');
        const reading = readPower(await response.json());
        if (active) { setReadings((items) => [...items, reading].slice(-20)); setConnected(true); }
      } catch { if (active) setConnected(false); }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const peak = Math.max(1, ...readings.map((reading) => reading.total));
  const average = readings.length ? readings.reduce((sum, reading) => sum + reading.total, 0) / readings.length : 0;

  const exportCsv = async () => {
    if (!readings.length || !FileSystem.cacheDirectory) {
      Alert.alert('No data yet', 'Collect a few readings before exporting.');
      return;
    }
    const csv = ['time,teg_power_mW,turbine_power_mW,total_power_mW', ...readings.map((reading) => `${reading.time},${reading.teg.toFixed(4)},${reading.turbine.toFixed(4)},${reading.total.toFixed(4)}`)].join('\n');
    const uri = `${FileSystem.cacheDirectory}energy-session.csv`;
    try {
      await FileSystem.writeAsStringAsync(uri, csv);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export energy session' });
      else Alert.alert('CSV ready', 'File sharing is not available on this device.');
    } catch { Alert.alert('Export failed', 'The session file could not be created.'); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent]}>
        <Text style={styles.eyebrow}>LIVE HISTORY / 40 SEC</Text>
        <Text style={[styles.title, compact && styles.compactTitle]}>Power History</Text>
        <Text style={styles.subtitle}>Review recent measurements and monitor system stability over time.</Text>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statLabel}>Average power</Text><Text style={styles.statValue}>{average.toFixed(2)} mW</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>Peak power</Text><Text style={styles.statValue}>{peak.toFixed(2)} mW</Text></View>
        </View>
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}><Text style={styles.sectionTitle}>Total power trend</Text><Text style={[styles.live, { color: connected ? '#4ecca3' : '#e74c3c' }]}>{connected ? '● LIVE' : '● OFFLINE'}</Text></View>
          <View style={styles.chart}>
            {readings.map((reading, index) => <View key={`${reading.time}-${index}`} style={[styles.bar, { height: `${Math.max(4, (reading.total / peak) * 100)}%` }]} />)}
          </View>
          <Text style={styles.caption}>Last 20 points · every 2 seconds</Text>
        </View>
        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>Recent readings</Text>
          {readings.slice(-6).reverse().map((reading, index) => <View key={`${reading.time}-${index}`} style={styles.row}><Text style={styles.time}>{reading.time}</Text><Text style={styles.rowValue}>{reading.total.toFixed(2)} mW</Text><Text style={styles.rowDetail}>TEG {reading.teg.toFixed(2)} · Turbine {reading.turbine.toFixed(2)}</Text></View>)}
          {!readings.length && <ActivityIndicator color="#4ecca3" style={styles.loader} />}
        </View>
        <Pressable accessibilityLabel="Export session as CSV" onPress={exportCsv} style={styles.exportButton}><Text style={styles.exportIcon}>⇩</Text><Text style={styles.exportText}>EXPORT SESSION CSV</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  compactContent: { paddingHorizontal: 14 },
  compactTitle: { fontSize: 26 },
  safe: { flex: 1, backgroundColor: '#10151b' }, content: { padding: 20, paddingBottom: 40 }, eyebrow: { color: '#4ecca3', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, title: { color: '#f5f7f8', fontSize: 30, fontWeight: '900', marginTop: 7 }, subtitle: { color: '#8e9aa6', fontSize: 13, lineHeight: 20, marginTop: 8 }, stats: { flexDirection: 'row', gap: 12, marginTop: 20 }, stat: { backgroundColor: '#18232c', borderRadius: 12, flex: 1, padding: 16 }, statLabel: { color: '#84939e', fontSize: 11 }, statValue: { color: '#f5f7f8', fontSize: 20, fontWeight: '800', marginTop: 7 }, chartCard: { backgroundColor: '#18232c', borderRadius: 14, marginTop: 14, padding: 16 }, chartHeader: { flexDirection: 'row', justifyContent: 'space-between' }, sectionTitle: { color: '#f5f7f8', fontSize: 15, fontWeight: '800' }, live: { fontSize: 10, fontWeight: '800' }, chart: { alignItems: 'flex-end', borderBottomColor: '#34434d', borderBottomWidth: 1, flexDirection: 'row', gap: 2, height: 150, marginTop: 18 }, bar: { backgroundColor: '#4ecca3', borderTopLeftRadius: 3, borderTopRightRadius: 3, flex: 1, minHeight: 4 }, caption: { color: '#687984', fontSize: 10, marginTop: 9 }, exportButton: { alignItems: 'center', backgroundColor: '#1d3039', borderColor: '#35505b', borderRadius: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', marginTop: 12, padding: 12 }, exportIcon: { color: '#4ecca3', fontSize: 18, marginRight: 8 }, exportText: { color: '#c9e9df', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }, listCard: { backgroundColor: '#18232c', borderRadius: 14, marginTop: 14, padding: 16 }, row: { borderBottomColor: '#293943', borderBottomWidth: 1, paddingVertical: 12 }, time: { color: '#8e9aa6', fontSize: 11 }, rowValue: { color: '#f5f7f8', fontSize: 17, fontWeight: '800', marginTop: 3 }, rowDetail: { color: '#687984', fontSize: 11, marginTop: 3 }, loader: { margin: 20 },
});